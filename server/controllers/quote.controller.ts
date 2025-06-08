import { Request, Response } from "express";
import { QuoteRepository } from "../storage/repositories/quote.repository";
import { createInsertSchema } from "drizzle-zod";
import { quotes, quoteLineItems, quoteResponses } from "@shared/schema";
import { uploadToR2, deleteFromR2 } from "../r2-upload";
import { z } from "zod";
import { sendEmail } from "../email";
import { initializeQuoteChat } from "../stream-chat";

const createQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  quoteNumber: true,
  accessToken: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override date fields to accept strings/null and convert them to Date objects
  validUntil: z.string().transform((str) => new Date(str)),
  estimatedStartDate: z.union([z.string(), z.null()]).optional().transform((str) => str ? new Date(str) : null),
  estimatedCompletionDate: z.union([z.string(), z.null()]).optional().transform((str) => str ? new Date(str) : null),
  sentAt: z.union([z.string(), z.null()]).optional().transform((str) => str ? new Date(str) : null),
  viewedAt: z.union([z.string(), z.null()]).optional().transform((str) => str ? new Date(str) : null),
  respondedAt: z.union([z.string(), z.null()]).optional().transform((str) => str ? new Date(str) : null),
});

const createLineItemSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.union([z.string(), z.number()]).transform(val => String(val)),
  unit: z.string().optional().default(""),
  unitPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  discountPercentage: z.union([z.string(), z.number()]).optional().default("0").transform(val => String(val || "0")),
  discountAmount: z.union([z.string(), z.number()]).optional().default("0").transform(val => String(val || "0")),
  totalPrice: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : "0"),
  sortOrder: z.number().optional().default(0),
});

const createResponseSchema = createInsertSchema(quoteResponses).omit({
  id: true,
  quoteId: true,
  createdAt: true,
});

export class QuoteController {
  private quoteRepository: QuoteRepository;

  constructor() {
    this.quoteRepository = new QuoteRepository();
  }

  async getAllQuotes(req: Request, res: Response) {
    try {
      const quotes = await this.quoteRepository.getAllQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  }

  async getQuoteById(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const quote = await this.quoteRepository.getQuoteById(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  }

  async createQuote(req: Request, res: Response) {
    try {
      const validatedData = createQuoteSchema.parse(req.body);
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const quote = await this.quoteRepository.createQuote(validatedData, userId);
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  }

  async updateQuote(req: Request, res: Response) {
    try {
      console.log("UPDATE QUOTE - Received request body:", JSON.stringify(req.body, null, 2));
      
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      console.log("UPDATE QUOTE - Parsing with schema...");
      const validatedData = createQuoteSchema.partial().parse(req.body);
      console.log("UPDATE QUOTE - Validated data:", JSON.stringify(validatedData, null, 2));
      
      const quote = await this.quoteRepository.updateQuote(quoteId, validatedData);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      console.log("UPDATE QUOTE - Success, returning quote");
      res.json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("UPDATE QUOTE - Zod validation error:", error.errors);
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("UPDATE QUOTE - General error:", error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  }

  async deleteQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const success = await this.quoteRepository.deleteQuote(quoteId);
      if (!success) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  }

  async sendQuote(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      // Get the full quote details for email
      const quoteDetails = await this.quoteRepository.getQuoteById(quoteId);
      if (!quoteDetails) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Update quote status to 'sent'
      const quote = await this.quoteRepository.sendQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: "Failed to update quote status" });
      }

      // Initialize chat channel for quote
      try {
        await initializeQuoteChat(
          quoteId.toString(),
          quoteDetails.quoteNumber,
          quoteDetails.customerName,
          quoteDetails.customerEmail
        );
        console.log(`Chat channel initialized for quote ${quoteDetails.quoteNumber}`);
      } catch (chatError) {
        console.warn("Failed to initialize chat channel:", chatError);
        // Continue with quote sending even if chat fails
      }

      // Send email to customer
      const quoteLink = `${req.protocol}://${req.get('host')}/quote/${quoteDetails.accessToken}`;
      const emailSent = await this.sendQuoteEmail(quoteDetails, quoteLink);

      if (!emailSent) {
        console.warn("Quote status updated but email failed to send");
        return res.json({ 
          message: "Quote sent successfully but email delivery failed", 
          quote,
          emailSent: false 
        });
      }

      res.json({ 
        message: "Quote sent successfully via email", 
        quote,
        emailSent: true 
      });
    } catch (error) {
      console.error("Error sending quote:", error);
      res.status(500).json({ error: "Failed to send quote" });
    }
  }

  private async sendQuoteEmail(quote: any, quoteLink: string): Promise<boolean> {
    try {
      const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(parseFloat(amount));
      };

      const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Project Quote from Kolmo</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #3d4552 0%, #4a5568 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 40px 30px; }
        .quote-summary { background-color: #f8f9fa; border-left: 4px solid #db973c; padding: 25px; margin: 25px 0; border-radius: 8px; }
        .quote-number { font-size: 18px; font-weight: 600; color: #3d4552; margin-bottom: 10px; }
        .project-title { font-size: 24px; font-weight: 700; color: #2d3748; margin-bottom: 15px; }
        .project-details { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
        .detail-item { flex: 1; min-width: 200px; }
        .detail-label { font-size: 12px; color: #718096; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
        .detail-value { font-size: 16px; color: #2d3748; font-weight: 500; }
        .total-amount { text-align: center; background-color: #e6fffa; border: 2px solid #38b2ac; border-radius: 12px; padding: 20px; margin: 25px 0; }
        .total-label { font-size: 14px; color: #2d3748; margin-bottom: 5px; }
        .total-value { font-size: 32px; font-weight: 700; color: #1a202c; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #db973c 0%, #e2a354 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; text-align: center; box-shadow: 0 4px 15px rgba(219, 151, 60, 0.4); }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(219, 151, 60, 0.5); }
        .validity-notice { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .validity-notice strong { color: #856404; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 5px 0; color: #718096; font-size: 14px; }
        .contact-info { margin: 20px 0; padding: 20px; background-color: #f7fafc; border-radius: 8px; }
        @media (max-width: 600px) {
            .project-details { flex-direction: column; }
            .detail-item { min-width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏗️ Kolmo Construction</h1>
            <p>Your Professional Project Quote is Ready</p>
        </div>
        
        <div class="content">
            <h2>Hello ${quote.customerName || 'Valued Customer'},</h2>
            
            <p>Thank you for considering Kolmo for your construction project. We're excited to present you with a detailed quote for your upcoming project.</p>
            
            <div class="quote-summary">
                <div class="quote-number">Quote #${quote.quoteNumber}</div>
                <div class="project-title">${quote.title}</div>
                ${quote.description ? `<p style="color: #4a5568; margin: 10px 0;">${quote.description}</p>` : ''}
                
                <div class="project-details">
                    <div class="detail-item">
                        <div class="detail-label">Project Type</div>
                        <div class="detail-value">${quote.projectType}</div>
                    </div>
                    ${quote.location ? `
                    <div class="detail-item">
                        <div class="detail-label">Location</div>
                        <div class="detail-value">${quote.location}</div>
                    </div>
                    ` : ''}
                    ${quote.estimatedStartDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Estimated Start</div>
                        <div class="detail-value">${formatDate(quote.estimatedStartDate)}</div>
                    </div>
                    ` : ''}
                    ${quote.estimatedCompletionDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Estimated Completion</div>
                        <div class="detail-value">${formatDate(quote.estimatedCompletionDate)}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="total-amount">
                <div class="total-label">Total Project Investment</div>
                <div class="total-value">${formatCurrency(quote.total)}</div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${quoteLink}" class="cta-button">View Complete Quote Details</a>
            </div>

            <div class="validity-notice">
                <strong>⏰ Time-Sensitive Offer:</strong> This quote is valid until <strong>${formatDate(quote.validUntil)}</strong>. 
                Please review and respond by this date to secure your project slot and pricing.
            </div>

            <h3>What's Included in Your Quote:</h3>
            <ul style="color: #4a5568; line-height: 1.6;">
                <li>Detailed breakdown of all materials and labor</li>
                <li>Professional project timeline and milestones</li>
                <li>Comprehensive scope of work documentation</li>
                <li>Transparent pricing with no hidden fees</li>
                <li>Quality assurance and warranty information</li>
            </ul>

            <div class="contact-info">
                <h3 style="margin-top: 0; color: #2d3748;">Questions? We're Here to Help!</h3>
                <p style="margin: 5px 0;">Our team is ready to discuss any aspect of your project and answer your questions.</p>
                <p style="margin: 5px 0;">📧 Email: info@kolmo.io | 📞 Phone: (555) 123-4567</p>
            </div>

            <p style="margin-top: 30px;">We look forward to the opportunity to bring your vision to life with exceptional quality and craftsmanship.</p>
            
            <p style="margin-top: 20px;">
                Best regards,<br>
                <strong>The Kolmo Construction Team</strong>
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Kolmo Construction Services</strong></p>
            <p>Building Dreams, Delivering Excellence</p>
            <p>www.kolmo.io | info@kolmo.io | (555) 123-4567</p>
        </div>
    </div>
</body>
</html>`;

      const emailText = `
Hello ${quote.customerName || 'Valued Customer'},

Thank you for considering Kolmo for your construction project. Your quote is ready for review.

Quote Details:
- Quote Number: ${quote.quoteNumber}
- Project: ${quote.title}
- Project Type: ${quote.projectType}
- Total Investment: ${formatCurrency(quote.total)}
- Valid Until: ${formatDate(quote.validUntil)}

View your complete quote with detailed breakdown and project information:
${quoteLink}

This quote is valid until ${formatDate(quote.validUntil)}. Please review and respond by this date to secure your project slot and pricing.

Questions? Contact us:
Email: info@kolmo.io
Phone: (555) 123-4567

Best regards,
The Kolmo Construction Team
www.kolmo.io
`;

      return await sendEmail({
        to: quote.customerEmail,
        subject: `Your Project Quote #${quote.quoteNumber} from Kolmo Construction`,
        text: emailText,
        html: emailHtml,
        from: 'quotes@kolmo.io',
        fromName: 'Kolmo Construction'
      });
    } catch (error) {
      console.error("Error sending quote email:", error);
      return false;
    }
  }

  async getQuoteLineItems(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const lineItems = await this.quoteRepository.getQuoteLineItems(quoteId);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching line items:", error);
      res.status(500).json({ error: "Failed to fetch line items" });
    }
  }

  async createLineItem(req: Request, res: Response) {
    try {
      console.log("CreateLineItem - Request body:", JSON.stringify(req.body, null, 2));
      
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      console.log("CreateLineItem - Quote ID:", quoteId);
      
      const validatedData = createLineItemSchema.parse(req.body);
      console.log("CreateLineItem - Validated data:", JSON.stringify(validatedData, null, 2));
      
      const lineItem = await this.quoteRepository.createLineItem(quoteId, validatedData);
      console.log("CreateLineItem - Created line item:", JSON.stringify(lineItem, null, 2));
      
      res.status(201).json(lineItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("CreateLineItem - Validation error:", error.errors);
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("CreateLineItem - Error:", error);
      res.status(500).json({ error: "Failed to create line item" });
    }
  }

  async updateLineItem(req: Request, res: Response) {
    try {
      const lineItemId = parseInt(req.params.lineItemId);
      if (isNaN(lineItemId)) {
        return res.status(400).json({ error: "Invalid line item ID" });
      }

      const validatedData = createLineItemSchema.partial().parse(req.body);
      const lineItem = await this.quoteRepository.updateLineItem(lineItemId, validatedData);
      
      if (!lineItem) {
        return res.status(404).json({ error: "Line item not found" });
      }

      res.json(lineItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating line item:", error);
      res.status(500).json({ error: "Failed to update line item" });
    }
  }

  async deleteLineItem(req: Request, res: Response) {
    try {
      const lineItemId = parseInt(req.params.lineItemId);
      if (isNaN(lineItemId)) {
        return res.status(400).json({ error: "Invalid line item ID" });
      }

      const success = await this.quoteRepository.deleteLineItem(lineItemId);
      if (!success) {
        return res.status(404).json({ error: "Line item not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting line item:", error);
      res.status(500).json({ error: "Failed to delete line item" });
    }
  }

  async uploadQuoteImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imageData = {
        url: req.file.path || req.file.filename,
        type: req.body.type || 'image',
        caption: req.body.caption,
        category: req.body.category || 'reference',
        uploadedById: (req as any).user?.id || 1,
      };

      const image = await this.quoteRepository.uploadQuoteImage(quoteId, imageData);
      res.status(201).json(image);
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }

  async deleteQuoteImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      const success = await this.quoteRepository.deleteQuoteImage(imageId);
      if (!success) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  }

  async uploadBeforeAfterImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const caption = req.body.caption || '';
      
      // Upload file to R2 storage
      const uploadResult = await uploadToR2({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        mimetype: req.file.mimetype,
        path: `quotes/${quoteId}/${imageType}`,
      });
      
      // Update the quote with the new image URL and caption
      const updateData = imageType === 'before' 
        ? { beforeImageUrl: uploadResult.url, beforeImageCaption: caption }
        : { afterImageUrl: uploadResult.url, afterImageCaption: caption };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image uploaded successfully`,
        imageUrl: uploadResult.url,
        caption: caption
      });
    } catch (error) {
      console.error("Error uploading before/after image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  }

  async updateImageCaption(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      const { caption } = req.body;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      const updateData = imageType === 'before' 
        ? { beforeImageCaption: caption }
        : { afterImageCaption: caption };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image caption updated successfully`,
        caption: caption
      });
    } catch (error) {
      console.error("Error updating image caption:", error);
      res.status(500).json({ error: "Failed to update caption" });
    }
  }

  async deleteBeforeAfterImage(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      const imageType = req.params.type;
      
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!['before', 'after'].includes(imageType)) {
        return res.status(400).json({ error: "Image type must be 'before' or 'after'" });
      }

      // Get the current quote to find the image URL for deletion
      const currentQuote = await this.quoteRepository.getQuoteById(quoteId);
      if (!currentQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Extract the R2 key from the image URL for deletion
      const imageUrl = imageType === 'before' ? currentQuote.beforeImageUrl : currentQuote.afterImageUrl;
      if (imageUrl) {
        try {
          // Extract the key from the R2 URL (assuming format: https://domain/key)
          const urlParts = imageUrl.split('/');
          const key = urlParts.slice(3).join('/'); // Remove protocol and domain
          await deleteFromR2(key);
        } catch (deleteError) {
          console.warn(`Failed to delete image from R2: ${deleteError}`);
          // Continue with database update even if R2 deletion fails
        }
      }

      const updateData = imageType === 'before' 
        ? { beforeImageUrl: null, beforeImageCaption: null }
        : { afterImageUrl: null, afterImageCaption: null };

      const updatedQuote = await this.quoteRepository.updateQuote(quoteId, updateData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.status(200).json({
        message: `${imageType} image deleted successfully`
      });
    } catch (error) {
      console.error("Error deleting before/after image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  }

  async getQuoteByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      const quote = await this.quoteRepository.getQuoteByAccessToken(token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or expired" });
      }

      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote by token:", error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  }

  async respondToQuote(req: Request, res: Response) {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // First get the quote to get its ID
      const quote = await this.quoteRepository.getQuoteByAccessToken(token);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or expired" });
      }

      const validatedData = createResponseSchema.parse(req.body);
      const response = await this.quoteRepository.createQuoteResponse(quote.id, validatedData);
      
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating quote response:", error);
      res.status(500).json({ error: "Failed to create response" });
    }
  }

  async updateQuoteFinancials(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const validatedData = z.object({
        discountPercentage: z.string().optional(),
        discountAmount: z.string().optional(),
        taxRate: z.string().optional(),
        taxAmount: z.string().optional(),
        isManualTax: z.boolean().optional(),
      }).parse(req.body);

      const updatedQuote = await this.quoteRepository.updateQuoteFinancials(quoteId, validatedData);
      
      if (!updatedQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      res.json(updatedQuote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating quote financials:", error);
      res.status(500).json({ error: "Failed to update quote financials" });
    }
  }
}
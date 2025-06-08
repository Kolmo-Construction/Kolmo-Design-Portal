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

      console.log(`[QuoteController] Starting quote send process for ID: ${quoteId}`);

      // Get the full quote details for email
      const quoteDetails = await this.quoteRepository.getQuoteById(quoteId);
      if (!quoteDetails) {
        console.error(`[QuoteController] Quote not found for ID: ${quoteId}`);
        return res.status(404).json({ error: "Quote not found" });
      }

      console.log(`[QuoteController] Quote details retrieved:`, {
        quoteNumber: quoteDetails.quoteNumber,
        customerName: quoteDetails.customerName,
        customerEmail: quoteDetails.customerEmail,
        title: quoteDetails.title
      });

      // Validate customer information exists
      if (!quoteDetails.customerEmail || !quoteDetails.customerName) {
        console.error(`[QuoteController] Missing customer information:`, {
          hasEmail: !!quoteDetails.customerEmail,
          hasName: !!quoteDetails.customerName
        });
        return res.status(400).json({ 
          error: "Quote is missing customer information. Please update the quote with customer details before sending." 
        });
      }

      // Update quote status to 'sent'
      const quote = await this.quoteRepository.sendQuote(quoteId);
      if (!quote) {
        console.error(`[QuoteController] Failed to update quote status for ID: ${quoteId}`);
        return res.status(404).json({ error: "Failed to update quote status" });
      }

      console.log(`[QuoteController] Quote status updated to 'sent' for quote ${quoteDetails.quoteNumber}`);

      // Initialize chat channel for quote
      try {
        await initializeQuoteChat(
          quoteId.toString(),
          quoteDetails.quoteNumber,
          quoteDetails.customerName,
          quoteDetails.customerEmail
        );
        console.log(`[QuoteController] Chat channel initialized for quote ${quoteDetails.quoteNumber}`);
      } catch (chatError) {
        console.warn("[QuoteController] Failed to initialize chat channel:", chatError);
        // Continue with quote sending even if chat fails
      }

      // Send email to customer
      const quoteLink = `${req.protocol}://${req.get('host')}/customer/quote/${quoteDetails.accessToken}`;
      console.log(`[QuoteController] Sending email to ${quoteDetails.customerEmail} with link: ${quoteLink}`);
      
      const emailSent = await this.sendQuoteEmail(quoteDetails, quoteLink);

      if (!emailSent) {
        console.warn(`[QuoteController] Quote status updated but email failed to send for quote ${quoteDetails.quoteNumber}`);
        return res.json({ 
          message: "Quote sent successfully but email delivery failed", 
          quote,
          emailSent: false 
        });
      }

      console.log(`[QuoteController] Quote ${quoteDetails.quoteNumber} sent successfully via email to ${quoteDetails.customerEmail}`);
      res.json({ 
        message: "Quote sent successfully via email", 
        quote,
        emailSent: true 
      });
    } catch (error) {
      console.error("[QuoteController] Error sending quote:", error);
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
    <title>Project Quote - ${quote.quoteNumber}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: #f4f6f8; line-height: 1.6; }
        .container { max-width: 650px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #2c3e50; color: #ffffff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 2px; }
        .header p { margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 300; }
        .content { padding: 40px 30px; color: #2c3e50; }
        .greeting { font-size: 18px; margin-bottom: 25px; color: #2c3e50; }
        .quote-summary { background-color: #ffffff; border: 1px solid #e8edf3; border-radius: 6px; padding: 30px; margin: 30px 0; }
        .quote-header { border-bottom: 2px solid #3498db; padding-bottom: 15px; margin-bottom: 20px; }
        .quote-number { font-size: 16px; color: #7f8c8d; margin-bottom: 5px; }
        .project-title { font-size: 24px; font-weight: 600; color: #2c3e50; margin: 0; }
        .project-description { color: #5a6c7d; margin: 15px 0 0 0; font-size: 15px; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 25px 0; }
        .detail-item { }
        .detail-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; letter-spacing: 0.5px; }
        .detail-value { font-size: 16px; color: #2c3e50; font-weight: 500; }
        .total-section { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 25px; margin: 30px 0; text-align: center; }
        .total-label { font-size: 14px; color: #6c757d; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .total-value { font-size: 36px; font-weight: 600; color: #2c3e50; }
        .cta-section { text-align: center; margin: 35px 0; }
        .cta-button { display: inline-block; background-color: #3498db; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 5px; font-weight: 600; font-size: 16px; transition: background-color 0.3s; }
        .cta-button:hover { background-color: #2980b9; }
        .validity-section { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 20px; margin: 25px 0; }
        .validity-section strong { color: #856404; }
        .included-section { margin: 30px 0; }
        .included-section h3 { color: #2c3e50; font-size: 18px; margin-bottom: 15px; }
        .included-list { list-style: none; padding: 0; }
        .included-list li { color: #5a6c7d; margin: 8px 0; padding-left: 20px; position: relative; }
        .included-list li:before { content: "✓"; color: #27ae60; font-weight: bold; position: absolute; left: 0; }
        .contact-section { background-color: #f8f9fa; border-radius: 6px; padding: 25px; margin: 30px 0; }
        .contact-section h3 { margin: 0 0 15px 0; color: #2c3e50; font-size: 18px; }
        .contact-info { color: #5a6c7d; margin: 8px 0; }
        .closing { margin: 35px 0 20px 0; color: #2c3e50; }
        .signature { font-weight: 600; color: #2c3e50; }
        .footer { background-color: #ecf0f1; padding: 25px; text-align: center; border-top: 1px solid #bdc3c7; }
        .footer p { margin: 5px 0; color: #7f8c8d; font-size: 14px; }
        .footer .company-name { font-weight: 600; color: #2c3e50; }
        @media (max-width: 600px) {
            .details-grid { grid-template-columns: 1fr; }
            .content { padding: 25px 20px; }
            .header { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KOLMO CONSTRUCTION</h1>
            <p>Professional Construction Services</p>
        </div>
        
        <div class="content">
            <div class="greeting">Dear ${quote.customerName || 'Valued Client'},</div>
            
            <p>Thank you for requesting a quote for your construction project. We have carefully reviewed your requirements and are pleased to provide you with the following detailed proposal.</p>
            
            <div class="quote-summary">
                <div class="quote-header">
                    <div class="quote-number">Quote Reference: ${quote.quoteNumber}</div>
                    <div class="project-title">${quote.title}</div>
                    ${quote.description ? `<div class="project-description">${quote.description}</div>` : ''}
                </div>
                
                <div class="details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Project Type</div>
                        <div class="detail-value">${quote.projectType}</div>
                    </div>
                    ${quote.location ? `
                    <div class="detail-item">
                        <div class="detail-label">Project Location</div>
                        <div class="detail-value">${quote.location}</div>
                    </div>
                    ` : ''}
                    ${quote.estimatedStartDate ? `
                    <div class="detail-item">
                        <div class="detail-label">Estimated Start Date</div>
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

            <div class="total-section">
                <div class="total-label">Total Project Cost</div>
                <div class="total-value">${formatCurrency(quote.total)}</div>
            </div>

            <div class="cta-section">
                <a href="${quoteLink}" class="cta-button">View Complete Quote Details</a>
            </div>

            <div class="validity-section">
                <strong>Important:</strong> This quote is valid until <strong>${formatDate(quote.validUntil)}</strong>. 
                Please review and confirm your acceptance by this date to secure your project scheduling and pricing.
            </div>

            <div class="included-section">
                <h3>Your Quote Includes:</h3>
                <ul class="included-list">
                    <li>Comprehensive materials and labor breakdown</li>
                    <li>Professional project timeline and milestones</li>
                    <li>Detailed scope of work documentation</li>
                    <li>All permits and regulatory compliance</li>
                    <li>Quality assurance and warranty coverage</li>
                    <li>Project management and coordination</li>
                </ul>
            </div>

            <div class="contact-section">
                <h3>Questions or Need Clarification?</h3>
                <div class="contact-info">Our project team is available to discuss any aspect of your quote and answer your questions.</div>
                <div class="contact-info"><strong>Email:</strong> info@kolmo.io</div>
                <div class="contact-info"><strong>Phone:</strong> (555) 123-4567</div>
                <div class="contact-info"><strong>Business Hours:</strong> Monday - Friday, 8:00 AM - 6:00 PM</div>
            </div>

            <div class="closing">
                <p>We appreciate the opportunity to work with you and look forward to bringing your construction project to life with our commitment to quality, craftsmanship, and professional service.</p>
            </div>
            
            <div class="signature">
                Sincerely,<br>
                The Kolmo Construction Team
            </div>
        </div>
        
        <div class="footer">
            <p class="company-name">KOLMO CONSTRUCTION SERVICES</p>
            <p>Licensed • Bonded • Insured</p>
            <p>www.kolmo.io | info@kolmo.io | (555) 123-4567</p>
        </div>
    </div>
</body>
</html>`;

      const emailText = `
KOLMO CONSTRUCTION
Professional Construction Services

Dear ${quote.customerName || 'Valued Client'},

Thank you for requesting a quote for your construction project. We have carefully reviewed your requirements and are pleased to provide you with the following detailed proposal.

QUOTE DETAILS:
Quote Reference: ${quote.quoteNumber}
Project: ${quote.title}
Project Type: ${quote.projectType}
Total Project Cost: ${formatCurrency(quote.total)}
Quote Valid Until: ${formatDate(quote.validUntil)}

View your complete quote and detailed breakdown:
${quoteLink}

YOUR QUOTE INCLUDES:
• Comprehensive materials and labor breakdown
• Professional project timeline and milestones
• Detailed scope of work documentation
• All permits and regulatory compliance
• Quality assurance and warranty coverage
• Project management and coordination

IMPORTANT: This quote is valid until ${formatDate(quote.validUntil)}. Please review and confirm your acceptance by this date to secure your project scheduling and pricing.

QUESTIONS OR NEED CLARIFICATION?
Our project team is available to discuss any aspect of your quote and answer your questions.

Email: info@kolmo.io
Phone: (555) 123-4567
Business Hours: Monday - Friday, 8:00 AM - 6:00 PM

We appreciate the opportunity to work with you and look forward to bringing your construction project to life with our commitment to quality, craftsmanship, and professional service.

Sincerely,
The Kolmo Construction Team

KOLMO CONSTRUCTION SERVICES
Licensed • Bonded • Insured
www.kolmo.io | info@kolmo.io | (555) 123-4567
`;

      return await sendEmail({
        to: quote.customerEmail,
        subject: `Your Project Quote #${quote.quoteNumber} from Kolmo Construction`,
        text: emailText,
        html: emailHtml,
        from: 'projects@kolmo.io',
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
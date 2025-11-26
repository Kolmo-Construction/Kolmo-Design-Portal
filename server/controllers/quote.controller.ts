import { Request, Response } from "express";
import { QuoteRepository } from "../storage/repositories/quote.repository";
import { QuoteAnalyticsRepository } from "../storage/repositories/quote-analytics.repository";
import { createInsertSchema } from "drizzle-zod";
import { quotes, quoteLineItems, quoteResponses } from "@shared/schema";
import { uploadToR2, deleteFromR2 } from "../r2-upload";
import { z } from "zod";
import { sendEmail } from "../email";
import { initializeQuoteChat } from "../stream-chat";
import fs from 'fs';
import path from 'path';

const lineItemForCreateSchema = z.object({
  category: z.string(),
  description: z.string(),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
  unitPrice: z.union([z.string(), z.number()]),
  discountPercentage: z.union([z.string(), z.number()]).optional(),
  discountAmount: z.union([z.string(), z.number()]).optional(),
  total: z.union([z.string(), z.number()]),
});

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
  // Override percentage fields to accept numbers and convert to strings, handling NaN values
  downPaymentPercentage: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && isFinite(num) ? num.toString() : '0';
  }),
  milestonePaymentPercentage: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && isFinite(num) ? num.toString() : '0';
  }),
  finalPaymentPercentage: z.union([z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined || val === null) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return !isNaN(num) && isFinite(num) ? num.toString() : '0';
  }),
  // Override other decimal fields to accept numbers and convert to strings
  subtotal: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  discountPercentage: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  discountAmount: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  discountedSubtotal: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  taxRate: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  taxAmount: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  total: z.union([z.number(), z.string()]).optional().transform((val) => val !== undefined ? val.toString() : undefined),
  // Add lineItems array to the schema
  lineItems: z.array(lineItemForCreateSchema).optional(),
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
  private analyticsRepository: QuoteAnalyticsRepository;

  constructor() {
    this.quoteRepository = new QuoteRepository();
    this.analyticsRepository = new QuoteAnalyticsRepository();
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
      console.log("[CREATE QUOTE] Raw request body lineItems:", JSON.stringify(req.body.lineItems, null, 2));
      console.log("[CREATE QUOTE] lineItems count:", req.body.lineItems?.length || 0);
      
      const validatedData = createQuoteSchema.parse(req.body);
      
      console.log("[CREATE QUOTE] After Zod validation lineItems:", JSON.stringify(validatedData.lineItems, null, 2));
      console.log("[CREATE QUOTE] After validation lineItems count:", validatedData.lineItems?.length || 0);
      
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
      console.log("[deleteQuote] Route hit with params:", req.params);
      const quoteId = parseInt(req.params.id);
      console.log("[deleteQuote] Parsed quote ID:", quoteId);
      if (isNaN(quoteId)) {
        console.log("[deleteQuote] Invalid quote ID, returning 400");
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      console.log("[deleteQuote] Calling repository.deleteQuote...");
      const success = await this.quoteRepository.deleteQuote(quoteId);
      console.log("[deleteQuote] Repository returned:", success);
      if (!success) {
        console.log("[deleteQuote] Quote not found or delete failed, returning 404");
        return res.status(404).json({ error: "Quote not found" });
      }

      console.log("[deleteQuote] Delete successful, returning 204");
      res.status(204).send();
    } catch (error) {
      console.error("[deleteQuote] Error deleting quote:", error);
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

      // Create initial analytics record for this quote (even with 0 views)
      try {
        await this.analyticsRepository.trackEvent({
          quoteId,
          event: 'quote_sent',
          eventData: {
            quoteNumber: quoteDetails.quoteNumber,
            customerName: quoteDetails.customerName,
            customerEmail: quoteDetails.customerEmail
          }
        });
        console.log(`[QuoteController] Analytics record created for quote ${quoteDetails.quoteNumber}`);
      } catch (analyticsError) {
        console.warn("[QuoteController] Failed to create analytics record:", analyticsError);
        // Continue with quote sending even if analytics fails
      }

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

      // Fetch quote media (photo gallery)
      const quoteMedia = await this.quoteRepository.getQuoteMedia(quote.id);
      console.log(`[sendQuoteEmail] Found ${quoteMedia.length} photos for quote ${quote.id}`);

      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Quote - ${quote.quoteNumber}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            margin: 0; 
            padding: 0; 
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; 
            background-color: #f5f5f5; 
            line-height: 1.6; 
            color: #3d4552;
        }
        
        .email-wrapper { 
            background-color: #f5f5f5; 
            padding: 20px 0; 
            min-height: 100vh; 
        }
        
        .container { 
            max-width: 680px; 
            margin: 0 auto; 
            background-color: #ffffff; 
            border-radius: 12px; 
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(61, 69, 82, 0.1);
        }
        
        .header { 
            background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%);
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center; 
            position: relative;
        }
        
        .header::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: #db973c;
        }
        
        .logo-section {
            margin-bottom: 20px;
        }
        
        .logo {
            width: 120px;
            height: 80px;
            margin: 0 auto 15px;
            display: block;
        }
        
        .company-name { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 700; 
            letter-spacing: 1.5px; 
            text-transform: uppercase;
        }
        
        .tagline { 
            margin: 8px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9; 
            font-weight: 300; 
            letter-spacing: 0.5px;
        }
        
        .content { 
            padding: 45px 35px; 
            color: #3d4552; 
        }
        
        .greeting { 
            font-size: 20px; 
            margin-bottom: 30px; 
            color: #3d4552; 
            font-weight: 500;
        }
        
        .intro-text {
            font-size: 16px;
            line-height: 1.7;
            margin-bottom: 35px;
            color: #4a6670;
        }
        
        .quote-card { 
            background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
            border: 2px solid #db973c; 
            border-radius: 12px; 
            padding: 35px; 
            margin: 35px 0; 
            position: relative;
            overflow: hidden;
        }
        
        .quote-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #db973c 0%, #4a6670 100%);
        }
        
        .quote-header { 
            border-bottom: 2px solid #f5f5f5; 
            padding-bottom: 20px; 
            margin-bottom: 25px; 
        }
        
        .quote-number { 
            font-size: 14px; 
            color: #4a6670; 
            margin-bottom: 8px; 
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 1px;
        }
        
        .project-title { 
            font-size: 26px; 
            font-weight: 700; 
            color: #3d4552; 
            margin: 0; 
            line-height: 1.3;
        }
        
        .project-description { 
            color: #4a6670; 
            margin: 18px 0 0 0; 
            font-size: 16px; 
            line-height: 1.6;
        }
        
        .details-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
            gap: 25px; 
            margin: 30px 0; 
        }
        
        .detail-item {
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #db973c;
        }
        
        .detail-label { 
            font-size: 12px; 
            color: #4a6670; 
            text-transform: uppercase; 
            font-weight: 700; 
            margin-bottom: 8px; 
            letter-spacing: 1px; 
        }
        
        .detail-value { 
            font-size: 18px; 
            color: #3d4552; 
            font-weight: 600; 
        }
        
        .total-section { 
            background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%);
            color: #ffffff;
            border-radius: 12px; 
            padding: 35px; 
            margin: 40px 0; 
            text-align: center; 
            position: relative;
        }
        
        .total-section::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #db973c, #3d4552, #db973c);
            border-radius: 14px;
            z-index: -1;
        }
        
        .total-label { 
            font-size: 16px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
            font-weight: 600;
            opacity: 0.9;
        }
        
        .total-value { 
            font-size: 42px; 
            font-weight: 800; 
            color: #ffffff; 
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .cta-section { 
            text-align: center; 
            margin: 45px 0; 
        }
        
        .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #db973c 0%, #c8852f 100%);
            color: #ffffff; 
            text-decoration: none; 
            padding: 18px 40px; 
            border-radius: 50px; 
            font-weight: 700; 
            font-size: 16px; 
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(219, 151, 60, 0.3);
        }
        
        .cta-button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(219, 151, 60, 0.4);
        }
        
        .validity-section { 
            background: linear-gradient(135deg, #fff8e7 0%, #fef3d9 100%);
            border: 2px solid #db973c; 
            border-radius: 12px; 
            padding: 25px; 
            margin: 35px 0; 
            position: relative;
        }
        
        .validity-section::before {
            content: '⚠';
            position: absolute;
            top: -15px;
            left: 25px;
            background: #db973c;
            color: #ffffff;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }
        
        .validity-section strong { 
            color: #3d4552; 
            font-weight: 700;
        }
        
        .included-section { 
            margin: 40px 0; 
            background: #f5f5f5;
            border-radius: 12px;
            padding: 30px;
        }
        
        .included-section h3 { 
            color: #3d4552; 
            font-size: 20px; 
            margin: 0 0 20px 0; 
            font-weight: 700;
            text-align: center;
        }
        
        .included-list { 
            list-style: none; 
            padding: 0; 
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 12px;
        }
        
        .included-list li { 
            color: #4a6670; 
            margin: 0; 
            padding: 15px 15px 15px 45px; 
            position: relative; 
            background: #ffffff;
            border-radius: 8px;
            border-left: 4px solid #db973c;
            font-size: 15px;
            line-height: 1.5;
        }
        
        .included-list li::before { 
            content: "✓"; 
            color: #db973c; 
            font-weight: 900; 
            position: absolute; 
            left: 18px; 
            font-size: 16px;
            top: 15px;
        }
        
        .contact-section { 
            background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%);
            color: #ffffff;
            border-radius: 12px; 
            padding: 35px; 
            margin: 40px 0; 
        }
        
        .contact-section h3 { 
            margin: 0 0 20px 0; 
            color: #ffffff; 
            font-size: 20px; 
            text-align: center;
            font-weight: 700;
        }
        
        .contact-info { 
            color: rgba(255, 255, 255, 0.9); 
            margin: 12px 0; 
            font-size: 16px;
            text-align: center;
        }
        
        .contact-info strong {
            color: #db973c;
        }
        
        .contact-info .email-link {
            color: rgba(255, 255, 255, 0.7);
            text-decoration: none;
        }
        
        .closing { 
            margin: 40px 0 25px 0; 
            color: #3d4552; 
            font-size: 16px;
            line-height: 1.7;
            text-align: center;
            font-style: italic;
        }
        
        .signature { 
            font-weight: 700; 
            color: #3d4552; 
            text-align: center;
            font-size: 18px;
            margin-top: 30px;
        }
        
        .footer { 
            background: linear-gradient(135deg, #3d4552 0%, #4a6670 100%);
            color: #ffffff;
            padding: 35px; 
            text-align: center; 
        }
        
        .footer p { 
            margin: 8px 0; 
            font-size: 14px; 
            opacity: 0.8;
        }
        
        .footer .company-name { 
            font-weight: 700; 
            color: #db973c; 
            font-size: 16px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .footer .accent-line {
            width: 60px;
            height: 3px;
            background: #db973c;
            margin: 20px auto;
            border-radius: 2px;
        }
        
        @media (max-width: 600px) {
            .details-grid { grid-template-columns: 1fr; }
            .content { padding: 30px 25px; }
            .header { padding: 30px 20px; }
            .total-value { font-size: 36px; }
            .company-name { font-size: 24px; }
            .included-list { grid-template-columns: 1fr; }
        }
        
        /* Photo Gallery Styles */
        .photo-gallery-section {
            margin: 30px 0;
            padding: 25px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .photo-gallery-title {
            font-size: 20px;
            font-weight: 700;
            color: #3d4552;
            margin: 0 0 20px 0;
            text-align: center;
        }
        
        .photo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .photo-item {
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .photo-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        
        .photo-caption {
            padding: 12px;
            font-size: 14px;
            color: #4b5563;
            text-align: center;
            font-style: italic;
        }
        
        .photo-category {
            padding: 8px 12px;
            background: #db973c;
            color: white;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        @media (max-width: 600px) {
            .photo-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <div class="logo-section">
                    <img src="cid:kolmo-logo" alt="Kolmo Construction" class="logo" style="width: 150px; height: auto; display: block; margin: 0 auto 15px;" />
                </div>
                <h1 class="company-name">Kolmo Construction</h1>
                <p class="tagline">Excellence in Every Build</p>
            </div>
        
            <div class="content">
                <div class="greeting">Dear ${quote.customerName || 'Valued Client'},</div>
                
                <div class="intro-text">
                    Thank you for choosing Kolmo Construction for your project needs. We have carefully reviewed your requirements and are pleased to present this comprehensive proposal tailored specifically for your construction project.
                </div>
                
                <div class="quote-card">
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

                <!-- Photo Gallery Section -->
                ${quoteMedia.length > 0 ? `
                <div class="photo-gallery-section">
                    <h3 class="photo-gallery-title">Project Gallery</h3>
                    <div class="photo-grid">
                        ${quoteMedia.map(photo => `
                            <div class="photo-item">
                                <div class="photo-category">${photo.category || 'Gallery'}</div>
                                <img src="${photo.mediaUrl}" alt="${photo.caption || 'Project Photo'}" />
                                ${photo.caption ? `<div class="photo-caption">${photo.caption}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="total-section">
                    <div class="total-label">Total Investment</div>
                    <div class="total-value">${formatCurrency(quote.total)}</div>
                </div>

                <div class="cta-section">
                    <a href="${quoteLink}" class="cta-button">View Complete Proposal</a>
                </div>

                <div class="validity-section">
                    <strong>Quote Validity:</strong> This proposal is valid until <strong>${formatDate(quote.validUntil)}</strong>. 
                    Please review and confirm your acceptance by this date to secure your project scheduling and locked-in pricing.
                </div>

                <div class="included-section">
                    <h3>What's Included in Your Quote</h3>
                    <ul class="included-list">
                        <li>Comprehensive materials and labor breakdown</li>
                        <li>Professional project timeline with milestones</li>
                        <li>Detailed scope of work documentation</li>
                        <li>All permits and regulatory compliance</li>
                        <li>Quality assurance and warranty coverage</li>
                        <li>Dedicated project management</li>
                        <li>Progress tracking and regular updates</li>
                        <li>Post-completion support and maintenance guidance</li>
                    </ul>
                </div>

                <div class="contact-section">
                    <h3>Ready to Discuss Your Project?</h3>
                    <div class="contact-info">Our experienced project consultants are standing by to answer your questions and guide you through the next steps.</div>
                    <div class="contact-info"><strong>Email:</strong> <span class="email-link">projects@kolmo.io</span></div>
                    <div class="contact-info"><strong>Phone:</strong> (206) 410-5100</div>
                    <div class="contact-info"><strong>Hours:</strong> Monday - Friday, 7:00 AM - 5:00 PM PST</div>
                </div>

                <div class="closing">
                    We appreciate the opportunity to partner with you on this exciting project. Our commitment to excellence, superior craftsmanship, and client satisfaction drives everything we do.
                </div>
                
                <div class="signature">
                    With appreciation,<br>
                    The Kolmo Construction Team
                </div>
            </div>
            
            <div class="footer">
                <p class="company-name">Kolmo Construction</p>
                <div class="accent-line"></div>
                <p>Licensed • Bonded • Insured</p>
                <p>Building Excellence Since 2020</p>
                <p>www.kolmo.io | <span style="color: rgba(255, 255, 255, 0.7);">projects@kolmo.io</span> | (206) 410-5100</p>
                <p style="font-size: 12px; margin-top: 15px; opacity: 0.7;">This email was sent to ${quote.customerEmail}. All quotes are confidential and proprietary.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

      const emailText = `
═══════════════════════════════════════════════════════════════════════════════
KOLMO CONSTRUCTION
Excellence in Every Build
═══════════════════════════════════════════════════════════════════════════════

Dear ${quote.customerName || 'Valued Client'},

Thank you for choosing Kolmo Construction for your project needs. We have carefully reviewed your requirements and are pleased to present this comprehensive proposal tailored specifically for your construction project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT PROPOSAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quote Reference: ${quote.quoteNumber}
Project Title: ${quote.title}
Project Type: ${quote.projectType}
${quote.location ? `Location: ${quote.location}` : ''}
${quote.estimatedStartDate ? `Estimated Start: ${formatDate(quote.estimatedStartDate)}` : ''}
${quote.estimatedCompletionDate ? `Estimated Completion: ${formatDate(quote.estimatedCompletionDate)}` : ''}

TOTAL INVESTMENT: ${formatCurrency(quote.total)}

➤ View your complete proposal and detailed breakdown:
${quoteLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S INCLUDED IN YOUR QUOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Comprehensive materials and labor breakdown
✓ Professional project timeline with milestones  
✓ Detailed scope of work documentation
✓ All permits and regulatory compliance
✓ Quality assurance and warranty coverage
✓ Dedicated project management
✓ Progress tracking and regular updates
✓ Post-completion support and maintenance guidance

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT NOTICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ QUOTE VALIDITY: This proposal is valid until ${formatDate(quote.validUntil)}
Please review and confirm your acceptance by this date to secure your project scheduling and locked-in pricing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  
READY TO DISCUSS YOUR PROJECT?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Our experienced project consultants are standing by to answer your questions and guide you through the next steps.

Email: projects@kolmo.io
Phone: (555) 123-KOLMO  
Hours: Monday - Friday, 8:00 AM - 6:00 PM PST

We appreciate the opportunity to partner with you on this exciting project. Our commitment to excellence, superior craftsmanship, and client satisfaction drives everything we do.

With appreciation,
The Kolmo Construction Team

═══════════════════════════════════════════════════════════════════════════════
KOLMO CONSTRUCTION
Licensed • Bonded • Insured
Building Excellence Since 2020
www.kolmo.io | projects@kolmo.io | (555) 123-KOLMO

This email was sent to ${quote.customerEmail}. All quotes are confidential and proprietary.
═══════════════════════════════════════════════════════════════════════════════
`;

      // Read the logo file and convert to base64
      let logoAttachment = null;
      try {
        const logoPath = path.join(process.cwd(), 'public', 'assets', 'kolmo-logo.png');
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        
        logoAttachment = {
          content: logoBase64,
          filename: 'kolmo-logo.png',
          type: 'image/png',
          disposition: 'inline',
          content_id: 'kolmo-logo'
        };
      } catch (error) {
        console.error('Failed to read logo file:', error);
      }

      return await sendEmail({
        to: quote.customerEmail,
        subject: `Your Project Quote #${quote.quoteNumber} from Kolmo Construction`,
        text: emailText,
        html: emailHtml,
        from: 'projects@kolmo.io',
        fromName: 'Kolmo Construction',
        attachments: logoAttachment ? [logoAttachment] : undefined
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
      // Use mediaId parameter to match the route definition
      const mediaId = parseInt(req.params.mediaId || req.params.imageId);
      if (isNaN(mediaId)) {
        return res.status(400).json({ error: "Invalid media ID" });
      }

      const success = await this.quoteRepository.deleteQuoteImage(mediaId);
      if (!success) {
        return res.status(404).json({ error: "Media not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting media:", error);
      res.status(500).json({ error: "Failed to delete media" });
    }
  }

  async getQuoteMedia(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      const media = await this.quoteRepository.getQuoteMedia(quoteId);
      res.status(200).json(media);
    } catch (error) {
      console.error("Error fetching quote media:", error);
      res.status(500).json({ error: "Failed to fetch quote media" });
    }
  }

  async updateQuoteMedia(req: Request, res: Response) {
    try {
      const mediaId = parseInt(req.params.mediaId);
      const { caption, category, sortOrder } = req.body;
      
      if (isNaN(mediaId)) {
        return res.status(400).json({ error: "Invalid media ID" });
      }

      const updatedMedia = await this.quoteRepository.updateQuoteMedia(mediaId, {
        caption,
        category,
        sortOrder
      });
      
      if (!updatedMedia) {
        return res.status(404).json({ error: "Media not found" });
      }

      res.status(200).json(updatedMedia);
    } catch (error) {
      console.error("Error updating quote media:", error);
      res.status(500).json({ error: "Failed to update quote media" });
    }
  }

  async uploadQuotePhoto(req: Request, res: Response) {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ error: "Invalid quote ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { caption } = req.body;
      const category = req.query.category as string || 'gallery';
      console.log(`[uploadQuotePhoto] Received - caption: ${caption}, category: ${category}`);
      
      // Upload file to R2 storage
      const uploadResult = await uploadToR2({
        buffer: req.file.buffer,
        fileName: req.file.originalname,
        mimetype: req.file.mimetype,
        path: `quotes/${quoteId}/photos`,
      });
      
      // Create media record
      const mediaData = {
        url: uploadResult.url,
        type: 'image',
        caption: caption || '',
        category: category || 'gallery',
        uploadedById: (req as any).user?.id || 1,
      };
      console.log(`[uploadQuotePhoto] Saving with category: ${mediaData.category}`);

      const media = await this.quoteRepository.uploadQuoteImage(quoteId, mediaData);
      
      res.status(201).json({
        message: "Photo uploaded successfully",
        media
      });
    } catch (error) {
      console.error("Error uploading quote photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
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
        downPaymentPercentage: z.string().optional(),
        milestonePaymentPercentage: z.string().optional(),
        finalPaymentPercentage: z.string().optional(),
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
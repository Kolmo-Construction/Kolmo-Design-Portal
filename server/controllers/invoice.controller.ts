import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
// Updated import path for the aggregated storage object
import { storage } from '../storage/index';
// Import specific types from the new types file
import { InvoiceWithPayments } from '../storage/types';
import {
  insertInvoiceSchema,
  insertPaymentSchema,
  User, // Keep User type for req.user casting
} from '../../shared/schema';
import { HttpError } from '../errors';
// import Big from 'big.js'; // Keep if using Big.js

// --- Zod Schemas for API Input Validation (Unchanged) ---

const positiveNumericString = z.string().refine(
  (val) => {
    // Check that it's a valid numeric string with at most 2 decimal places
    return /^\d+(\.\d{1,2})?$/.test(val) && parseFloat(val) > 0;
  },
  { message: "Amount must be a positive number with at most 2 decimal places." }
);

const invoiceCreateSchema = insertInvoiceSchema.omit({ /* ... */ }).extend({
  amount: positiveNumericString,
  dueDate: z.string().datetime({ message: 'Invalid due date format.' }),
});

const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  amount: positiveNumericString.optional(),
  dueDate: z.string().datetime({ message: 'Invalid due date format.' }).optional(),
});

const paymentRecordSchema = insertPaymentSchema.omit({ /* ... */ }).extend({
  amount: positiveNumericString,
  paymentDate: z.string().datetime({ message: 'Invalid payment date format.' }).optional(),
});


// --- Controller Functions ---

/**
 * Get all invoices for a specific project.
 */
export const getInvoicesForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    // Use the nested repository: storage.invoices
    const invoices = await storage.invoices.getInvoicesForProject(projectIdNum);
    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new invoice for a project.
 */
export const createInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) { throw new HttpError(400, 'Invalid project ID parameter.'); }

    const validationResult = invoiceCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid invoice data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;

    const invoiceData = {
        ...validatedData,
        projectId: projectIdNum,
        amount: validatedData.amount, // Pass string/number as handled by repo
        dueDate: new Date(validatedData.dueDate),
        // status: handled by repo/default
    };

    // Use the nested repository: storage.invoices
    const createdInvoice = await storage.invoices.createInvoice(invoiceData);
    res.status(201).json(createdInvoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single invoice by ID.
 */
export const getInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);
    const user = req.user as User;

    if (isNaN(invoiceIdNum)) { throw new HttpError(400, 'Invalid invoice ID parameter.'); }
    if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

    // Use the nested repository: storage.invoices
    const invoice = await storage.invoices.getInvoiceById(invoiceIdNum);

    if (!invoice) { throw new HttpError(404, 'Invoice not found.'); }

    // Authorization check: Admin or associated with the project?
    let isAuthorized = user.role === 'ADMIN';
    if (!isAuthorized) {
       // Use the nested repository: storage.projects
       const canAccessProject = await storage.projects.checkUserProjectAccess(user.id, invoice.projectId);
       isAuthorized = canAccessProject;
    }

    if (!isAuthorized) { throw new HttpError(403, 'You do not have permission to view this invoice.'); }

    res.status(200).json(invoice); // Returns InvoiceWithPayments type
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing invoice.
 */
export const updateInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (isNaN(invoiceIdNum)) { throw new HttpError(400, 'Invalid invoice ID parameter.'); }

    const validationResult = invoiceUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid invoice data.', validationResult.error.flatten());
    }
    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) { throw new HttpError(400, 'No update data provided.'); }

     const updateData = {
        ...validatedData,
        ...(validatedData.amount && { amount: validatedData.amount }),
        ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
    };

    // Use the nested repository: storage.invoices
    const updatedInvoice = await storage.invoices.updateInvoice(invoiceIdNum, updateData);

    if (!updatedInvoice) { throw new HttpError(404, 'Invoice not found or update failed.'); }

    res.status(200).json(updatedInvoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Sends a draft invoice to the customer.
 */
export const sendInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (isNaN(invoiceIdNum)) {
      throw new HttpError(400, 'Invalid invoice ID parameter.');
    }

    // Import PaymentService
    const { PaymentService } = await import('../services/payment.service');
    const paymentService = new PaymentService();

    const sentInvoice = await paymentService.sendDraftInvoice(invoiceIdNum);

    if (!sentInvoice) {
      throw new HttpError(404, 'Invoice not found or could not be sent.');
    }

    res.status(200).json({
      message: 'Invoice sent successfully.',
      invoice: sentInvoice,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Downloads an invoice as a PDF.
 */
export const downloadInvoicePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (isNaN(invoiceIdNum)) {
      throw new HttpError(400, 'Invalid invoice ID.');
    }

    // Import PDF service
    const { generateInvoicePdf } = await import('../services/pdf.service');
    const pdfBuffer = await generateInvoicePdf(invoiceIdNum);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice details for viewing.
 */
export const getInvoiceDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (isNaN(invoiceIdNum)) {
      throw new HttpError(400, 'Invalid invoice ID.');
    }

    const invoice = await storage.invoices.getInvoiceById(invoiceIdNum);
    if (!invoice) {
      throw new HttpError(404, 'Invoice not found.');
    }

    // Get project details
    const project = await storage.projects.getProjectById(invoice.projectId);
    if (!project) {
      throw new HttpError(404, 'Project not found for invoice.');
    }

    res.json({
      invoice,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        address: project.address,
        city: project.city,
        state: project.state,
        zipCode: project.zipCode
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an invoice.
 */
export const deleteInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    if (isNaN(invoiceIdNum)) { throw new HttpError(400, 'Invalid invoice ID parameter.'); }

    // Use the nested repository: storage.invoices
    const success = await storage.invoices.deleteInvoice(invoiceIdNum);

    if (!success) { throw new HttpError(404, 'Invoice not found or could not be deleted.'); }

    res.status(204).send();
  } catch (error) {
     // Catch specific HttpError potentially thrown by repo (e.g., 409 if payments exist and no cascade)
     if (error instanceof HttpError) return next(error);
     next(error); // Handle generic errors
  }
};


/**
 * Record a payment against an invoice.
 */
export const recordPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    try {
        const { invoiceId } = req.params;
        const invoiceIdNum = parseInt(invoiceId, 10);
        const user = req.user as User;

        if (isNaN(invoiceIdNum)) { throw new HttpError(400, 'Invalid invoice ID parameter.'); }
        if (!user?.id) { throw new HttpError(401, 'Authentication required.'); }

        const validationResult = paymentRecordSchema.safeParse(req.body);
        if (!validationResult.success) { throw new HttpError(400, 'Invalid payment data.', validationResult.error.flatten()); }
        const validatedData = validationResult.data;

        const paymentData = {
            ...validatedData,
            invoiceId: invoiceIdNum,
            recordedBy: user.id,
            amount: validatedData.amount, // Pass string/number as handled by repo
            ...(validatedData.paymentDate && { paymentDate: new Date(validatedData.paymentDate) }),
        };

        // Use the nested repository: storage.invoices
        // The repo method handles inserting the payment (and potentially updating invoice status)
        const recordedPayment = await storage.invoices.recordPayment(paymentData);

        if (!recordedPayment) {
             throw new HttpError(404, 'Could not record payment. Invoice not found or invalid data.');
        }

        res.status(201).json(recordedPayment);

    } catch(error) {
        next(error);
    }
};
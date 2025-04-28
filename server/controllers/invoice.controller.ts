import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  insertInvoiceSchema,
  insertPaymentSchema,
  invoiceStatusEnum, // Ensure this enum is available
  User,
} from '../../shared/schema';
import { HttpError } from '../errors';
// Consider using a Decimal library for precise calculations if needed
// import Big from 'big.js';

// --- Zod Schemas for API Input Validation ---

// Base amount validation: ensure string can be parsed to positive number
// Adapt precision as needed for your currency.
const positiveNumericString = z.string().refine(
  (val) => {
    try {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    } catch {
      return false;
    }
  },
  { message: 'Must be a positive number.' }
);

// Schema for creating an invoice
const invoiceCreateSchema = insertInvoiceSchema.omit({
  id: true,
  projectId: true, // Set from route parameter
  createdAt: true,
  updatedAt: true,
  // Status likely defaults or is set based on logic
  status: true, // Let's assume status defaults to 'DRAFT' or 'SENT' on creation in storage
}).extend({
   // Expect amount as string from client for precise handling initially
  amount: positiveNumericString,
  // Ensure dueDate is received in a valid format (ISO string)
  dueDate: z.string().datetime({ message: 'Invalid due date format.' }),
  // Allow optional invoice items from client? Add here if needed.
  // items: z.array(z.object({...})).optional()
});

// Schema for updating an invoice
const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  // Allow status updates explicitly via the API if needed
  status: z.enum(invoiceStatusEnum.enumValues).optional(),
  amount: positiveNumericString.optional(),
  dueDate: z.string().datetime({ message: 'Invalid due date format.' }).optional(),
});

// Schema for recording a payment
const paymentRecordSchema = insertPaymentSchema.omit({
  id: true,
  invoiceId: true, // Set from route parameter
  recordedBy: true, // Set from authenticated user
  paymentDate: true, // Let storage set this to NOW() by default or allow client input
}).extend({
   // Expect amount as string
  amount: positiveNumericString,
  // Optionally allow client to specify payment date
  paymentDate: z.string().datetime({ message: 'Invalid payment date format.' }).optional(),
});


// --- Controller Functions ---

/**
 * Get all invoices for a specific project.
 * Assumes checkProjectAccess middleware runs before this.
 */
export const getInvoicesForProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }

    // checkProjectAccess middleware verified access
    const invoices = await storage.getInvoicesForProject(projectIdNum); // Assumes storage.getInvoicesForProject exists
    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new invoice for a project.
 * Assumes isAdmin middleware runs before this.
 */
export const createInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      throw new HttpError(400, 'Invalid project ID parameter.');
    }
    // isAdmin middleware verified access

    const validationResult = invoiceCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid invoice data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;

    // Prepare data for storage, converting types as needed by storage layer
    const invoiceData = {
        ...validatedData,
        projectId: projectIdNum,
        // Convert amount string to number or Decimal for storage
        amount: validatedData.amount, // Pass string if storage/Drizzle handles numeric conversion
        // amount: new Big(validatedData.amount).toString(), // If using Big.js string representation
        dueDate: new Date(validatedData.dueDate),
        // Set initial status if not provided by client
        status: invoiceStatusEnum.enumValues[0], // e.g., 'DRAFT' or 'SENT'
    };

    const createdInvoice = await storage.createInvoice(invoiceData); // Assumes storage.createInvoice exists
    res.status(201).json(createdInvoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single invoice by ID.
 * Requires auth, then checks if user is Admin or associated with the invoice's project.
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

    if (isNaN(invoiceIdNum)) {
      throw new HttpError(400, 'Invalid invoice ID parameter.');
    }
    if (!user?.id) {
      throw new HttpError(401, 'Authentication required.'); // Should be caught by middleware
    }

    const invoice = await storage.getInvoiceById(invoiceIdNum); // Assumes storage.getInvoiceById exists

    if (!invoice) {
      throw new HttpError(404, 'Invoice not found.');
    }

    // Authorization check: Admin or associated with the project?
    let isAuthorized = user.role === 'ADMIN';
    if (!isAuthorized) {
       // Check project association (requires a storage method)
       const canAccessProject = await storage.checkUserProjectAccess(user.id, invoice.projectId); // Assumes storage.checkUserProjectAccess exists
       isAuthorized = canAccessProject;
    }

    if (!isAuthorized) {
        throw new HttpError(403, 'You do not have permission to view this invoice.');
    }


    res.status(200).json(invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing invoice.
 * Assumes isAdmin middleware runs before this.
 */
export const updateInvoice = async (
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
    // isAdmin middleware verified access

    const validationResult = invoiceUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new HttpError(400, 'Invalid invoice data.', validationResult.error.flatten());
    }

    const validatedData = validationResult.data;
    if (Object.keys(validatedData).length === 0) {
      throw new HttpError(400, 'No update data provided.');
    }

     // Prepare data for storage, converting types as needed
     const updateData = {
        ...validatedData,
        // Convert amount string if present
        ...(validatedData.amount && { amount: validatedData.amount }), // Pass string if storage handles conversion
        // ...(validatedData.amount && { amount: new Big(validatedData.amount).toString() }), // If using Big.js
        // Convert date string if present
        ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
    };


    const updatedInvoice = await storage.updateInvoice(invoiceIdNum, updateData); // Assumes storage.updateInvoice exists

    if (!updatedInvoice) {
        throw new HttpError(404, 'Invoice not found or update failed.');
    }

    res.status(200).json(updatedInvoice);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an invoice.
 * Assumes isAdmin middleware runs before this.
 * Consider implications: delete associated payments? (Handled in storage logic)
 */
export const deleteInvoice = async (
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
    // isAdmin middleware verified access

    // Storage layer should handle deleting related payments if necessary
    const success = await storage.deleteInvoice(invoiceIdNum); // Assumes storage.deleteInvoice exists

    if (!success) {
       throw new HttpError(404, 'Invoice not found or could not be deleted.');
    }

    res.status(204).send(); // No content on successful delete
  } catch (error) {
    next(error);
  }
};


/**
 * Record a payment against an invoice.
 * Assumes isAdmin middleware runs before this.
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

        if (isNaN(invoiceIdNum)) {
            throw new HttpError(400, 'Invalid invoice ID parameter.');
        }
        if (!user?.id) {
            throw new HttpError(401, 'Authentication required.');
        }
        // isAdmin middleware verified access

        const validationResult = paymentRecordSchema.safeParse(req.body);
        if (!validationResult.success) {
            throw new HttpError(400, 'Invalid payment data.', validationResult.error.flatten());
        }

        const validatedData = validationResult.data;

        // Prepare data for storage
        const paymentData = {
            ...validatedData,
            invoiceId: invoiceIdNum,
            recordedBy: user.id,
            // Convert amount string
            amount: validatedData.amount, // Pass string if storage handles conversion
            // amount: new Big(validatedData.amount).toString(), // If using Big.js
            // Set paymentDate if provided by client, otherwise let DB default (NOW())
            ...(validatedData.paymentDate && { paymentDate: new Date(validatedData.paymentDate) }),
        };

        // Storage layer might update invoice status ('PARTIALLY_PAID', 'PAID')
        const recordedPayment = await storage.recordPayment(paymentData); // Assumes storage.recordPayment exists

        if (!recordedPayment) {
             // Could happen if invoice doesn't exist or other DB constraints
            throw new HttpError(404, 'Could not record payment. Invoice not found or invalid data.');
        }

        res.status(201).json(recordedPayment);

    } catch(error) {
        next(error);
    }
};
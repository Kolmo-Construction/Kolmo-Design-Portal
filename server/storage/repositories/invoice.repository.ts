// server/storage/repositories/invoice.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';
import { HttpError } from '../../errors';
import { InvoiceWithPayments } from '../types'; // Import shared types

// Interface for Invoice Repository
export interface IInvoiceRepository {
    getInvoicesForProject(projectId: number): Promise<schema.Invoice[]>; // Keep simple for list view?
    getAllInvoices(): Promise<schema.Invoice[]>; // Get all invoices across all projects
    getInvoiceById(invoiceId: number): Promise<InvoiceWithPayments | null>; // Fetch with payments
    getInvoiceByPaymentIntentId(paymentIntentId: string): Promise<schema.Invoice | null>; // Find invoice by Stripe payment intent ID
    createInvoice(invoiceData: Omit<schema.InsertInvoice, 'amount'> & { amount: string }): Promise<schema.Invoice | null>;
    updateInvoice(invoiceId: number, invoiceData: Partial<Omit<schema.InsertInvoice, 'id' | 'projectId'>>): Promise<schema.Invoice | null>;
    deleteInvoice(invoiceId: number): Promise<boolean>; // Consider implications for payments
    recordPayment(paymentData: schema.InsertPayment): Promise<schema.Payment | null>;
}

// Implementation
class InvoiceRepository implements IInvoiceRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    // Could enhance this to include payment status/summary if needed for list views
    async getInvoicesForProject(projectId: number): Promise<schema.Invoice[]> {
        try {
            return await this.dbOrTx.query.invoices.findMany({
                where: eq(schema.invoices.projectId, projectId),
                orderBy: [desc(schema.invoices.issueDate)],
                // Optionally add 'with: { payments: { columns: { id: true, amount: true } } }'
                // if you need payment summaries in the list view, then adjust return type.
            });
        } catch (error) {
            console.error(`Error fetching invoices for project ${projectId}:`, error);
            throw new Error('Database error while fetching invoices.');
        }
    }

    async getAllInvoices(): Promise<schema.Invoice[]> {
        try {
            return await this.dbOrTx.query.invoices.findMany({
                orderBy: [desc(schema.invoices.issueDate)],
            });
        } catch (error) {
            console.error('Error fetching all invoices:', error);
            throw new Error('Database error while fetching all invoices.');
        }
    }

    async getInvoiceById(invoiceId: number): Promise<InvoiceWithPayments | null> {
        try {
            // Fetch invoice and join all associated payments
            const invoice = await this.dbOrTx.query.invoices.findFirst({
                where: eq(schema.invoices.id, invoiceId),
                with: {
                    payments: { // Fetch related payments
                        orderBy: [asc(schema.payments.paymentDate)]
                    }
                }
            });
            // Type cast assumes 'payments' relation exists and is correctly typed
            return invoice as InvoiceWithPayments ?? null;
        } catch (error) {
            console.error(`Error fetching invoice ${invoiceId}:`, error);
            throw new Error('Database error while fetching invoice details.');
        }
    }

    async getInvoiceByPaymentIntentId(paymentIntentId: string): Promise<schema.Invoice | null> {
        try {
            const invoice = await this.dbOrTx.query.invoices.findFirst({
                where: eq(schema.invoices.stripePaymentIntentId, paymentIntentId)
            });
            return invoice || null;
        } catch (error) {
            console.error(`Error fetching invoice by payment intent ID ${paymentIntentId}:`, error);
            throw new Error('Database error while fetching invoice by payment intent ID.');
        }
    }

    async createInvoice(invoiceData: Omit<schema.InsertInvoice, 'amount'> & { amount: string }): Promise<schema.Invoice | null> {
        try {
            const result = await this.dbOrTx.insert(schema.invoices)
                .values({
                    ...invoiceData,
                    // Ensure amount is handled correctly (string/number -> numeric)
                    // Drizzle/node-postgres usually handles string representations fine
                    status: invoiceData.status ?? 'draft', // Explicitly default to draft status
                })
                .returning();

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error creating invoice:', error);
            if ((error as any).code === '23503') { // FK violation
                 throw new HttpError(400, 'Invalid project associated with the invoice.');
            }
            throw new Error('Database error while creating invoice.');
        }
    }

    async updateInvoice(invoiceId: number, invoiceData: Partial<Omit<schema.InsertInvoice, 'id' | 'projectId'>>): Promise<schema.Invoice | null> {
         if (Object.keys(invoiceData).length === 0) {
             console.warn("Update invoice called with empty data.");
             // Fetch and return current invoice data? Requires getInvoiceById logic here.
             const currentInvoice = await this.getInvoiceById(invoiceId); // Fetch full details
             return currentInvoice;
         }
         try {
            const result = await this.dbOrTx.update(schema.invoices)
                .set({
                    ...invoiceData,
                    updatedAt: new Date(),
                })
                .where(eq(schema.invoices.id, invoiceId))
                .returning();

            return result.length > 0 ? result[0] : null; // Return basic updated invoice
        } catch (error) {
            console.error(`Error updating invoice ${invoiceId}:`, error);
             if ((error as any).code === '23503') { // FK violation (e.g., changing projectId to non-existent one)
                 throw new HttpError(400, 'Invalid project associated with the invoice during update.');
            }
            throw new Error('Database error while updating invoice.');
        }
    }

    async deleteInvoice(invoiceId: number): Promise<boolean> {
        // IMPORTANT: Decide deletion strategy for associated payments.
        // Option 1: Use DB cascade delete (ON DELETE CASCADE on payments.invoiceId FK)
        // Option 2: Manually delete payments here within a transaction.
        // Option 3: Prevent deletion if payments exist.
        // Assuming Option 1 (DB Cascade) for simplicity here. If not, add transaction + payment deletion.
        try {
            const result = await this.dbOrTx.delete(schema.invoices)
                .where(eq(schema.invoices.id, invoiceId))
                .returning({ id: schema.invoices.id });

            return result.length > 0;
        } catch (error: any) {
            console.error(`Error deleting invoice ${invoiceId}:`, error);
            // Handle FK constraint if payments exist and cascade is NOT set
            if (error.code === '23503') {
                 throw new HttpError(409, 'Cannot delete invoice because associated payments exist.');
            }
            throw new Error('Database error while deleting invoice.');
        }
    }

    async recordPayment(paymentData: schema.InsertPayment): Promise<schema.Payment | null> {
        // Note: Updating the invoice status (e.g., to PAID or PARTIALLY_PAID) based on
        // the payment amount vs invoice total should ideally happen here within a transaction.
        // This requires fetching the invoice, calculating totals, and updating the invoice status.
        // For simplicity now, just insert the payment. A more robust implementation would use a transaction.

        // Basic Insert Implementation:
         try {
            const result = await this.dbOrTx.insert(schema.payments)
                .values({
                    ...paymentData,
                    // Let DB handle default paymentDate if not provided
                })
                .returning();

            return result.length > 0 ? result[0] : null;
        } catch (error: any) {
            console.error('Error recording payment:', error);
            if (error.code === '23503') { // FK violation (invoiceId or recordedBy)
                 throw new HttpError(400, 'Invalid invoice or user associated with the payment.');
            }
             throw new Error('Database error while recording payment.');
        }

        /* // More Robust Transactional Implementation (Conceptual):
        return this.dbOrTx.transaction(async (tx) => {
             // 1. Insert payment
             const paymentResult = await tx.insert(schema.payments).values(paymentData).returning();
             if (!paymentResult || paymentResult.length === 0) throw new Error("Failed to record payment.");
             const recordedPayment = paymentResult[0];

             // 2. Fetch invoice with existing payments
             const invoice = await tx.query.invoices.findFirst({
                 where: eq(schema.invoices.id, recordedPayment.invoiceId),
                 with: { payments: true }
             });
             if (!invoice) throw new Error("Associated invoice not found.");

             // 3. Calculate total paid vs invoice amount
             const totalPaid = invoice.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0); // Assumes amount is numeric/string
             const invoiceAmount = parseFloat(invoice.amount);

             // 4. Determine new invoice status
             let newStatus = schema.invoiceStatusEnum.enumValues[2]; // 'PARTIALLY_PAID'
             if (totalPaid >= invoiceAmount) {
                 newStatus = schema.invoiceStatusEnum.enumValues[3]; // 'PAID'
             } // Consider 'OVERPAID'?

             // 5. Update invoice status if changed
             if (invoice.status !== newStatus) {
                 await tx.update(schema.invoices)
                     .set({ status: newStatus, updatedAt: new Date() })
                     .where(eq(schema.invoices.id, invoice.id));
             }

             return recordedPayment; // Return the payment record itself
        });
        */
    }
}

// Export an instance for convenience
export const invoiceRepository = new InvoiceRepository();
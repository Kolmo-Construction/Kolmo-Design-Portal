// server/storage/repositories/payment.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db';

// Interface for Payment Repository
export interface IPaymentRepository {
    getAllPayments(): Promise<schema.Payment[]>;
    getPaymentsForInvoice(invoiceId: number): Promise<schema.Payment[]>;
    createPayment(paymentData: schema.InsertPayment): Promise<schema.Payment | null>;
    updatePayment(paymentId: number, paymentData: Partial<schema.InsertPayment>): Promise<schema.Payment | null>;
    deletePayment(paymentId: number): Promise<boolean>;
}

// Implementation
class PaymentRepository implements IPaymentRepository {
    private dbOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any>;

    constructor(databaseOrTx: NeonDatabase<typeof schema> | PgTransaction<any, any, any> = db) {
        this.dbOrTx = databaseOrTx;
    }

    async getAllPayments(): Promise<schema.Payment[]> {
        try {
            return await this.dbOrTx.query.payments.findMany({
                orderBy: [desc(schema.payments.paymentDate)],
            });
        } catch (error) {
            console.error('Error fetching all payments:', error);
            throw new Error('Database error while fetching all payments.');
        }
    }

    async getPaymentsForInvoice(invoiceId: number): Promise<schema.Payment[]> {
        try {
            return await this.dbOrTx.query.payments.findMany({
                where: eq(schema.payments.invoiceId, invoiceId),
                orderBy: [desc(schema.payments.paymentDate)],
            });
        } catch (error) {
            console.error(`Error fetching payments for invoice ${invoiceId}:`, error);
            throw new Error('Database error while fetching payments.');
        }
    }

    async createPayment(paymentData: schema.InsertPayment): Promise<schema.Payment | null> {
        try {
            const result = await this.dbOrTx.insert(schema.payments)
                .values(paymentData)
                .returning();

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error creating payment:', error);
            throw new Error('Database error while creating payment.');
        }
    }

    async updatePayment(paymentId: number, paymentData: Partial<schema.InsertPayment>): Promise<schema.Payment | null> {
        try {
            const result = await this.dbOrTx.update(schema.payments)
                .set(paymentData)
                .where(eq(schema.payments.id, paymentId))
                .returning();

            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error(`Error updating payment ${paymentId}:`, error);
            throw new Error('Database error while updating payment.');
        }
    }

    async deletePayment(paymentId: number): Promise<boolean> {
        try {
            const result = await this.dbOrTx.delete(schema.payments)
                .where(eq(schema.payments.id, paymentId))
                .returning();

            return result.length > 0;
        } catch (error) {
            console.error(`Error deleting payment ${paymentId}:`, error);
            throw new Error('Database error while deleting payment.');
        }
    }
}

export { PaymentRepository };
export default PaymentRepository;
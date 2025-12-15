import { db } from '../../db';
import { leads, Lead, InsertLead } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export interface ILeadRepository {
  createLead(data: InsertLead): Promise<Lead>;
  getLeadById(id: number): Promise<Lead | null>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  getLeadsBySource(source: string): Promise<Lead[]>;
  getRecentLeads(limit: number): Promise<Lead[]>;
  updateLead(id: number, data: Partial<InsertLead>): Promise<Lead | null>;
  markAsContacted(id: number): Promise<void>;
  markAsConverted(id: number, quoteId: number): Promise<void>;
  searchLeads(query: string): Promise<Lead[]>;
}

class LeadRepository implements ILeadRepository {
  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeadById(id: number): Promise<Lead | null> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || null;
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(eq(leads.status, status as any))
      .orderBy(desc(leads.detectedAt));
  }

  async getLeadsBySource(source: string): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(eq(leads.source, source as any))
      .orderBy(desc(leads.detectedAt));
  }

  async getRecentLeads(limit: number = 50): Promise<Lead[]> {
    return await db.select().from(leads)
      .orderBy(desc(leads.detectedAt))
      .limit(limit);
  }

  async updateLead(id: number, data: Partial<InsertLead>): Promise<Lead | null> {
    const [updated] = await db.update(leads)
      .set(data)
      .where(eq(leads.id, id))
      .returning();
    return updated || null;
  }

  async markAsContacted(id: number): Promise<void> {
    await db.update(leads)
      .set({
        status: 'contacted',
        contactedAt: new Date()
      })
      .where(eq(leads.id, id));
  }

  async markAsConverted(id: number, quoteId: number): Promise<void> {
    await db.update(leads)
      .set({
        status: 'converted',
        convertedToQuoteId: quoteId
      })
      .where(eq(leads.id, id));
  }

  async searchLeads(query: string): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(
        sql`${leads.name} ILIKE ${`%${query}%`} OR
            ${leads.contactInfo} ILIKE ${`%${query}%`} OR
            ${leads.contentSnippet} ILIKE ${`%${query}%`}`
      )
      .orderBy(desc(leads.confidenceScore));
  }
}

export const leadRepository = new LeadRepository();

import { db } from '../../db';
import { interviewSessions, InterviewSession, NewInterviewSession } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface IInterviewRepository {
  createSession(data: NewInterviewSession): Promise<InterviewSession>;
  getSessionById(id: number): Promise<InterviewSession | null>;
  getActiveSessionByUserId(userId: number): Promise<InterviewSession | null>;
  getUserSessions(userId: number, limit?: number): Promise<InterviewSession[]>;
  updateSession(id: number, data: Partial<NewInterviewSession>): Promise<InterviewSession | null>;
  updateQuoteDraft(id: number, quoteDraft: Record<string, any>): Promise<InterviewSession | null>;
  appendToTranscript(id: number, entry: any): Promise<InterviewSession | null>;
  completeSession(id: number): Promise<InterviewSession | null>;
  abandonSession(id: number): Promise<InterviewSession | null>;
}

class InterviewRepository implements IInterviewRepository {
  async createSession(data: NewInterviewSession): Promise<InterviewSession> {
    const [session] = await db.insert(interviewSessions).values(data).returning();
    return session;
  }

  async getSessionById(id: number): Promise<InterviewSession | null> {
    const [session] = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.id, id));
    return session || null;
  }

  async getActiveSessionByUserId(userId: number): Promise<InterviewSession | null> {
    const [session] = await db
      .select()
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.userId, userId),
          eq(interviewSessions.status, 'active')
        )
      )
      .orderBy(desc(interviewSessions.updatedAt))
      .limit(1);
    return session || null;
  }

  async getUserSessions(userId: number, limit: number = 10): Promise<InterviewSession[]> {
    return await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.createdAt))
      .limit(limit);
  }

  async updateSession(id: number, data: Partial<NewInterviewSession>): Promise<InterviewSession | null> {
    const [updated] = await db
      .update(interviewSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated || null;
  }

  async updateQuoteDraft(id: number, quoteDraft: Record<string, any>): Promise<InterviewSession | null> {
    const [updated] = await db
      .update(interviewSessions)
      .set({ quoteDraft, updatedAt: new Date() })
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated || null;
  }

  async appendToTranscript(id: number, entry: any): Promise<InterviewSession | null> {
    const session = await this.getSessionById(id);
    if (!session) return null;

    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    transcript.push(entry);

    const [updated] = await db
      .update(interviewSessions)
      .set({ transcript, updatedAt: new Date() })
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated || null;
  }

  async completeSession(id: number): Promise<InterviewSession | null> {
    const [updated] = await db
      .update(interviewSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated || null;
  }

  async abandonSession(id: number): Promise<InterviewSession | null> {
    const [updated] = await db
      .update(interviewSessions)
      .set({
        status: 'abandoned',
        updatedAt: new Date()
      })
      .where(eq(interviewSessions.id, id))
      .returning();
    return updated || null;
  }
}

export const interviewRepository = new InterviewRepository();

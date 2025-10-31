import { db } from "../../db";
import { 
  designProposals, 
  beforeAfterComparisons,
  type InsertDesignProposal,
  type InsertBeforeAfterComparison,
  type DesignProposal,
  type BeforeAfterComparison,
  type DesignProposalWithComparisons
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export class DesignProposalRepository {
  async getAllProposals() {
    try {
      const proposals = await db
        .select()
        .from(designProposals)
        .orderBy(desc(designProposals.createdAt));

      return proposals;
    } catch (error) {
      console.error("Error fetching design proposals:", error);
      return [];
    }
  }

  async getProposalById(id: number): Promise<DesignProposalWithComparisons | null> {
    try {
      const [proposal] = await db
        .select()
        .from(designProposals)
        .where(eq(designProposals.id, id));

      if (!proposal) {
        return null;
      }

      const comparisons = await db
        .select()
        .from(beforeAfterComparisons)
        .where(eq(beforeAfterComparisons.proposalId, id))
        .orderBy(beforeAfterComparisons.orderIndex);

      return {
        ...proposal,
        comparisons
      };
    } catch (error) {
      console.error("Error fetching proposal:", error);
      return null;
    }
  }

  async getProposalByToken(token: string): Promise<DesignProposalWithComparisons | null> {
    try {
      const [proposal] = await db
        .select()
        .from(designProposals)
        .where(eq(designProposals.accessToken, token));

      if (!proposal) {
        return null;
      }

      const comparisons = await db
        .select()
        .from(beforeAfterComparisons)
        .where(eq(beforeAfterComparisons.proposalId, proposal.id))
        .orderBy(beforeAfterComparisons.orderIndex);

      return {
        ...proposal,
        comparisons
      };
    } catch (error) {
      console.error("Error fetching proposal by token:", error);
      return null;
    }
  }

  async createProposal(data: InsertDesignProposal, userId: number) {
    try {
      const accessToken = uuidv4();

      const [proposal] = await db
        .insert(designProposals)
        .values({
          ...data,
          accessToken,
          createdById: userId,
        })
        .returning();

      return proposal;
    } catch (error) {
      console.error("Error creating design proposal:", error);
      throw error;
    }
  }

  async updateProposal(id: number, data: Partial<InsertDesignProposal>) {
    try {
      const [updatedProposal] = await db
        .update(designProposals)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(designProposals.id, id))
        .returning();

      return updatedProposal;
    } catch (error) {
      console.error("Error updating design proposal:", error);
      throw error;
    }
  }

  async deleteProposal(id: number) {
    try {
      await db
        .delete(designProposals)
        .where(eq(designProposals.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting design proposal:", error);
      throw error;
    }
  }

  async createComparison(data: InsertBeforeAfterComparison) {
    try {
      const [comparison] = await db
        .insert(beforeAfterComparisons)
        .values(data)
        .returning();

      return comparison;
    } catch (error) {
      console.error("Error creating comparison:", error);
      throw error;
    }
  }

  async updateComparison(id: number, data: Partial<InsertBeforeAfterComparison>) {
    try {
      const [updatedComparison] = await db
        .update(beforeAfterComparisons)
        .set(data)
        .where(eq(beforeAfterComparisons.id, id))
        .returning();

      return updatedComparison;
    } catch (error) {
      console.error("Error updating comparison:", error);
      throw error;
    }
  }

  async deleteComparison(id: number) {
    try {
      await db
        .delete(beforeAfterComparisons)
        .where(eq(beforeAfterComparisons.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting comparison:", error);
      throw error;
    }
  }

  async getComparisonsByProposalId(proposalId: number) {
    try {
      const comparisons = await db
        .select()
        .from(beforeAfterComparisons)
        .where(eq(beforeAfterComparisons.proposalId, proposalId))
        .orderBy(beforeAfterComparisons.orderIndex);

      return comparisons;
    } catch (error) {
      console.error("Error fetching comparisons:", error);
      return [];
    }
  }
}

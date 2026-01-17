import { db } from "../../db";
import {
  designProposals,
  beforeAfterComparisons,
  proposalGalleryImages,
  proposalImageComments,
  proposalImageFavorites,
  type InsertDesignProposal,
  type InsertBeforeAfterComparison,
  type InsertProposalGalleryImage,
  type InsertProposalImageComment,
  type InsertProposalImageFavorite,
  type DesignProposal,
  type BeforeAfterComparison,
  type DesignProposalWithComparisons,
  type ProposalGalleryImage,
  type ProposalImageComment,
  type ProposalImageFavorite
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
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
      console.log(`[DesignProposalRepo] Querying database for token: ${token?.substring(0, 8)}...`);

      const [proposal] = await db
        .select()
        .from(designProposals)
        .where(eq(designProposals.accessToken, token));

      if (!proposal) {
        console.log(`[DesignProposalRepo] No proposal found in database for this token`);

        // Log all proposals for debugging (first 3)
        const allProposals = await db
          .select({ id: designProposals.id, title: designProposals.title, token: designProposals.accessToken })
          .from(designProposals)
          .limit(5);
        console.log(`[DesignProposalRepo] Total proposals in database: ${allProposals.length}`);
        if (allProposals.length > 0) {
          console.log(`[DesignProposalRepo] Sample tokens: ${allProposals.map(p => `ID ${p.id}: ${p.token?.substring(0, 8)}...`).join(', ')}`);
        }

        return null;
      }

      console.log(`[DesignProposalRepo] Found proposal: ID ${proposal.id}, Title: "${proposal.title}"`);

      const comparisons = await db
        .select()
        .from(beforeAfterComparisons)
        .where(eq(beforeAfterComparisons.proposalId, proposal.id))
        .orderBy(beforeAfterComparisons.orderIndex);

      console.log(`[DesignProposalRepo] Loaded ${comparisons.length} comparisons for proposal ${proposal.id}`);

      return {
        ...proposal,
        comparisons
      };
    } catch (error) {
      console.error("[DesignProposalRepo] ERROR fetching proposal by token:", error);
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

  // Gallery Image Methods
  async getGalleryImages(proposalId: number) {
    try {
      const images = await db
        .select()
        .from(proposalGalleryImages)
        .where(eq(proposalGalleryImages.proposalId, proposalId))
        .orderBy(proposalGalleryImages.orderIndex);

      // Get comments and favorites for each image
      const imagesWithDetails = await Promise.all(
        images.map(async (image) => {
          const comments = await this.getImageComments(image.id);
          const favorites = await this.getImageFavorites(image.id);

          return {
            ...image,
            comments,
            favorites,
            commentCount: comments.length,
            favoriteCount: favorites.length,
          };
        })
      );

      return imagesWithDetails;
    } catch (error) {
      console.error("Error fetching gallery images:", error);
      return [];
    }
  }

  async createGalleryImage(data: InsertProposalGalleryImage) {
    try {
      const [image] = await db
        .insert(proposalGalleryImages)
        .values(data)
        .returning();

      return image;
    } catch (error) {
      console.error("Error creating gallery image:", error);
      throw error;
    }
  }

  async updateGalleryImage(id: number, data: Partial<InsertProposalGalleryImage>) {
    try {
      const [updatedImage] = await db
        .update(proposalGalleryImages)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(proposalGalleryImages.id, id))
        .returning();

      return updatedImage;
    } catch (error) {
      console.error("Error updating gallery image:", error);
      throw error;
    }
  }

  async deleteGalleryImage(id: number) {
    try {
      await db
        .delete(proposalGalleryImages)
        .where(eq(proposalGalleryImages.id, id));

      return true;
    } catch (error) {
      console.error("Error deleting gallery image:", error);
      throw error;
    }
  }

  // Comment Methods
  async getImageComments(imageId: number) {
    try {
      const comments = await db
        .select()
        .from(proposalImageComments)
        .where(eq(proposalImageComments.imageId, imageId))
        .orderBy(proposalImageComments.createdAt);

      return comments;
    } catch (error) {
      console.error("Error fetching comments:", error);
      return [];
    }
  }

  async createComment(data: InsertProposalImageComment) {
    try {
      const [comment] = await db
        .insert(proposalImageComments)
        .values(data)
        .returning();

      return comment;
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  }

  async deleteComment(id: number) {
    try {
      await db
        .delete(proposalImageComments)
        .where(eq(proposalImageComments.id, id));

      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  }

  // Favorite Methods
  async getImageFavorites(imageId: number) {
    try {
      const favorites = await db
        .select()
        .from(proposalImageFavorites)
        .where(eq(proposalImageFavorites.imageId, imageId));

      return favorites;
    } catch (error) {
      console.error("Error fetching favorites:", error);
      return [];
    }
  }

  async toggleFavorite(data: InsertProposalImageFavorite) {
    try {
      // Check if favorite already exists
      const existing = await db
        .select()
        .from(proposalImageFavorites)
        .where(
          and(
            eq(proposalImageFavorites.imageId, data.imageId),
            data.markedByUserId
              ? eq(proposalImageFavorites.markedByUserId, data.markedByUserId)
              : eq(proposalImageFavorites.markerEmail, data.markerEmail || '')
          )
        );

      if (existing.length > 0) {
        // Remove favorite
        await db
          .delete(proposalImageFavorites)
          .where(eq(proposalImageFavorites.id, existing[0].id));

        return { action: 'removed', favorite: null };
      } else {
        // Add favorite
        const [favorite] = await db
          .insert(proposalImageFavorites)
          .values(data)
          .returning();

        return { action: 'added', favorite };
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      throw error;
    }
  }
}

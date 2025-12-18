import { eq } from "drizzle-orm";
import { db } from "../db";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * ApprovalWorkflowService
 *
 * Provides reusable approval workflow logic for all content types
 * (progress updates, images, invoices, documents, milestones, daily logs, punch list items)
 *
 * This service prevents code duplication by centralizing the approve/reject/publish logic
 * that would otherwise need to be repeated in every controller.
 */
export class ApprovalWorkflowService {
  /**
   * Approve content and optionally publish it immediately
   *
   * @param table - Drizzle table object (e.g., progressUpdates, invoices, etc.)
   * @param id - Content ID
   * @param userId - ID of user performing the approval
   * @param publish - If true, sets visibility to 'published' immediately
   */
  async approve(
    table: any,
    id: number,
    userId: number,
    publish: boolean = false
  ): Promise<any> {
    const result = await db
      .update(table)
      .set({
        status: "approved",
        visibility: publish ? "published" : "admin_only",
        reviewedById: userId,
        reviewedAt: new Date(),
      })
      .where(eq(table.id, id))
      .returning();

    if (!result || result.length === 0) {
      throw new Error("Content not found");
    }

    return result[0];
  }

  /**
   * Reject content with optional reason
   * Content becomes admin-only and marked as rejected
   *
   * @param table - Drizzle table object
   * @param id - Content ID
   * @param userId - ID of user performing the rejection
   * @param reason - Optional rejection reason
   */
  async reject(
    table: any,
    id: number,
    userId: number,
    reason?: string
  ): Promise<any> {
    const updateData: any = {
      status: "rejected",
      visibility: "admin_only",
      reviewedById: userId,
      reviewedAt: new Date(),
    };

    // If the table has a rejectionReason field and a reason is provided, include it
    if (reason) {
      updateData.rejectionReason = reason;
    }

    const result = await db
      .update(table)
      .set(updateData)
      .where(eq(table.id, id))
      .returning();

    if (!result || result.length === 0) {
      throw new Error("Content not found");
    }

    return result[0];
  }

  /**
   * Publish content to make it visible to clients
   * Does not change approval status, only visibility
   *
   * @param table - Drizzle table object
   * @param id - Content ID
   */
  async publish(table: any, id: number): Promise<any> {
    const result = await db
      .update(table)
      .set({ visibility: "published" })
      .where(eq(table.id, id))
      .returning();

    if (!result || result.length === 0) {
      throw new Error("Content not found");
    }

    return result[0];
  }

  /**
   * Unpublish content to hide it from clients
   * Does not change approval status, only visibility
   *
   * @param table - Drizzle table object
   * @param id - Content ID
   */
  async unpublish(table: any, id: number): Promise<any> {
    const result = await db
      .update(table)
      .set({ visibility: "admin_only" })
      .where(eq(table.id, id))
      .returning();

    if (!result || result.length === 0) {
      throw new Error("Content not found");
    }

    return result[0];
  }

  /**
   * Bulk publish multiple items
   * Useful for publishing multiple content items at once
   *
   * @param table - Drizzle table object
   * @param ids - Array of content IDs
   */
  async bulkPublish(table: any, ids: number[]): Promise<number> {
    if (!ids || ids.length === 0) {
      return 0;
    }

    const result = await db
      .update(table)
      .set({ visibility: "published" })
      .where(
        // @ts-ignore - Drizzle inArray typing is complex
        eq(table.id, ids.length === 1 ? ids[0] : undefined) ||
        (ids.length > 1 && table.id)
      )
      .returning();

    return result?.length || 0;
  }

  /**
   * Bulk unpublish multiple items
   *
   * @param table - Drizzle table object
   * @param ids - Array of content IDs
   */
  async bulkUnpublish(table: any, ids: number[]): Promise<number> {
    if (!ids || ids.length === 0) {
      return 0;
    }

    const result = await db
      .update(table)
      .set({ visibility: "admin_only" })
      .where(
        // @ts-ignore - Drizzle inArray typing is complex
        eq(table.id, ids.length === 1 ? ids[0] : undefined) ||
        (ids.length > 1 && table.id)
      )
      .returning();

    return result?.length || 0;
  }
}

// Export singleton instance
export const approvalWorkflowService = new ApprovalWorkflowService();

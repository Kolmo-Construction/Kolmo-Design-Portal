import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { beforeAfterPairs } from "@shared/schema";
import { authenticateToken } from "../auth";
import { createBadRequestError, createNotFoundError } from "../errors";

export const beforeAfterRoutes = Router();

// Get all before/after pairs for a quote
beforeAfterRoutes.get('/quotes/:quoteId/before-after-pairs', authenticateToken, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      throw createBadRequestError('Invalid quote ID');
    }

    const pairs = await db
      .select()
      .from(beforeAfterPairs)
      .where(eq(beforeAfterPairs.quoteId, quoteId))
      .orderBy(beforeAfterPairs.sortOrder);

    res.json(pairs);
  } catch (error) {
    console.error('Error fetching before/after pairs:', error);
    res.status(500).json({ error: 'Failed to fetch before/after pairs' });
  }
});

// Create a new before/after pair
beforeAfterRoutes.post('/quotes/:quoteId/before-after-pairs', authenticateToken, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      throw createBadRequestError('Invalid quote ID');
    }

    const { title, description, beforeImageUrl, afterImageUrl, sortOrder } = req.body;

    if (!title || !beforeImageUrl || !afterImageUrl) {
      throw createBadRequestError('Title, before image URL, and after image URL are required');
    }

    const [pair] = await db
      .insert(beforeAfterPairs)
      .values({
        quoteId,
        title,
        description,
        beforeImageUrl,
        afterImageUrl,
        sortOrder: sortOrder || 0
      })
      .returning();

    res.status(201).json(pair);
  } catch (error) {
    console.error('Error creating before/after pair:', error);
    res.status(500).json({ error: 'Failed to create before/after pair' });
  }
});

// Update a before/after pair
beforeAfterRoutes.put('/before-after-pairs/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createBadRequestError('Invalid pair ID');
    }

    const { title, description, beforeImageUrl, afterImageUrl, sortOrder } = req.body;

    const [updatedPair] = await db
      .update(beforeAfterPairs)
      .set({
        title,
        description,
        beforeImageUrl,
        afterImageUrl,
        sortOrder
      })
      .where(eq(beforeAfterPairs.id, id))
      .returning();

    if (!updatedPair) {
      throw createNotFoundError('Before/after pair');
    }

    res.json(updatedPair);
  } catch (error) {
    console.error('Error updating before/after pair:', error);
    res.status(500).json({ error: 'Failed to update before/after pair' });
  }
});

// Delete a before/after pair
beforeAfterRoutes.delete('/before-after-pairs/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createBadRequestError('Invalid pair ID');
    }

    const result = await db
      .delete(beforeAfterPairs)
      .where(eq(beforeAfterPairs.id, id));

    if (result.rowCount === 0) {
      throw createNotFoundError('Before/after pair');
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting before/after pair:', error);
    res.status(500).json({ error: 'Failed to delete before/after pair' });
  }
});

// Bulk update sort order for before/after pairs
beforeAfterRoutes.put('/quotes/:quoteId/before-after-pairs/reorder', authenticateToken, async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      throw createBadRequestError('Invalid quote ID');
    }

    const { pairs } = req.body;
    if (!Array.isArray(pairs)) {
      throw createBadRequestError('Pairs must be an array');
    }

    // Update sort order for each pair
    const updatePromises = pairs.map((pair: any, index: number) => 
      db
        .update(beforeAfterPairs)
        .set({ sortOrder: index })
        .where(eq(beforeAfterPairs.id, pair.id))
    );

    await Promise.all(updatePromises);

    // Return updated pairs
    const updatedPairs = await db
      .select()
      .from(beforeAfterPairs)
      .where(eq(beforeAfterPairs.quoteId, quoteId))
      .orderBy(beforeAfterPairs.sortOrder);

    res.json(updatedPairs);
  } catch (error) {
    console.error('Error reordering before/after pairs:', error);
    res.status(500).json({ error: 'Failed to reorder before/after pairs' });
  }
});
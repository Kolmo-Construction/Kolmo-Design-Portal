import { Request, Response } from "express";
import { DesignProposalRepository } from "../storage/repositories/design-proposal.repository";
import {
  insertDesignProposalSchema,
  insertBeforeAfterComparisonSchema,
  insertProposalGalleryImageSchema,
  insertProposalImageCommentSchema,
  insertProposalImageFavoriteSchema
} from "@shared/schema";
import { z } from "zod";
import { uploadToR2 } from "../r2-upload";

export class DesignProposalController {
  private repository: DesignProposalRepository;

  constructor() {
    this.repository = new DesignProposalRepository();
  }

  async getAllProposals(req: Request, res: Response) {
    try {
      const proposals = await this.repository.getAllProposals();
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching design proposals:", error);
      res.status(500).json({ error: "Failed to fetch design proposals" });
    }
  }

  async getProposalById(req: Request, res: Response) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({ error: "Invalid proposal ID" });
      }

      const proposal = await this.repository.getProposalById(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  }

  async getProposalByToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      console.log(`[DesignProposal] Attempting to fetch proposal with token: ${token?.substring(0, 8)}...`);

      if (!token) {
        console.log(`[DesignProposal] ERROR: No token provided in request`);
        return res.status(400).json({ error: "Token is required" });
      }

      const proposal = await this.repository.getProposalByToken(token);
      if (!proposal) {
        console.log(`[DesignProposal] ERROR: No proposal found for token: ${token.substring(0, 8)}...`);
        return res.status(404).json({ error: "Proposal not found" });
      }

      console.log(`[DesignProposal] SUCCESS: Found proposal ID ${proposal.id} with title "${proposal.title}"`);
      res.json(proposal);
    } catch (error) {
      console.error("[DesignProposal] ERROR fetching proposal by token:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  }

  async createProposal(req: Request, res: Response) {
    try {
      const validatedData = insertDesignProposalSchema.parse(req.body);
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const proposal = await this.repository.createProposal(validatedData, userId);
      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating proposal:", error);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  }

  async updateProposal(req: Request, res: Response) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({ error: "Invalid proposal ID" });
      }

      const validatedData = insertDesignProposalSchema.partial().parse(req.body);
      const updatedProposal = await this.repository.updateProposal(proposalId, validatedData);
      
      if (!updatedProposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      res.json(updatedProposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating proposal:", error);
      res.status(500).json({ error: "Failed to update proposal" });
    }
  }

  async deleteProposal(req: Request, res: Response) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({ error: "Invalid proposal ID" });
      }

      await this.repository.deleteProposal(proposalId);
      res.json({ message: "Proposal deleted successfully" });
    } catch (error) {
      console.error("Error deleting proposal:", error);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  }

  async createComparison(req: Request, res: Response) {
    try {
      const validatedData = insertBeforeAfterComparisonSchema.parse(req.body);
      const comparison = await this.repository.createComparison(validatedData);
      res.status(201).json(comparison);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating comparison:", error);
      res.status(500).json({ error: "Failed to create comparison" });
    }
  }

  async updateComparison(req: Request, res: Response) {
    try {
      const comparisonId = parseInt(req.params.id);
      if (isNaN(comparisonId)) {
        return res.status(400).json({ error: "Invalid comparison ID" });
      }

      const validatedData = insertBeforeAfterComparisonSchema.partial().parse(req.body);
      const updatedComparison = await this.repository.updateComparison(comparisonId, validatedData);
      
      if (!updatedComparison) {
        return res.status(404).json({ error: "Comparison not found" });
      }

      res.json(updatedComparison);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating comparison:", error);
      res.status(500).json({ error: "Failed to update comparison" });
    }
  }

  async deleteComparison(req: Request, res: Response) {
    try {
      const comparisonId = parseInt(req.params.id);
      if (isNaN(comparisonId)) {
        return res.status(400).json({ error: "Invalid comparison ID" });
      }

      await this.repository.deleteComparison(comparisonId);
      res.json({ message: "Comparison deleted successfully" });
    } catch (error) {
      console.error("Error deleting comparison:", error);
      res.status(500).json({ error: "Failed to delete comparison" });
    }
  }

  // Gallery Image Methods
  async getGalleryImages(req: Request, res: Response) {
    try {
      const proposalId = parseInt(req.params.proposalId);
      if (isNaN(proposalId)) {
        return res.status(400).json({ error: "Invalid proposal ID" });
      }

      const images = await this.repository.getGalleryImages(proposalId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching gallery images:", error);
      res.status(500).json({ error: "Failed to fetch gallery images" });
    }
  }

  async createGalleryImage(req: Request, res: Response) {
    try {
      // Validate that we have a file
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const file = req.file as Express.Multer.File;
      const userId = (req.user as any)?.id;

      // Upload to R2 storage
      const uploadResult = await uploadToR2({
        fileName: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        path: 'proposal-gallery/',
      });

      // Parse body data
      const { proposalId, caption, description, uploaderName, uploaderEmail } = req.body;

      // Create image data
      const imageData = {
        proposalId: parseInt(proposalId),
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        caption: caption || null,
        description: description || null,
        uploadedByUserId: userId || null,
        uploaderName: uploaderName || null,
        uploaderEmail: uploaderEmail || null,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        orderIndex: 0, // Will be updated if needed
      };

      const image = await this.repository.createGalleryImage(imageData);
      res.status(201).json(image);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating gallery image:", error);
      res.status(500).json({ error: "Failed to create gallery image" });
    }
  }

  async updateGalleryImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      const validatedData = insertProposalGalleryImageSchema.partial().parse(req.body);
      const updatedImage = await this.repository.updateGalleryImage(imageId, validatedData);

      if (!updatedImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.json(updatedImage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating gallery image:", error);
      res.status(500).json({ error: "Failed to update gallery image" });
    }
  }

  async deleteGalleryImage(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.id);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      await this.repository.deleteGalleryImage(imageId);
      res.json({ message: "Gallery image deleted successfully" });
    } catch (error) {
      console.error("Error deleting gallery image:", error);
      res.status(500).json({ error: "Failed to delete gallery image" });
    }
  }

  // Comment Methods
  async getImageComments(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      const comments = await this.repository.getImageComments(imageId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  }

  async createComment(req: Request, res: Response) {
    try {
      const validatedData = insertProposalImageCommentSchema.parse(req.body);
      const userId = (req.user as any)?.id;

      const commentData = {
        ...validatedData,
        commentedByUserId: userId || null,
      };

      const comment = await this.repository.createComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  }

  async deleteComment(req: Request, res: Response) {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ error: "Invalid comment ID" });
      }

      await this.repository.deleteComment(commentId);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }

  // Favorite Methods
  async toggleFavorite(req: Request, res: Response) {
    try {
      const validatedData = insertProposalImageFavoriteSchema.parse(req.body);
      const userId = (req.user as any)?.id;

      const favoriteData = {
        ...validatedData,
        markedByUserId: userId || null,
      };

      const result = await this.repository.toggleFavorite(favoriteData);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error toggling favorite:", error);
      res.status(500).json({ error: "Failed to toggle favorite" });
    }
  }

  async getImageFavorites(req: Request, res: Response) {
    try {
      const imageId = parseInt(req.params.imageId);
      if (isNaN(imageId)) {
        return res.status(400).json({ error: "Invalid image ID" });
      }

      const favorites = await this.repository.getImageFavorites(imageId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  }
}

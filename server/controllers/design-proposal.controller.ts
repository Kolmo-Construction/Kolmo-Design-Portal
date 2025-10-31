import { Request, Response } from "express";
import { DesignProposalRepository } from "../storage/repositories/design-proposal.repository";
import { insertDesignProposalSchema, insertBeforeAfterComparisonSchema } from "@shared/schema";
import { z } from "zod";

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
      
      const proposal = await this.repository.getProposalByToken(token);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal by token:", error);
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
}

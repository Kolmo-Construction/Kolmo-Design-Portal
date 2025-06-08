import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

/**
 * Get payment summaries for all projects
 */
router.get('/payment-summaries', isAuthenticated, async (req, res, next) => {
  try {
    const projects = await storage.projects.getAllProjects();
    const paymentSummaries = [];

    for (const project of projects) {
      if (!project.originQuoteId) continue;

      // Get the originating quote for payment percentages
      const quote = await storage.quotes.getQuoteById(project.originQuoteId);
      if (!quote) continue;

      // Get all invoices for this project
      const invoices = await storage.invoices.getInvoicesForProject(project.id);
      
      // Calculate payment status
      const totalBudget = parseFloat(project.totalBudget?.toString() || '0');
      const downPaymentPercentage = parseFloat(quote.downPaymentPercentage?.toString() || '40');
      const milestonePaymentPercentage = parseFloat(quote.milestonePaymentPercentage?.toString() || '40');
      const finalPaymentPercentage = parseFloat(quote.finalPaymentPercentage?.toString() || '20');

      const downPaymentInvoice = invoices.find(inv => inv.invoiceType === 'down_payment');
      const milestoneInvoice = invoices.find(inv => inv.invoiceType === 'milestone');
      const finalInvoice = invoices.find(inv => inv.invoiceType === 'final');

      const downPaymentPaid = downPaymentInvoice?.status === 'paid';
      const milestonePaid = milestoneInvoice?.status === 'paid';
      const finalPaid = finalInvoice?.status === 'paid';

      // Determine next payment type and amount
      let nextPaymentType: 'milestone' | 'final' | null = null;
      let nextPaymentAmount = 0;

      if (downPaymentPaid && !milestonePaid && !milestoneInvoice) {
        nextPaymentType = 'milestone';
        nextPaymentAmount = (totalBudget * milestonePaymentPercentage) / 100;
      } else if ((milestonePaid || !milestoneInvoice) && !finalPaid && !finalInvoice) {
        nextPaymentType = 'final';
        nextPaymentAmount = (totalBudget * finalPaymentPercentage) / 100;
      }

      paymentSummaries.push({
        projectId: project.id,
        projectName: project.name,
        totalBudget,
        downPaymentPaid,
        milestonePaid,
        finalPaid,
        nextPaymentAmount,
        nextPaymentType,
        hasDownPaymentInvoice: !!downPaymentInvoice,
        hasMilestoneInvoice: !!milestoneInvoice,
        hasFinalInvoice: !!finalInvoice,
      });
    }

    res.json(paymentSummaries);
  } catch (error) {
    next(error);
  }
});

export { router as projectPaymentRoutes };
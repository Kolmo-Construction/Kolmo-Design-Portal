import { Request, Response, NextFunction } from 'express';
import { storage } from '@server/storage';

interface ClientDashboardResponse {
  projects: any[];
  recentUpdates: any[];
  unreadMessages: any[];
  pendingInvoices: any[];
  overallStats: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalInvestment: string;
  };
}

export const getClientDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Get client's assigned projects with related data
    const projects = await storage.projects.getProjectsForUser(userId.toString());
    
    // Get recent progress updates for client's projects
    const projectIds = projects.map((p: any) => p.id);
    let recentUpdates: any[] = [];
    if (projectIds.length > 0) {
      // Get updates for each project and combine them
      const updatePromises = projectIds.map(id => 
        storage.progressUpdates.getProgressUpdatesForProject(id)
      );
      const allUpdates = await Promise.all(updatePromises);
      recentUpdates = allUpdates.flat()
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    }

    // Get unread messages for client
    let unreadMessages: any[] = [];
    if (projectIds.length > 0) {
      const messagePromises = projectIds.map(id => 
        storage.messages.getMessagesForProject(id)
      );
      const allMessages = await Promise.all(messagePromises);
      unreadMessages = allMessages.flat()
        .filter((msg: any) => !msg.isRead && msg.recipientId === userId)
        .slice(0, 10);
    }

    // Get pending invoices for client's projects
    let pendingInvoices: any[] = [];
    if (projectIds.length > 0) {
      const invoicePromises = projectIds.map(id => 
        storage.invoices.getInvoicesForProject(id)
      );
      const allInvoices = await Promise.all(invoicePromises);
      pendingInvoices = allInvoices.flat()
        .filter((inv: any) => inv.status === 'pending' || inv.status === 'draft')
        .slice(0, 5);
    }

    // Calculate stats
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p: any) => p.status === 'in_progress' || p.status === 'planning').length;
    const completedProjects = projects.filter((p: any) => p.status === 'completed').length;
    const totalInvestment = projects.reduce((sum: number, p: any) => sum + Number(p.totalBudget || 0), 0);

    const dashboardData: ClientDashboardResponse = {
      projects,
      recentUpdates,
      unreadMessages,
      pendingInvoices,
      overallStats: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalInvestment: totalInvestment.toLocaleString('en-US', { 
          minimumFractionDigits: 2,
          maximumFractionDigits: 2 
        })
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    next(error);
  }
};
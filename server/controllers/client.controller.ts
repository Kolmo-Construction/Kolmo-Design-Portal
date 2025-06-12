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
    const projects = await storage.projects.getProjectsForClient(userId);
    
    // Get recent progress updates for client's projects
    const projectIds = projects.map(p => p.id);
    let recentUpdates: any[] = [];
    if (projectIds.length > 0) {
      recentUpdates = await storage.progressUpdates.getRecentUpdatesForProjects(projectIds, 10);
    }

    // Get unread messages for client
    let unreadMessages: any[] = [];
    if (projectIds.length > 0) {
      unreadMessages = await storage.messages.getUnreadMessagesForClient(userId, projectIds);
    }

    // Get pending invoices for client's projects
    let pendingInvoices: any[] = [];
    if (projectIds.length > 0) {
      pendingInvoices = await storage.invoices.getPendingInvoicesForProjects(projectIds);
    }

    // Calculate stats
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'planning').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const totalInvestment = projects.reduce((sum, p) => sum + Number(p.totalBudget || 0), 0);

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
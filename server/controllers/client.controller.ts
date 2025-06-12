import { Request, Response, NextFunction } from 'express';
import { storage } from '@server/storage';

interface ClientDashboardResponse {
  projects: any[];
  recentUpdates: any[];
  unreadMessages: any[];
  pendingInvoices: any[];
  overallStats: {
    totalProjects: number;
    completedTasks: number;
    totalTasks: number;
    avgProgress: number;
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
    
    // Enhance projects with real task counts and timeline data
    const enhancedProjects = await Promise.all(projects.map(async (project: any) => {
      // Get actual tasks for this project
      let tasks: any[] = [];
      let completedTasks = 0;
      let totalTasks = 0;
      
      try {
        // Get real tasks from storage
        tasks = await storage.tasks?.getTasksForProject(project.id) || [];
        totalTasks = tasks.length;
        
        // Count completed tasks (handle both old and new status values)
        completedTasks = tasks.filter((task: any) => 
          task.status === 'done' || task.status === 'completed'
        ).length;
      } catch (error) {
        console.log(`Tasks not available for project ${project.id}`);
      }
      
      // Create timeline from actual project milestones if available
      let timeline: any[] = [];
      try {
        const milestones = await storage.milestones?.getMilestonesForProject(project.id) || [];
        timeline = milestones.map((milestone: any) => ({
          phase: milestone.title,
          status: milestone.status,
          date: milestone.plannedDate
        }));
      } catch (error) {
        console.log(`Milestones not available for project ${project.id}`);
      }
      
      return {
        ...project,
        completedTasks,
        totalTasks,
        timeline
      };
    }));
    
    // Get recent progress updates for client's projects
    const projectIds = projects.map((p: any) => p.id);
    let recentUpdates: any[] = [];
    if (projectIds.length > 0) {
      try {
        const updatePromises = projectIds.map(id => 
          storage.progressUpdates?.getProgressUpdatesForProject(id).catch(() => [])
        );
        const allUpdates = await Promise.all(updatePromises);
        recentUpdates = allUpdates.flat()
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
      } catch (error) {
        console.log('Progress updates not available');
      }
    }

    // Get unread messages for client
    let unreadMessages: any[] = [];
    if (projectIds.length > 0) {
      try {
        const messagePromises = projectIds.map(id => 
          storage.messages?.getMessagesForProject(id).catch(() => [])
        );
        const allMessages = await Promise.all(messagePromises);
        unreadMessages = allMessages.flat()
          .filter((msg: any) => !msg.isRead && msg.recipientId === userId)
          .slice(0, 10);
      } catch (error) {
        console.log('Messages not available');
      }
    }

    // Get pending invoices for client's projects
    let pendingInvoices: any[] = [];
    if (projectIds.length > 0) {
      try {
        const invoicePromises = projectIds.map(id => 
          storage.invoices?.getInvoicesForProject(id).catch(() => [])
        );
        const allInvoices = await Promise.all(invoicePromises);
        pendingInvoices = allInvoices.flat()
          .filter((inv: any) => inv.status === 'pending' || inv.status === 'draft')
          .slice(0, 5);
      } catch (error) {
        console.log('Invoices not available');
      }
    }

    // Calculate realistic task statistics
    const totalProjects = enhancedProjects.length;
    const totalTasks = enhancedProjects.reduce((sum: number, p: any) => sum + (p.totalTasks || 0), 0);
    const completedTasks = enhancedProjects.reduce((sum: number, p: any) => sum + (p.completedTasks || 0), 0);
    const avgProgress = totalProjects > 0 
      ? enhancedProjects.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / totalProjects 
      : 0;

    const dashboardData: ClientDashboardResponse = {
      projects: enhancedProjects,
      recentUpdates,
      unreadMessages,
      pendingInvoices,
      overallStats: {
        totalProjects,
        completedTasks,
        totalTasks,
        avgProgress: Math.round(avgProgress)
      }
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    next(error);
  }
};
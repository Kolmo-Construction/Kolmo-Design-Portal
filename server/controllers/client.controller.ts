import { Request, Response, NextFunction } from 'express';
import { storage } from '@server/storage';
import { db } from '@server/db';
import { sql } from 'drizzle-orm';
import { generateStreamToken, createStreamUser } from '@server/stream-chat';

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

export const getClientInvoices = async (
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

    console.log(`[getClientInvoices] Fetching invoices for user ID: ${userId}`);

    // Use direct SQL query as workaround for repository schema issues
    let allInvoices: any[] = [];
    try {
      console.log(`[getClientInvoices] Executing SQL query for user ${userId}`);
      const result = await db.execute(sql`
        SELECT i.*, p.name as project_name
        FROM invoices i 
        INNER JOIN projects p ON i.project_id = p.id
        INNER JOIN client_projects cp ON p.id = cp.project_id
        WHERE cp.client_id = ${userId}
        ORDER BY i.issue_date DESC
      `);
      
      console.log(`[getClientInvoices] Raw query result:`, { 
        isArray: Array.isArray(result), 
        hasRows: !!(result as any).rows,
        resultType: typeof result,
        resultKeys: Object.keys(result as any),
        resultLength: Array.isArray(result) ? result.length : 'N/A'
      });
      
      // Convert QueryResult to array - result.rows contains the actual data
      const rows = (result as any).rows || [];
      console.log(`[getClientInvoices] Extracted rows:`, { rowsLength: rows.length, firstRow: rows[0] });
      
      allInvoices = rows.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        invoiceNumber: row.invoice_number,
        amount: row.amount,
        description: row.description,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        status: row.status,
        projectName: row.project_name
      }));
      
      console.log(`[getClientInvoices] Mapped invoices:`, allInvoices);
      console.log(`[getClientInvoices] Found ${allInvoices.length} invoices for client ${userId}`);
    } catch (error) {
      console.error('[getClientInvoices] Error fetching client invoices:', error);
      allInvoices = [];
    }

    console.log(`[getClientInvoices] Returning ${allInvoices.length} invoices`);
    
    // Force no caching with timestamp
    const timestamp = Date.now();
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Last-Modified', new Date().toUTCString());
    res.removeHeader('ETag'); // Remove any ETag
    
    // Add timestamp to response to ensure uniqueness
    res.json({ 
      timestamp, 
      invoices: allInvoices,
      debug: { 
        userId, 
        queryExecuted: true,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching client invoices:', error);
    next(error);
  }
};

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
        const milestones = await storage.milestones?.getMilestonesByProjectId(project.id) || [];
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

export const getClientChatToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user || user.role !== 'client') {
      res.status(403).json({ message: 'Access denied. Client role required.' });
      return;
    }

    console.log(`[getClientChatToken] Generating chat token for client: ${user.id}`);

    // Generate Stream Chat user ID for client
    const chatUserId = `client-${user.id}`;
    
    // Create or update Stream Chat user
    await createStreamUser({
      id: chatUserId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: 'user'
    });

    // Get client's projects and create channels for them
    const projects = await storage.projects.getProjectsForUser(user.id.toString());
    
    for (const project of projects) {
      try {
        const { createProjectChannel } = await import('../stream-chat');
        
        // Get the project manager/admin user for this project
        let adminUserId = 'admin-1'; // fallback
        if (project.projectManagerId) {
          adminUserId = `admin-${project.projectManagerId}`;
        } else {
          // Find any admin user if no specific project manager
          const adminUsers = await storage.users.getAllUsers();
          const adminUser = adminUsers.find(u => u.role === 'admin');
          if (adminUser) {
            adminUserId = `admin-${adminUser.id}`;
          }
        }
        
        await createProjectChannel(
          project.id.toString(),
          project.name,
          chatUserId,
          adminUserId
        );
      } catch (error) {
        // Log error but don't fail the whole request if channel creation fails
        console.error(`Failed to create channel for project ${project.id}:`, error);
      }
    }

    // Generate Stream Chat token
    const token = generateStreamToken(chatUserId);
    
    // Get Stream API key from environment
    const apiKey = process.env.STREAM_API_KEY;
    
    if (!apiKey) {
      console.error('[getClientChatToken] Stream API key not configured');
      res.status(500).json({ message: 'Chat service not available' });
      return;
    }

    console.log(`[getClientChatToken] Chat token generated successfully for client: ${user.id}`);
    
    res.json({
      apiKey,
      token,
      userId: chatUserId
    });
  } catch (error) {
    console.error('[getClientChatToken] Error generating chat token:', error);
    next(error);
  }
};
import { Request, Response, NextFunction } from 'express';
import { storage } from '@server/storage';
import { db } from '@server/db';
import { sql } from 'drizzle-orm';
import { generateStreamToken, createStreamUser } from '@server/stream-chat';
import { hashPassword, comparePasswords } from '@server/auth';
import { z } from 'zod';

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
  financialStats: {
    totalBudget: number;
    totalInvoiced: number;
    remaining: number;
    percentageUsed: number;
  };
}

export const getClientInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    console.log(`[getClientInvoices] Fetching invoices for user ID: ${userId}, role: ${userRole}`);

    // Use direct SQL query as workaround for repository schema issues
    let allInvoices: any[] = [];
    try {
      console.log(`[getClientInvoices] Executing SQL query for user ${userId}`);

      // Admins see all invoices, clients see only their published invoices
      const result = userRole === 'admin'
        ? await db.execute(sql`
            SELECT i.*, p.name as project_name
            FROM invoices i
            INNER JOIN projects p ON i.project_id = p.id
            WHERE i.status != 'draft'
            ORDER BY i.issue_date DESC
          `)
        : await db.execute(sql`
            SELECT i.*, p.name as project_name
            FROM invoices i
            INNER JOIN projects p ON i.project_id = p.id
            INNER JOIN client_projects cp ON p.id = cp.project_id
            WHERE cp.client_id = ${userId}
              AND i.status != 'draft'
              AND i.visibility = 'published'
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

export const getClientProjectImages = async (
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

    // Get client's projects
    const projects = await storage.projects.getProjectsForUser(userId.toString());
    const projectIds = projects.map((p: any) => p.id);

    if (projectIds.length === 0) {
      res.json({ images: [] });
      return;
    }

    // Fetch admin images for client's projects
    const imagesResult = await db.execute(sql`
      SELECT
        ai.*,
        p.name as project_name,
        u.first_name as uploaded_by_name
      FROM admin_images ai
      LEFT JOIN projects p ON ai.project_id = p.id
      LEFT JOIN users u ON ai.uploaded_by_id = u.id
      WHERE ai.project_id IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY ai.created_at DESC
      LIMIT 50
    `);

    const images = (imagesResult as any).rows || [];

    res.json({ images });
  } catch (error) {
    console.error('Error fetching client project images:', error);
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
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    // Get projects based on user role
    // Admins can see all projects, clients see only their assigned projects
    let projects;
    if (userRole === 'admin') {
      projects = await storage.projects.getAllProjects();
    } else {
      projects = await storage.projects.getProjectsForUser(userId.toString());
    }
    
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

        // IMPORTANT: Filter to only show published updates to clients
        // Clients should NOT see draft, pending_review, or admin_only content
        recentUpdates = allUpdates.flat()
          .filter((update: any) => !update.visibility || update.visibility === 'published')
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
          .filter((inv: any) => inv.status === 'pending')
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

    // Calculate financial statistics
    const totalBudget = enhancedProjects.reduce((sum: number, p: any) => {
      const budget = parseFloat(p.totalBudget || '0');
      return sum + budget;
    }, 0);

    // Calculate total invoiced amount from all invoices for client's projects
    // Only count non-draft invoices (pending, paid, overdue)
    // For clients, only count published invoices to match what they can see
    let totalInvoiced = 0;
    if (projectIds.length > 0) {
      try {
        const invoicePromises = projectIds.map(id =>
          storage.invoices?.getInvoicesForProject(id).catch(() => [])
        );
        const allInvoices = await Promise.all(invoicePromises);
        totalInvoiced = allInvoices.flat()
          .filter((inv: any) => {
            // Exclude draft invoices for everyone
            if (inv.status === 'draft') return false;
            // For clients, only count published invoices
            if (userRole === 'client' && inv.visibility !== 'published') return false;
            // For admins, count all non-draft invoices
            return true;
          })
          .reduce((sum: number, inv: any) => {
            const amount = parseFloat(inv.amount || '0');
            return sum + amount;
          }, 0);
      } catch (error) {
        console.log('Could not calculate total invoiced amount');
      }
    }

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
      },
      financialStats: {
        totalBudget,
        totalInvoiced,
        remaining: totalBudget - totalInvoiced,
        percentageUsed: totalBudget > 0 ? (totalInvoiced / totalBudget) * 100 : 0
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

// Validation schemas
const profileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
});

const passwordUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const getClientProjects = async (
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

    console.log(`[getClientProjects] Fetching projects for client: ${user.id}`);

    const projects = await storage.projects.getProjectsForUser(user.id.toString());
    
    res.json(projects);
  } catch (error) {
    console.error('[getClientProjects] Error fetching client projects:', error);
    next(error);
  }
};

export const updateClientProfile = async (
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

    // Validate request data
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ 
        message: 'Invalid profile data',
        errors: validation.error.flatten()
      });
      return;
    }

    const { firstName, lastName, email, phone } = validation.data;

    console.log(`[updateClientProfile] Updating profile for client: ${user.id}`);

    // Check if email is already taken by another user
    if (email !== user.email) {
      const existingUser = await storage.users.getUserByEmail(email);
      if (existingUser && existingUser.id !== user.id) {
        res.status(400).json({ message: 'Email address is already in use' });
        return;
      }
    }

    // Update user profile
    const updatedUser = await storage.users.updateUser(user.id, {
      firstName,
      lastName,
      email,
      phone: phone || null
    });

    if (!updatedUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Return updated user data (excluding sensitive information)
    const { password, magicLinkToken, magicLinkExpiry, ...safeUserData } = updatedUser;
    
    res.json({
      message: 'Profile updated successfully',
      user: safeUserData
    });
  } catch (error) {
    console.error('[updateClientProfile] Error updating client profile:', error);
    next(error);
  }
};

export const updateClientPassword = async (
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

    // Validate request data
    const validation = passwordUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ 
        message: 'Invalid password data',
        errors: validation.error.flatten()
      });
      return;
    }

    const { currentPassword, newPassword } = validation.data;

    console.log(`[updateClientPassword] Updating password for client: ${user.id}`);

    // Verify current password
    const isCurrentPasswordValid = await comparePasswords(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update user password
    const updatedUser = await storage.users.updateUser(user.id, {
      password: hashedNewPassword
    });

    if (!updatedUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('[updateClientPassword] Error updating client password:', error);
    next(error);
  }
};
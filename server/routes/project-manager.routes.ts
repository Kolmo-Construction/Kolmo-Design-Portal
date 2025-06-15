// server/routes/project-manager.routes.ts
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "../../shared/schema";

const router = Router();

// Apply authentication to all routes
router.use(isAuthenticated);

/**
 * Project Manager Dashboard Routes
 * These routes help project managers see their assigned projects and manage them effectively
 */

// GET /api/project-manager/dashboard
// Get dashboard data showing all projects assigned to the current project manager
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    // Only allow project managers and admins to access this endpoint
    if (userRole !== 'projectManager' && userRole !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Only project managers can access this dashboard.' 
      });
    }
    
    // Get all projects assigned to this project manager using direct DB query
    const assignedProjects = await db.select().from(schema.projects)
      .where(eq(schema.projects.projectManagerId, userId));
    
    // Get summary statistics for each project
    const projectsWithStats = await Promise.all(
      assignedProjects.map(async (project) => {
        const [tasks, invoices, punchListItems] = await Promise.all([
          db.select().from(schema.tasks).where(eq(schema.tasks.projectId, project.id)),
          db.select().from(schema.invoices).where(eq(schema.invoices.projectId, project.id)),
          db.select().from(schema.punchListItems).where(eq(schema.punchListItems.projectId, project.id))
        ]);
        
        const completedTasks = tasks.filter(task => task.status === 'done' || task.status === 'completed');
        const overdueTasks = tasks.filter(task => 
          task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'completed'
        );
        
        const paidInvoices = invoices.filter(invoice => invoice.status === 'paid');
        const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending' || invoice.status === 'draft');
        
        const openPunchItems = punchListItems.filter(item => item.status === 'open' || item.status === 'in_progress');
        
        return {
          ...project,
          stats: {
            totalTasks: tasks.length,
            completedTasks: completedTasks.length,
            overdueTasks: overdueTasks.length,
            taskCompletionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
            totalInvoices: invoices.length,
            paidInvoices: paidInvoices.length,
            pendingInvoices: pendingInvoices.length,
            openPunchItems: openPunchItems.length,
            totalInvoiceAmount: invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount || '0'), 0),
            paidAmount: paidInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount || '0'), 0)
          }
        };
      })
    );
    
    // Calculate overall statistics
    const overallStats = {
      totalProjects: assignedProjects.length,
      activeProjects: assignedProjects.filter(p => p.status === 'in_progress').length,
      completedProjects: assignedProjects.filter(p => p.status === 'completed').length,
      totalTasks: projectsWithStats.reduce((sum, p) => sum + p.stats.totalTasks, 0),
      totalCompletedTasks: projectsWithStats.reduce((sum, p) => sum + p.stats.completedTasks, 0),
      totalOverdueTasks: projectsWithStats.reduce((sum, p) => sum + p.stats.overdueTasks, 0),
      totalInvoiceAmount: projectsWithStats.reduce((sum, p) => sum + p.stats.totalInvoiceAmount, 0),
      totalPaidAmount: projectsWithStats.reduce((sum, p) => sum + p.stats.paidAmount, 0),
      totalOpenPunchItems: projectsWithStats.reduce((sum, p) => sum + p.stats.openPunchItems, 0)
    };
    
    res.json({
      projectManager: {
        id: userId,
        name: `${req.user!.firstName} ${req.user!.lastName}`,
        role: userRole
      },
      overallStats,
      assignedProjects: projectsWithStats,
      message: `Managing ${assignedProjects.length} project${assignedProjects.length !== 1 ? 's' : ''}`
    });
    
  } catch (error) {
    console.error('Error fetching project manager dashboard:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
});

// GET /api/project-manager/projects
// Get a simple list of projects assigned to the current project manager
router.get('/projects', async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    if (userRole !== 'projectManager' && userRole !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Only project managers can access this endpoint.' 
      });
    }
    
    const assignedProjects = await db.select().from(schema.projects)
      .where(eq(schema.projects.projectManagerId, userId));
    
    res.json({
      projects: assignedProjects,
      count: assignedProjects.length
    });
    
  } catch (error) {
    console.error('Error fetching assigned projects:', error);
    res.status(500).json({ message: 'Failed to load assigned projects' });
  }
});

// GET /api/project-manager/projects/:projectId/overview
// Get detailed overview of a specific project (only if user is the assigned manager)
router.get('/projects/:projectId/overview', async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const projectId = parseInt(req.params.projectId);
    
    if (userRole !== 'projectManager' && userRole !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Only project managers can access this endpoint.' 
      });
    }
    
    // Get the project and verify the user is assigned as manager
    const projectResult = await db.select().from(schema.projects)
      .where(eq(schema.projects.id, projectId));
    const project = projectResult[0];
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user is assigned as project manager (admins can access any project)
    if (userRole === 'projectManager' && project.projectManagerId !== userId) {
      return res.status(403).json({ 
        message: 'Access denied. You are not assigned as the manager for this project.' 
      });
    }
    
    // Get comprehensive project data using direct DB queries
    const [tasks, invoices, milestones, documents, punchListItems, clients] = await Promise.all([
      db.select().from(schema.tasks).where(eq(schema.tasks.projectId, projectId)),
      db.select().from(schema.invoices).where(eq(schema.invoices.projectId, projectId)),
      db.select().from(schema.milestones).where(eq(schema.milestones.projectId, projectId)),
      db.select().from(schema.documents).where(eq(schema.documents.projectId, projectId)),
      db.select().from(schema.punchListItems).where(eq(schema.punchListItems.projectId, projectId)),
      db.select().from(schema.clientProjects).where(eq(schema.clientProjects.projectId, projectId))
    ]);
    
    // Calculate detailed statistics
    const taskStats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'done' || t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      overdue: tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date() && 
        t.status !== 'done' && t.status !== 'completed'
      ).length
    };
    
    const invoiceStats = {
      total: invoices.length,
      draft: invoices.filter(i => i.status === 'draft').length,
      sent: invoices.filter(i => i.status === 'sent').length,
      paid: invoices.filter(i => i.status === 'paid').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      totalAmount: invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount || '0'), 0),
      paidAmount: invoices.filter((i: any) => i.status === 'paid')
        .reduce((sum: number, inv: any) => sum + parseFloat(inv.amount || '0'), 0)
    };
    
    const milestoneStats = {
      total: milestones.length,
      pending: milestones.filter(m => m.status === 'pending').length,
      completed: milestones.filter(m => m.status === 'completed').length,
      overdue: milestones.filter((m: any) => 
        m.plannedDate && new Date(m.plannedDate) < new Date() && m.status !== 'completed'
      ).length
    };
    
    const punchListStats = {
      total: punchListItems.length,
      open: punchListItems.filter(p => p.status === 'open').length,
      inProgress: punchListItems.filter(p => p.status === 'in_progress').length,
      resolved: punchListItems.filter(p => p.status === 'resolved').length,
      verified: punchListItems.filter(p => p.status === 'verified').length
    };
    
    res.json({
      project,
      clients,
      statistics: {
        tasks: taskStats,
        invoices: invoiceStats,
        milestones: milestoneStats,
        punchList: punchListStats,
        documents: {
          total: documents.length
        }
      },
      recentActivity: {
        tasks: tasks.slice(0, 5).map(t => ({
          type: 'task',
          id: t.id,
          title: t.title,
          status: t.status,
          updatedAt: t.updatedAt
        })),
        invoices: invoices.slice(0, 3).map(i => ({
          type: 'invoice',
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          totalAmount: i.totalAmount,
          updatedAt: i.updatedAt
        }))
      }
    });
    
  } catch (error) {
    console.error('Error fetching project overview:', error);
    res.status(500).json({ message: 'Failed to load project overview' });
  }
});

export default router;
// server/middleware/enhanced-permissions.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { storage } from "@server/storage/index";
import { User } from "@shared/schema";

/**
 * Enhanced permissions middleware for project managers
 * Grants project managers full administrative control over their assigned projects
 */

export interface ProjectManagerPermissions {
  // Project management
  canViewProject: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canManageProjectSettings: boolean;
  canViewProjectAnalytics: boolean;
  
  // Task management
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canAssignTasks: boolean;
  canViewTaskDependencies: boolean;
  canManageTaskDependencies: boolean;
  canPublishTasks: boolean;
  canImportTasks: boolean;
  
  // Document management
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  canViewDocuments: boolean;
  canManageDocumentCategories: boolean;
  
  // Communication
  canCreateProgressUpdates: boolean;
  canEditProgressUpdates: boolean;
  canDeleteProgressUpdates: boolean;
  canSendMessages: boolean;
  canViewMessages: boolean;
  canManageProjectChat: boolean;
  
  // Financial
  canViewInvoices: boolean;
  canCreateInvoices: boolean;
  canEditInvoices: boolean;
  canSendInvoices: boolean;
  canViewPayments: boolean;
  canProcessPayments: boolean;
  
  // Client management
  canViewClients: boolean;
  canCommunicateWithClients: boolean;
  canManageClientAccess: boolean;
  
  // Milestones
  canCreateMilestones: boolean;
  canEditMilestones: boolean;
  canDeleteMilestones: boolean;
  canCompleteMilestones: boolean;
  canBillMilestones: boolean;
  
  // Punch Lists
  canCreatePunchListItems: boolean;
  canEditPunchListItems: boolean;
  canDeletePunchListItems: boolean;
  canCompletePunchListItems: boolean;
  
  // Daily Logs
  canCreateDailyLogs: boolean;
  canEditDailyLogs: boolean;
  canViewDailyLogs: boolean;
  
  // Media Management
  canUploadMedia: boolean;
  canDeleteMedia: boolean;
  canViewMedia: boolean;
  
  // Team Management
  canAssignTeamMembers: boolean;
  canViewTeamPerformance: boolean;
  
  // Reporting
  canGenerateReports: boolean;
  canViewProjectMetrics: boolean;
  canExportData: boolean;
}

/**
 * Get permissions for a user on a specific project
 */
export async function getProjectPermissions(
  userId: number, 
  userRole: string, 
  projectId: number
): Promise<ProjectManagerPermissions> {
  
  // Admin has all permissions
  if (userRole.toLowerCase() === 'admin') {
    return {
      canViewProject: true,
      canEditProject: true,
      canDeleteProject: true,
      canManageProjectSettings: true,
      canViewProjectAnalytics: true,
      canCreateTasks: true,
      canEditTasks: true,
      canDeleteTasks: true,
      canAssignTasks: true,
      canViewTaskDependencies: true,
      canManageTaskDependencies: true,
      canPublishTasks: true,
      canImportTasks: true,
      canUploadDocuments: true,
      canDeleteDocuments: true,
      canViewDocuments: true,
      canManageDocumentCategories: true,
      canCreateProgressUpdates: true,
      canEditProgressUpdates: true,
      canDeleteProgressUpdates: true,
      canSendMessages: true,
      canViewMessages: true,
      canManageProjectChat: true,
      canViewInvoices: true,
      canCreateInvoices: true,
      canEditInvoices: true,
      canSendInvoices: true,
      canViewPayments: true,
      canProcessPayments: true,
      canViewClients: true,
      canCommunicateWithClients: true,
      canManageClientAccess: true,
      canCreateMilestones: true,
      canEditMilestones: true,
      canDeleteMilestones: true,
      canCompleteMilestones: true,
      canBillMilestones: true,
      canCreatePunchListItems: true,
      canEditPunchListItems: true,
      canDeletePunchListItems: true,
      canCompletePunchListItems: true,
      canCreateDailyLogs: true,
      canEditDailyLogs: true,
      canViewDailyLogs: true,
      canUploadMedia: true,
      canDeleteMedia: true,
      canViewMedia: true,
      canAssignTeamMembers: true,
      canViewTeamPerformance: true,
      canGenerateReports: true,
      canViewProjectMetrics: true,
      canExportData: true,
    };
  }
  
  // Check if user is project manager for this project
  const isProjectManager = await storage.projectManagerHasProjectAccess(userId, projectId);
  
  if (userRole.toLowerCase() === 'projectmanager' && isProjectManager) {
    // Project managers have full administrative control over their assigned projects
    return {
      canViewProject: true,
      canEditProject: true,
      canDeleteProject: false, // Only admins can delete projects
      canManageProjectSettings: true,
      canViewProjectAnalytics: true,
      
      canCreateTasks: true,
      canEditTasks: true,
      canDeleteTasks: true,
      canAssignTasks: true,
      canViewTaskDependencies: true,
      canManageTaskDependencies: true,
      canPublishTasks: true,
      canImportTasks: true,
      
      canUploadDocuments: true,
      canDeleteDocuments: true,
      canViewDocuments: true,
      canManageDocumentCategories: true,
      canCreateProgressUpdates: true,
      canEditProgressUpdates: true,
      canDeleteProgressUpdates: true,
      canSendMessages: true,
      canViewMessages: true,
      canManageProjectChat: true,
      canViewInvoices: true,
      canCreateInvoices: true,
      canEditInvoices: true,
      canSendInvoices: true,
      canViewPayments: true,
      canProcessPayments: true,
      canViewClients: true,
      canCommunicateWithClients: true,
      canManageClientAccess: true,
      canCreateMilestones: true,
      canEditMilestones: true,
      canDeleteMilestones: true,
      canCompleteMilestones: true,
      canBillMilestones: true,
      canCreatePunchListItems: true,
      canEditPunchListItems: true,
      canDeletePunchListItems: true,
      canCompletePunchListItems: true,
      canCreateDailyLogs: true,
      canEditDailyLogs: true,
      canViewDailyLogs: true,
      canUploadMedia: true,
      canDeleteMedia: true,
      canViewMedia: true,
      canAssignTeamMembers: true,
      canViewTeamPerformance: true,
      canGenerateReports: true,
      canViewProjectMetrics: true,
      canExportData: true,
    };
  }
  
  // Check if user is client for this project
  const isClient = await storage.clientHasProjectAccess(userId, projectId);
  
  if (userRole.toLowerCase() === 'client' && isClient) {
    // Clients have limited permissions
    return {
      canViewProject: true,
      canEditProject: false,
      canDeleteProject: false,
      canManageProjectSettings: false,
      canViewProjectAnalytics: false,
      canCreateTasks: false,
      canEditTasks: false,
      canDeleteTasks: false,
      canAssignTasks: false,
      canViewTaskDependencies: true,
      canManageTaskDependencies: false,
      canPublishTasks: false,
      canImportTasks: false,
      canUploadDocuments: false,
      canDeleteDocuments: false,
      canViewDocuments: true,
      canManageDocumentCategories: false,
      canCreateProgressUpdates: false,
      canEditProgressUpdates: false,
      canDeleteProgressUpdates: false,
      canSendMessages: true,
      canViewMessages: true,
      canManageProjectChat: false,
      canViewInvoices: true,
      canCreateInvoices: false,
      canEditInvoices: false,
      canSendInvoices: false,
      canViewPayments: true,
      canProcessPayments: false,
      canViewClients: false,
      canCommunicateWithClients: false,
      canManageClientAccess: false,
      canCreateMilestones: false,
      canEditMilestones: false,
      canDeleteMilestones: false,
      canCompleteMilestones: false,
      canBillMilestones: false,
      canCreatePunchListItems: false,
      canEditPunchListItems: false,
      canDeletePunchListItems: false,
      canCompletePunchListItems: false,
      canCreateDailyLogs: false,
      canEditDailyLogs: false,
      canViewDailyLogs: true,
      canUploadMedia: false,
      canDeleteMedia: false,
      canViewMedia: true,
      canAssignTeamMembers: false,
      canViewTeamPerformance: false,
      canGenerateReports: false,
      canViewProjectMetrics: false,
      canExportData: false,
    };
  }
  
  // No access by default
  return {
    canViewProject: false,
    canEditProject: false,
    canDeleteProject: false,
    canManageProjectSettings: false,
    canViewProjectAnalytics: false,
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canAssignTasks: false,
    canViewTaskDependencies: false,
    canManageTaskDependencies: false,
    canPublishTasks: false,
    canImportTasks: false,
    canUploadDocuments: false,
    canDeleteDocuments: false,
    canViewDocuments: false,
    canManageDocumentCategories: false,
    canCreateProgressUpdates: false,
    canEditProgressUpdates: false,
    canDeleteProgressUpdates: false,
    canSendMessages: false,
    canViewMessages: false,
    canManageProjectChat: false,
    canViewInvoices: false,
    canCreateInvoices: false,
    canEditInvoices: false,
    canSendInvoices: false,
    canViewPayments: false,
    canProcessPayments: false,
    canViewClients: false,
    canCommunicateWithClients: false,
    canManageClientAccess: false,
    canCreateMilestones: false,
    canEditMilestones: false,
    canDeleteMilestones: false,
    canCompleteMilestones: false,
    canBillMilestones: false,
    canCreatePunchListItems: false,
    canEditPunchListItems: false,
    canDeletePunchListItems: false,
    canCompletePunchListItems: false,
    canCreateDailyLogs: false,
    canEditDailyLogs: false,
    canViewDailyLogs: false,
    canUploadMedia: false,
    canDeleteMedia: false,
    canViewMedia: false,
    canAssignTeamMembers: false,
    canViewTeamPerformance: false,
    canGenerateReports: false,
    canViewProjectMetrics: false,
    canExportData: false,
  };
}

/**
 * Enhanced project access check with detailed permissions
 */
export async function checkEnhancedProjectAccess(
  req: Request, 
  res: Response, 
  projectId: number,
  requiredPermission?: keyof ProjectManagerPermissions
): Promise<boolean> {
  
  // Ensure user is authenticated
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  
  const user = req.user as User;
  const permissions = await getProjectPermissions(user.id, user.role, projectId);
  
  // If no specific permission required, just check if user has any access to the project
  if (!requiredPermission) {
    if (!permissions.canViewProject) {
      res.status(403).json({ message: "Forbidden: You do not have access to this project." });
      return false;
    }
    return true;
  }
  
  // Check specific permission
  if (!permissions[requiredPermission]) {
    res.status(403).json({ 
      message: `Forbidden: You do not have permission to perform this action on this project.`,
      requiredPermission,
      userRole: user.role
    });
    return false;
  }
  
  return true;
}

/**
 * Middleware factory for project-specific permissions
 */
export function requireProjectPermission(permission?: keyof ProjectManagerPermissions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = parseInt(req.params.projectId, 10);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    
    const hasAccess = await checkEnhancedProjectAccess(req, res, projectId, permission);
    
    if (hasAccess) {
      // Add permissions to request for use in controllers
      const user = req.user as User;
      const permissions = await getProjectPermissions(user.id, user.role, projectId);
      (req as any).projectPermissions = permissions;
      next();
    }
    // If false, checkEnhancedProjectAccess already sent the response
  };
}

/**
 * Check if user can perform administrative actions on a project
 */
export async function canAdministerProject(userId: number, userRole: string, projectId: number): Promise<boolean> {
  if (userRole.toLowerCase() === 'admin') {
    return true;
  }
  
  if (userRole.toLowerCase() === 'projectmanager') {
    return await storage.projectManagerHasProjectAccess(userId, projectId);
  }
  
  return false;
}
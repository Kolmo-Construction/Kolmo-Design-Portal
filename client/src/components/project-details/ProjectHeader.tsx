// client/src/components/project-details/ProjectHeader.tsx
import React from 'react';
import { Project } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, FileText, MessageSquare } from "lucide-react";
// Assuming these helpers are correctly in utils.txt and exported
import { getProjectStatusLabel, getProjectStatusBadgeClasses } from "@/lib/utils";

interface ProjectHeaderProps {
    project: Project;
    setActiveTab: (tabId: string) => void; // Function to change the active tab in the parent
}

export function ProjectHeader({ project, setActiveTab }: ProjectHeaderProps) {
    // Use helpers directly if they are correctly typed and exported
    // const statusLabel = getProjectStatusLabel(project.status as ProjectStatus); // Cast if necessary
    // const statusClasses = getProjectStatusBadgeClasses(project.status as ProjectStatus); // Cast if necessary

    // Direct usage assuming helpers handle potentially null/undefined status
    const statusLabel = getProjectStatusLabel(project.status);
    const statusClasses = getProjectStatusBadgeClasses(project.status);

    return (
        <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4 relative z-10">
            {/* Project Title and Location */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1"> {/* Allow wrapping */}
                    <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
                    {/* Use status helpers for badge */}
                    <Badge variant="outline" className={statusClasses}>
                        {statusLabel}
                    </Badge>
                </div>
                <p className="text-slate-600 flex items-center gap-1 text-sm md:text-base">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    {project.address}, {project.city}, {project.state} {project.zipCode}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0 relative z-20"> {/* Prevent buttons shrinking and ensure they appear above navbar */}
                {/* Buttons now call setActiveTab passed via props */}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setActiveTab('messages')}>
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Contact Team</span>
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setActiveTab('documents')}>
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">View Documents</span>
                </Button>
            </div>
        </div>
    );
}
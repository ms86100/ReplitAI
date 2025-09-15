import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';

interface ProjectContextType {
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  isProjectSelected: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [location] = useLocation();

  // Auto-detect project from URL
  useEffect(() => {
    if (!location) return;
    
    const projectMatch = location.match(/\/project\/([^\/]+)/);
    if (projectMatch) {
      setSelectedProjectId(projectMatch[1]);
    } else if (!location.startsWith('/project/')) {
      setSelectedProjectId(null);
    }
  }, [location]);

  const isProjectSelected = !!selectedProjectId;

  return (
    <ProjectContext.Provider value={{
      selectedProjectId,
      setSelectedProjectId,
      isProjectSelected
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};
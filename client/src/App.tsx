import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { AuthProvider } from "@/hooks/useApiAuth";
import { ProjectProvider } from "@/hooks/useProjectContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProjectWizard from "./components/ProjectWizard";
import ProjectOverview from "./pages/ProjectOverview";
import EditProject from "./pages/EditProject";
import Projects from "./pages/Projects";
import ProjectWorkspace from "./components/ProjectWorkspace";
import Retrospectives from "./pages/Retrospectives";
import TeamCapacity from "./pages/TeamCapacity";
import AccessControl from "./pages/AccessControl";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import PortfolioDashboard from "./pages/PortfolioDashboard";
import ResourceDashboard from "./pages/ResourceDashboard";
import MyWork from "./pages/MyWork";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <Toaster />
            <Sonner />
            <Router>
              <ProjectProvider>
                <Route path="/" component={Index} />
                <Route path="/auth" component={Auth} />
                <Route path="/create-project" component={ProjectWizard} />
                <Route path="/projects" component={Projects} />
                <Route path="/project/:id" component={ProjectOverview} />
                <Route path="/project/:id/edit" component={EditProject} />
                <Route path="/projects/:projectId/dashboard" component={ExecutiveDashboard} />
                <Route path="/project/:id/:module" component={ProjectWorkspace} />
                <Route path="/portfolio" component={PortfolioDashboard} />
                <Route path="/resources" component={ResourceDashboard} />
                <Route path="/my-work" component={MyWork} />
                <Route path="/retrospectives" component={Retrospectives} />
                <Route path="/team-capacity" component={TeamCapacity} />
                <Route path="/access-control" component={AccessControl} />
              </ProjectProvider>
            </Router>
          </div>
          <footer className="bg-card border-t py-4 text-center text-sm text-muted-foreground">
            © 2025 Airbus. All rights reserved.
          </footer>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
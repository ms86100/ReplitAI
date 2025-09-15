import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ProjectProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/create-project" element={<ProjectWizard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/project/:id" element={<ProjectOverview />} />
                  <Route path="/project/:id/edit" element={<EditProject />} />
                  <Route path="/project/:id/:module" element={<ProjectWorkspace />} />
                  <Route path="/retrospectives" element={<Retrospectives />} />
                  <Route path="/team-capacity" element={<TeamCapacity />} />
                  <Route path="/access-control" element={<AccessControl />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ProjectProvider>
            </BrowserRouter>
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
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route } from "wouter";
import { AuthProvider } from "@/hooks/useApiAuth";
import Migration from "./pages/migration";

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
              <Route path="/" component={Migration} />
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
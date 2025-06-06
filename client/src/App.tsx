import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetails from "@/pages/ProjectDetails";
import ProjectManagement from "@/pages/ProjectManagement";
import ProjectGeneration from "@/pages/project-generation";
import Documents from "@/pages/documents";
import Financials from "@/pages/financials";
import Messages from "@/pages/messages";
import ProgressUpdates from "@/pages/progress-updates";
import Schedule from "@/pages/schedule";
import Selections from "@/pages/selections";
import Settings from "@/pages/settings";
import SetupProfile from "@/pages/setup-profile";
import UserManagement from "@/pages/UserManagement";
import DevTools from "@/pages/dev-tools";
import CustomerQuotesPage from "@/pages/quotes/customer-quotes-page";
import QuoteViewPage from "@/pages/quotes/quote-view-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      <Route path="/auth">
        {() => <AuthPage />}
      </Route>
      <Route path="/auth/magic-link/:token">
        {() => <AuthPage isMagicLink={true} />}
      </Route>
      <Route path="/reset-password/:token">
        {() => <AuthPage isPasswordReset={true} />}
      </Route>
      <ProtectedRoute path="/setup-profile" component={SetupProfile} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/projects" component={Projects} />
      <ProtectedRoute path="/projects/:id" component={ProjectDetails} />
      <ProtectedRoute path="/project-generation/:projectId" component={ProjectGeneration} />
      <ProtectedRoute path="/project-management" component={ProjectManagement} />
      <ProtectedRoute path="/documents" component={Documents} />
      <ProtectedRoute path="/financials" component={Financials} />
      <ProtectedRoute path="/messages" component={Messages} />
      <ProtectedRoute path="/progress-updates" component={ProgressUpdates} />
      <ProtectedRoute path="/schedule" component={Schedule} />
      <ProtectedRoute path="/selections" component={Selections} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/user-management" component={UserManagement} />
      <ProtectedRoute path="/quotes" component={CustomerQuotesPage} />
      <Route path="/quote/:token" component={QuoteViewPage} />
      {/* Development-only routes */}
      {import.meta.env.DEV && (
        <Route path="/dev-tools">
          {() => <DevTools />}
        </Route>
      )}
      <Route>
        {() => <NotFound />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;

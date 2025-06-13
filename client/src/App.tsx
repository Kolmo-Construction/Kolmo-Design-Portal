import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import AuthPageV2 from "@/pages/auth-v2";
import MagicLinkVerifyPage from "@/pages/magic-link-verify";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import AdminProjectDetails from "@/pages/ProjectDetails";
import ProjectManagement from "@/pages/ProjectManagement";
import ProjectGeneration from "@/pages/project-generation";
import Documents from "@/pages/documents";
import Financials from "@/pages/financials";
import Messages from "@/pages/messages";
import ClientMessages from "@/pages/client-messages";
import ClientProjectDetails from "@/pages/project-details";
import ClientInvoices from "@/pages/client-invoices";
import ProgressUpdates from "@/pages/progress-updates";
import Schedule from "@/pages/schedule";
import Selections from "@/pages/selections";
import Settings from "@/pages/settings";
import SetupProfile from "@/pages/setup-profile";
import UserManagement from "@/pages/UserManagement";
import DevTools from "@/pages/dev-tools";
import Quotes from "@/pages/quotes";
import CustomerQuote from "@/pages/customer-quote";
import QuotePaymentPage from "@/pages/quote-payment";
import PaymentPage from "@/pages/PaymentPage";
import InvoiceDetailPage from "@/pages/InvoiceDetailPage";
import AdminInvoices from "@/pages/AdminInvoices";
import ClientPortalPage from "@/pages/client-portal";
import ProjectManagerDashboard from "@/pages/project-manager-dashboard";

import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth-unified";
import { ChatProvider } from "@/contexts/ChatContext";
import { ClientLayout } from "@/components/ClientLayout";

function Router() {
  return (
    <ClientLayout>
      <Switch>
        <Route path="/auth">
          {() => <AuthPageV2 />}
        </Route>
        <Route path="/auth-legacy">
          {() => <AuthPage />}
        </Route>
        <Route path="/auth/magic-link/:token">
          {() => <MagicLinkVerifyPage />}
        </Route>
        <Route path="/reset-password/:token">
          {() => <AuthPage isPasswordReset={true} />}
        </Route>
        <ProtectedRoute path="/setup-profile" component={SetupProfile} />
        <ProtectedRoute path="/" component={Dashboard} adminOnly />
        <ProtectedRoute path="/client-portal" component={ClientPortalPage} />
        <ProtectedRoute path="/project-manager" component={ProjectManagerDashboard} projectManagerOnly />
        <ProtectedRoute path="/projects" component={Projects} adminOnly />
        <ProtectedRoute path="/projects/:id" component={AdminProjectDetails} adminOnly />
        <ProtectedRoute path="/project-details/:id" component={ClientProjectDetails} />
        <ProtectedRoute path="/project-generation/:projectId" component={ProjectGeneration} adminOnly />
        <ProtectedRoute path="/project-management" component={ProjectManagement} adminOnly />
        <ProtectedRoute path="/documents" component={Documents} />
        <ProtectedRoute path="/financials" component={Financials} adminOnly />
        <ProtectedRoute path="/messages" component={ClientMessages} />
        <ProtectedRoute path="/admin/messages" component={Messages} adminOnly />
        <ProtectedRoute path="/progress-updates" component={ProgressUpdates} />
        <ProtectedRoute path="/schedule" component={Schedule} />
        <ProtectedRoute path="/selections" component={Selections} />
        <ProtectedRoute path="/quotes" component={Quotes} adminOnly />
        <ProtectedRoute path="/invoices" component={ClientInvoices} />
        <ProtectedRoute path="/project-details/:projectId/invoices" component={ClientInvoices} />
        <ProtectedRoute path="/admin/invoices" component={AdminInvoices} adminOnly />
        <ProtectedRoute path="/invoices/:invoiceId/view" component={InvoiceDetailPage} />
        <ProtectedRoute path="/settings" component={Settings} adminOnly />
        <ProtectedRoute path="/user-management" component={UserManagement} adminOnly />
        
        {/* Public customer quote routes */}
        <Route path="/quote/:token" component={CustomerQuote} />
        <Route path="/customer/quote/:token" component={CustomerQuote} />
        <Route path="/quote-payment/:id" component={QuotePaymentPage} />
        
        {/* Public payment route */}
        <Route path="/payment/:clientSecret" component={PaymentPage} />

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
    </ClientLayout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <AuthProvider>
          <ChatProvider>
            <Toaster />
            <Router />
          </ChatProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;

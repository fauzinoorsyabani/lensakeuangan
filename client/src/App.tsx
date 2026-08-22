import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ReceiptReview from "./pages/ReceiptReview";
import Scan from "./pages/Scan";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/scan"><ProtectedPage><Scan /></ProtectedPage></Route>
      <Route path="/review/:id"><ProtectedPage><ReceiptReview /></ProtectedPage></Route>
      <Route path="/transaksi"><ProtectedPage><Transactions /></ProtectedPage></Route>
      <Route path="/pengaturan"><ProtectedPage><Settings /></ProtectedPage></Route>
      <Route path="/"><ProtectedPage><Home /></ProtectedPage></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

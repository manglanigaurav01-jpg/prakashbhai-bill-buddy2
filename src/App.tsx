import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { initTheme } from "@/lib/theme-manager";
import { setupGlobalErrorHandler, initErrorLogging } from "@/lib/error-logger";

// Lazy load components for code splitting - Updated for CI/CD trigger
const Dashboard = lazy(() => import("@/components/Dashboard").then(m => ({ default: m.Dashboard })));
const EnhancedCreateBill = lazy(() => import("@/components/EnhancedCreateBill").then(m => ({ default: m.EnhancedCreateBill })));
const Customers = lazy(() => import("@/components/Customers").then(m => ({ default: m.Customers })));
const BalanceTracker = lazy(() => import("@/components/BalanceTracker").then(m => ({ default: m.BalanceTracker })));
const AmountTracker = lazy(() => import("@/components/AmountTracker").then(m => ({ default: m.AmountTracker })));
const LastBalance = lazy(() => import("@/components/LastBalance").then(m => ({ default: m.LastBalance })));
const TotalBusiness = lazy(() => import("@/components/TotalBusiness").then(m => ({ default: m.TotalBusiness })));
const ItemMaster = lazy(() => import("@/components/ItemMaster").then(m => ({ default: m.ItemMaster })));
const Settings = lazy(() => import("@/components/Settings").then(m => ({ default: m.Settings })));
const EditBills = lazy(() => import("@/components/EditBills").then(m => ({ default: m.EditBills })));
const EditPayments = lazy(() => import("@/components/EditPayments").then(m => ({ default: m.EditPayments })));
const EnhancedAnalytics = lazy(() => import("@/components/EnhancedAnalytics").then(m => ({ default: m.EnhancedAnalytics })));
const BalanceHistory = lazy(() => import("@/components/BalanceHistory").then(m => ({ default: m.BalanceHistory })));
const RecycleBin = lazy(() => import("@/components/RecycleBin").then(m => ({ default: m.RecycleBin })));
const StatisticsDashboard = lazy(() => import("@/components/StatisticsDashboard").then(m => ({ default: m.StatisticsDashboard })));

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient();

type View = 'dashboard' | 'createBill' | 'customers' | 'balance' | 'amountTracker' | 'lastBalance' | 'balanceHistory' | 'totalBusiness' | 'itemMaster' | 'editBills' | 'editPayments' | 'settings' | 'analytics' | 'recycleBin' | 'statistics';

const App = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  // Initialize app features
  useEffect(() => {
    // Initialize theme
    initTheme();
    
    // Setup error logging (without Sentry DSN for now - can be added via env)
    initErrorLogging(process.env.VITE_SENTRY_DSN);
    
    // Setup global error handler
    const cleanup = setupGlobalErrorHandler();
    
    return cleanup;
  }, []);

  const handleNavigate = (view: string) => {
    setCurrentView(view as View);
  };

  const renderView = () => {
    const viewProps = { onNavigate: handleNavigate };
    
    switch (currentView) {
      case 'createBill':
        return <Suspense fallback={<LoadingFallback />}><EnhancedCreateBill {...viewProps} /></Suspense>;
      case 'customers':
        return <Suspense fallback={<LoadingFallback />}><Customers {...viewProps} /></Suspense>;
      case 'balance':
        return <Suspense fallback={<LoadingFallback />}><BalanceTracker {...viewProps} /></Suspense>;
      case 'amountTracker':
        return <Suspense fallback={<LoadingFallback />}><AmountTracker {...viewProps} /></Suspense>;
      case 'lastBalance':
        return <Suspense fallback={<LoadingFallback />}><LastBalance {...viewProps} /></Suspense>;
      case 'totalBusiness':
        return <Suspense fallback={<LoadingFallback />}><TotalBusiness {...viewProps} /></Suspense>;
      case 'itemMaster':
        return <Suspense fallback={<LoadingFallback />}><ItemMaster {...viewProps} /></Suspense>;
      case 'editBills':
        return <Suspense fallback={<LoadingFallback />}><EditBills {...viewProps} /></Suspense>;
      case 'editPayments':
        return <Suspense fallback={<LoadingFallback />}><EditPayments {...viewProps} /></Suspense>;
      case 'settings':
        return <Suspense fallback={<LoadingFallback />}><Settings {...viewProps} /></Suspense>;
      case 'analytics':
        return <Suspense fallback={<LoadingFallback />}><EnhancedAnalytics {...viewProps} /></Suspense>;
      case 'balanceHistory':
        return <Suspense fallback={<LoadingFallback />}><BalanceHistory {...viewProps} /></Suspense>;
      case 'recycleBin':
        return <Suspense fallback={<LoadingFallback />}><RecycleBin {...viewProps} /></Suspense>;
      case 'statistics':
        return <Suspense fallback={<LoadingFallback />}><StatisticsDashboard {...viewProps} /></Suspense>;
      default:
        return <Suspense fallback={<LoadingFallback />}><Dashboard {...viewProps} /></Suspense>;
    }
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          {renderView()}
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

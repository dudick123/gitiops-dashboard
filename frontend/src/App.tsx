import { Suspense, lazy } from "react";
import type { ReactElement } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { DashboardLayout } from "./components/layout/dashboard-layout";

const AppStatusModule = lazy(() => import("./components/app-status/app-status-module"));
const ImagePromotionModule = lazy(() => import("./components/image-promotion/image-promotion-module"));
const MetricsModule = lazy(() => import("./components/metrics/metrics-module"));
const NetworkModule = lazy(() => import("./components/network-status/network-module"));

function ModuleErrorFallback({ error, moduleName }: { readonly error: unknown; readonly moduleName: string }): ReactElement {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <h3 className="text-red-800 font-semibold">{moduleName} — Data Unavailable</h3>
      <p className="text-red-600 text-sm mt-1">This module encountered an error. Other modules continue to function normally.</p>
      <p className="text-red-400 text-xs mt-2">{message}</p>
    </div>
  );
}

function ModuleSkeleton(): ReactElement {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-4 bg-gray-200 rounded w-1/4" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  );
}

export function App(): ReactElement {
  return (
    <DashboardLayout
      appStatus={
        <ErrorBoundary fallbackRender={({ error }) => <ModuleErrorFallback error={error} moduleName="App Status" />}>
          <Suspense fallback={<ModuleSkeleton />}><AppStatusModule /></Suspense>
        </ErrorBoundary>
      }
      imagePromotion={
        <ErrorBoundary fallbackRender={({ error }) => <ModuleErrorFallback error={error} moduleName="Image Promotion" />}>
          <Suspense fallback={<ModuleSkeleton />}><ImagePromotionModule /></Suspense>
        </ErrorBoundary>
      }
      metrics={
        <ErrorBoundary fallbackRender={({ error }) => <ModuleErrorFallback error={error} moduleName="Metrics" />}>
          <Suspense fallback={<ModuleSkeleton />}><MetricsModule /></Suspense>
        </ErrorBoundary>
      }
      network={
        <ErrorBoundary fallbackRender={({ error }) => <ModuleErrorFallback error={error} moduleName="Network Status" />}>
          <Suspense fallback={<ModuleSkeleton />}><NetworkModule /></Suspense>
        </ErrorBoundary>
      }
    />
  );
}

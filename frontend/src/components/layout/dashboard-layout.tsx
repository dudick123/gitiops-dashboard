import type { ReactElement, ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "../../lib/utils";
import { ProjectSelector } from "./project-selector";
import { EnvironmentFilter } from "./environment-filter";

interface DashboardLayoutProps {
  readonly appStatus: ReactNode;
  readonly imagePromotion: ReactNode;
  readonly metrics: ReactNode;
  readonly network: ReactNode;
}

const TAB_ITEMS = [
  { value: "app-status", label: "App Status" },
  { value: "image-promotion", label: "Image Promotion" },
  { value: "metrics", label: "Metrics" },
  { value: "network-status", label: "Network Status" },
] as const;

export function DashboardLayout({
  appStatus,
  imagePromotion,
  metrics,
  network,
}: DashboardLayoutProps): ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            GitOps Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <ProjectSelector />
            <EnvironmentFilter />
          </div>
        </div>
      </header>

      {/* Main content with tabs */}
      <Tabs.Root defaultValue="app-status" className="flex flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <nav className="mx-auto max-w-screen-2xl px-4" aria-label="Dashboard modules">
            <Tabs.List className="flex gap-1" aria-label="Dashboard module tabs">
              {TAB_ITEMS.map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "relative px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors",
                    "hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                    "data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400",
                    "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5",
                    "after:data-[state=active]:bg-blue-600 dark:after:data-[state=active]:bg-blue-400",
                  )}
                >
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </nav>
        </div>

        <main className="mx-auto w-full max-w-screen-2xl flex-1 p-4">
          <Tabs.Content value="app-status" className="outline-none">
            {appStatus}
          </Tabs.Content>
          <Tabs.Content value="image-promotion" className="outline-none">
            {imagePromotion}
          </Tabs.Content>
          <Tabs.Content value="metrics" className="outline-none">
            {metrics}
          </Tabs.Content>
          <Tabs.Content value="network-status" className="outline-none">
            {network}
          </Tabs.Content>
        </main>
      </Tabs.Root>
    </div>
  );
}

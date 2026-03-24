import { useState } from "react";
import type { ReactElement } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ApplicationStatus } from "../../mocks/data/types";
import { StatusBadge } from "./status-badge";

interface AppSetGroupProps {
  readonly name: string;
  readonly applications: readonly ApplicationStatus[];
  readonly environments: readonly string[];
  readonly region: "eastus" | "westus" | "both";
}

const ENV_REGION_COLUMNS = [
  { env: "DEV", region: "eastus", label: "DEV-East" },
  { env: "DEV", region: "westus", label: "DEV-West" },
  { env: "STAGE", region: "eastus", label: "STAGE-East" },
  { env: "STAGE", region: "westus", label: "STAGE-West" },
  { env: "PROD", region: "eastus", label: "PROD-East" },
  { env: "PROD", region: "westus", label: "PROD-West" },
] as const;

function getVisibleColumns(
  environments: readonly string[],
  region: "eastus" | "westus" | "both",
): readonly (typeof ENV_REGION_COLUMNS)[number][] {
  return ENV_REGION_COLUMNS.filter(
    (col) =>
      environments.includes(col.env) &&
      (region === "both" || col.region === region),
  );
}

export function AppSetGroup({
  name,
  applications,
  environments,
  region,
}: AppSetGroupProps): ReactElement {
  const [open, setOpen] = useState(false);

  const columns = getVisibleColumns(environments, region);

  // Deduplicate app names (unique across environment/region)
  const appNames = [...new Set(applications.map((a) => a.name))];

  const healthyCount = applications.filter((a) => a.health === "Healthy").length;
  const totalCount = applications.length;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium",
          "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          "transition-colors",
        )}
        aria-label={`${name} application set, ${healthyCount} of ${totalCount} healthy. Click to ${open ? "collapse" : "expand"}`}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        <span className="flex-1 text-gray-900 dark:text-gray-100">{name}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {healthyCount}/{totalCount} Healthy
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapse data-[state=open]:animate-expand">
        <div className="pl-6">
          {appNames.map((appName) => (
            <div
              key={appName}
              className="flex items-center border-b border-gray-100 py-1.5 text-sm dark:border-gray-800"
            >
              <span className="w-48 shrink-0 truncate text-gray-700 dark:text-gray-300">
                {appName}
              </span>
              {columns.map((col) => {
                const app = applications.find(
                  (a) =>
                    a.name === appName &&
                    a.environment === col.env &&
                    a.region === col.region,
                );
                return (
                  <span key={col.label} className="w-32 shrink-0 text-center">
                    {app ? (
                      <StatusBadge status={app.health} />
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

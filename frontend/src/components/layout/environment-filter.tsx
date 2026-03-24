import type { ReactElement } from "react";
import { cn } from "../../lib/utils";
import { useProjectScope } from "../../hooks/use-project-scope";

const ENVS = ["DEV", "STAGE", "PROD"] as const;
const REGION_OPTIONS = [
  { value: "both" as const, label: "Both" },
  { value: "eastus" as const, label: "East" },
  { value: "westus" as const, label: "West" },
] as const;

export function EnvironmentFilter(): ReactElement {
  const { environments, setEnvironments, region, setRegion } = useProjectScope();

  const toggleEnv = (env: string): void => {
    const current = [...environments];
    const idx = current.indexOf(env);
    if (idx >= 0) {
      // Don't allow deselecting all
      if (current.length <= 1) return;
      current.splice(idx, 1);
    } else {
      current.push(env);
    }
    setEnvironments(current);
  };

  return (
    <div className="flex items-center gap-3" role="toolbar" aria-label="Environment and region filters">
      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">Environment filter</legend>
        {ENVS.map((env) => {
          const isActive = environments.includes(env);
          return (
            <button
              key={env}
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label={`Toggle ${env} environment`}
              onClick={() => {
                toggleEnv(env);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
              )}
            >
              {env}
            </button>
          );
        })}
      </fieldset>

      <span aria-hidden="true" className="h-5 w-px bg-gray-300 dark:bg-gray-600" />

      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">Region filter</legend>
        {REGION_OPTIONS.map((opt) => {
          const isActive = region === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Select ${opt.label} region`}
              onClick={() => {
                setRegion(opt.value);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

import { useState, useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { useProjectScope } from "../../hooks/use-project-scope";
import { useAppStatus } from "../../hooks/use-app-status";
import { DataFreshness } from "../layout/data-freshness";
import { AppStatusGrid } from "./app-status-grid";
import { AppSetGroup } from "./appset-group";
import { AppSearch } from "./app-search";
import { PROJECTS } from "../../mocks/data/seed";
import type { ApplicationStatus } from "../../mocks/data/types";

export function AppStatusModule(): ReactElement {
  const { project, environments, region } = useProjectScope();
  const { data, dataUpdatedAt, isError } = useAppStatus(undefined, project);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const filteredApps = useMemo(() => {
    if (!data) return [];
    let apps = data.filter(
      (app) =>
        environments.includes(app.environment) &&
        (region === "both" || app.region === region),
    );
    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      apps = apps.filter((app) => app.name.toLowerCase().includes(lower));
    }
    return apps;
  }, [data, environments, region, searchQuery]);

  // Project view: show AppSet hierarchy
  const projectConfig = project
    ? PROJECTS.find((p) => p.name === project)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {project ? `${project} — App Status` : "Platform — App Status"}
        </h2>
        <DataFreshness dataUpdatedAt={dataUpdatedAt} isError={isError} />
      </div>

      <div className="max-w-sm">
        <AppSearch onSearch={handleSearch} />
      </div>

      {!data && !isError && (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-64 rounded bg-gray-100" />
        </div>
      )}

      {project && projectConfig ? (
        <ProjectView
          projectConfig={projectConfig}
          applications={filteredApps}
          environments={environments}
          region={region}
        />
      ) : (
        <AppStatusGrid
          applications={filteredApps}
          environments={environments}
          region={region}
        />
      )}
    </div>
  );
}

interface ProjectViewProps {
  readonly projectConfig: (typeof PROJECTS)[number];
  readonly applications: readonly ApplicationStatus[];
  readonly environments: readonly string[];
  readonly region: "eastus" | "westus" | "both";
}

function ProjectView({
  projectConfig,
  applications,
  environments,
  region,
}: ProjectViewProps): ReactElement {
  return (
    <div className="space-y-3">
      {/* ApplicationSet groups */}
      {projectConfig.appSets.map((appSetName) => {
        const appSetApps = applications.filter((a) =>
          a.name.startsWith(appSetName.replace(/s$/, "")),
        );
        return (
          <AppSetGroup
            key={appSetName}
            name={appSetName}
            applications={appSetApps}
            environments={environments}
            region={region}
          />
        );
      })}

      {/* Standalone apps */}
      {projectConfig.standaloneApps.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
            Standalone Applications
          </h3>
          <AppStatusGrid
            applications={applications.filter((a) =>
              (projectConfig.standaloneApps as readonly string[]).includes(a.name),
            )}
            environments={environments}
            region={region}
          />
        </div>
      )}
    </div>
  );
}

// Default export required for React.lazy()
export default AppStatusModule;

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "gitops-dashboard:";
const PROJECT_KEY = `${STORAGE_PREFIX}projectScope`;
const ENVIRONMENTS_KEY = `${STORAGE_PREFIX}environments`;
const REGION_KEY = `${STORAGE_PREFIX}region`;

type Region = "eastus" | "westus" | "both";

interface ProjectScope {
  readonly project: string | null;
  readonly setProject: (p: string | null) => void;
  readonly environments: readonly string[];
  readonly setEnvironments: (e: readonly string[]) => void;
  readonly region: Region;
  readonly setRegion: (r: Region) => void;
}

const DEFAULT_ENVIRONMENTS = ["DEV", "STAGE", "PROD"] as const;
const DEFAULT_REGION: Region = "both";

let listeners: Array<() => void> = [];

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getProjectSnapshot(): string | null {
  return localStorage.getItem(PROJECT_KEY);
}

function getEnvironmentsSnapshot(): readonly string[] {
  const stored = localStorage.getItem(ENVIRONMENTS_KEY);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
        return parsed as string[];
      }
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_ENVIRONMENTS;
}

function getRegionSnapshot(): Region {
  const stored = localStorage.getItem(REGION_KEY);
  if (stored === "eastus" || stored === "westus" || stored === "both") {
    return stored;
  }
  return DEFAULT_REGION;
}

// Stable snapshot references for useSyncExternalStore
let cachedProject = getProjectSnapshot();
let cachedEnvironments = getEnvironmentsSnapshot();
let cachedRegion = getRegionSnapshot();

function projectSnapshot(): string | null {
  return cachedProject;
}

function environmentsSnapshot(): readonly string[] {
  return cachedEnvironments;
}

function regionSnapshot(): Region {
  return cachedRegion;
}

export function useProjectScope(): ProjectScope {
  const project = useSyncExternalStore(subscribe, projectSnapshot);
  const environments = useSyncExternalStore(subscribe, environmentsSnapshot);
  const region = useSyncExternalStore(subscribe, regionSnapshot);

  const setProject = useCallback((p: string | null) => {
    if (p === null) {
      localStorage.removeItem(PROJECT_KEY);
    } else {
      localStorage.setItem(PROJECT_KEY, p);
    }
    cachedProject = p;
    emitChange();
  }, []);

  const setEnvironments = useCallback((e: readonly string[]) => {
    localStorage.setItem(ENVIRONMENTS_KEY, JSON.stringify(e));
    cachedEnvironments = e;
    emitChange();
  }, []);

  const setRegion = useCallback((r: Region) => {
    localStorage.setItem(REGION_KEY, r);
    cachedRegion = r;
    emitChange();
  }, []);

  return { project, setProject, environments, setEnvironments, region, setRegion };
}

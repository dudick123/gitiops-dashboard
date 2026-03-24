import { generateApplications, generateAppSets, generateProjects } from "./generate-apps";
import { generateMetrics, generateQuotas, generateOomEvents } from "./generate-metrics";
import { generatePolicies, generateCiliumDrops, generateDeniedConnections } from "./generate-network";

export const mockData = {
  applications: generateApplications(),
  appSets: generateAppSets(),
  projects: generateProjects(),
  metrics: generateMetrics(),
  quotas: generateQuotas(),
  oomEvents: generateOomEvents(),
  policies: generatePolicies(),
  ciliumDrops: generateCiliumDrops(),
  deniedConnections: generateDeniedConnections(),
};

export type { ApplicationStatus, ApplicationSet, Project, CpuMemoryMetric, NamespaceQuota, OomEvent, NetworkPolicy, CiliumDrop, DeniedConnection } from "./types";

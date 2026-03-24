import type { ApplicationStatus, ApplicationSet, Project } from "./types";
import { PROJECTS, ENVIRONMENTS, REGIONS } from "./seed";

// Deterministic pseudo-random number generator (mulberry32)
function createRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(42);

function pick<T>(arr: readonly T[]): T {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array is never empty
  return arr[Math.floor(rng() * arr.length)]!;
}

function semverTag(): string {
  const major = Math.floor(rng() * 4) + 1;
  const minor = Math.floor(rng() * 20);
  const patch = Math.floor(rng() * 50);
  return `v${major}.${minor}.${patch}`;
}

function nonSemverTag(): string {
  const tags = [
    "latest",
    `dev-build-${Math.floor(rng() * 999)}`,
    `hotfix-${Math.floor(rng() * 100)}`,
    `rc-${Math.floor(rng() * 20)}`,
    "nightly",
    `sha-${Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0")}`,
  ];
  return pick(tags);
}

function imageTag(): string {
  return rng() < 0.05 ? nonSemverTag() : semverTag();
}

function generateImage(appName: string): string {
  return `acr.azurecr.io/${appName}:${imageTag()}`;
}

type HealthSync = { health: ApplicationStatus["health"]; sync: ApplicationStatus["sync"] };

function pickHealthSync(): HealthSync {
  const roll = rng();
  if (roll < 0.80) {
    return { health: "Healthy", sync: "Synced" };
  } else if (roll < 0.90) {
    return pick<HealthSync>([
      { health: "Degraded", sync: "OutOfSync" },
      { health: "Degraded", sync: "Synced" },
      { health: "Progressing", sync: "OutOfSync" },
    ]);
  } else if (roll < 0.95) {
    return pick<HealthSync>([
      { health: "Unknown", sync: "Unknown" },
      { health: "Unknown", sync: "Synced" },
    ]);
  } else {
    return pick<HealthSync>([
      { health: "Missing", sync: "OutOfSync" },
      { health: "Suspended", sync: "OutOfSync" },
      { health: "Degraded", sync: "Unknown" },
    ]);
  }
}

export function generateApplications(): ApplicationStatus[] {
  const apps: ApplicationStatus[] = [];

  // Generate apps from project appSets and standaloneApps
  for (const project of PROJECTS) {
    // AppSet-generated apps: each appSet generates one app per env/region combo
    for (const appSetName of project.appSets) {
      for (const env of ENVIRONMENTS) {
        for (const region of REGIONS) {
          const name = `${appSetName}-${env.toLowerCase()}-${region}`;
          const { health, sync } = pickHealthSync();
          apps.push({
            name,
            project: project.name,
            environment: env,
            region,
            health,
            sync,
            images: [generateImage(appSetName)],
          });
        }
      }
    }

    // Standalone apps: each gets one app per env/region combo
    for (const appName of project.standaloneApps) {
      for (const env of ENVIRONMENTS) {
        for (const region of REGIONS) {
          const name = `${appName}-${env.toLowerCase()}-${region}`;
          const { health, sync } = pickHealthSync();
          apps.push({
            name,
            project: project.name,
            environment: env,
            region,
            health,
            sync,
            images: [generateImage(appName), ...(rng() < 0.3 ? [generateImage(`${appName}-sidecar`)] : [])],
          });
        }
      }
    }
  }

  // Generate generic apps to push total above 850
  // 162 apps from projects, need ~690 more = ~115 prefixes x 6 (env/region)
  const genericPrefixes: string[] = [];
  const basePrefixes = [
    "service", "worker", "cronjob", "batch-proc", "api-gateway-ext",
    "cache-layer", "event-bus", "metrics-exporter", "config-server",
    "feature-flag", "rate-limiter", "circuit-breaker", "health-checker",
    "audit-logger", "compliance-scanner", "cost-analyzer", "backup-agent",
    "canary-deployer", "rollback-agent", "secret-rotator", "log-shipper",
    "db-proxy", "queue-consumer", "webhook-relay", "job-scheduler",
    "resource-watcher", "cert-checker", "dns-updater", "load-balancer-ctrl",
    "tenant-manager", "quota-enforcer", "policy-agent", "image-scanner",
    "artifact-sync", "config-reloader", "sidecar-injector", "init-container",
    "migration-runner", "seed-loader", "chaos-agent", "perf-monitor",
  ];
  // Generate enough unique prefixes by appending letters
  const suffixes = ["a", "b", "c"];
  for (const base of basePrefixes) {
    for (const suffix of suffixes) {
      genericPrefixes.push(`${base}-${suffix}`);
      if (genericPrefixes.length >= 120) break;
    }
    if (genericPrefixes.length >= 120) break;
  }

  let genericIndex = 0;
  for (const prefix of genericPrefixes) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- PROJECTS is never empty
    const project = PROJECTS[genericIndex % PROJECTS.length]!;
    for (const env of ENVIRONMENTS) {
      for (const region of REGIONS) {
        const name = `${prefix}-${String(genericIndex + 1).padStart(3, "0")}-${env.toLowerCase()}-${region}`;
        const { health, sync } = pickHealthSync();
        apps.push({
          name,
          project: project.name,
          environment: env,
          region,
          health,
          sync,
          images: [generateImage(prefix)],
        });
      }
    }
    genericIndex++;
  }

  return apps;
}

export function generateAppSets(): ApplicationSet[] {
  const appSets: ApplicationSet[] = [];

  for (const project of PROJECTS) {
    for (const appSetName of project.appSets) {
      const appNames: string[] = [];
      for (const env of ENVIRONMENTS) {
        for (const region of REGIONS) {
          appNames.push(`${appSetName}-${env.toLowerCase()}-${region}`);
        }
      }
      appSets.push({
        name: appSetName,
        project: project.name,
        generatorType: pick(["git", "list", "matrix", "merge"]),
        applications: appNames,
      });
    }
  }

  return appSets;
}

export function generateProjects(): Project[] {
  return PROJECTS.map((p) => ({
    name: p.name,
    description: p.description,
    destinations: ENVIRONMENTS.flatMap((env) =>
      REGIONS.map((region) => ({
        namespace: p.name,
        cluster: `aks-${env.toLowerCase()}-${region}`,
      })),
    ),
  }));
}

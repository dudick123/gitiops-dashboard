import type { CpuMemoryMetric, NamespaceQuota, OomEvent } from "./types";
import { PROJECTS, ENVIRONMENTS, REGIONS } from "./seed";

// Deterministic pseudo-random number generator (mulberry32) with different seed from apps
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

const rng = createRng(12345);

function generateSparkline(base: number, variance: number): number[] {
  const points: number[] = [];
  let current = base;
  for (let i = 0; i < 10; i++) {
    current = Math.max(0, current + (rng() - 0.5) * variance * 2);
    points.push(Math.round(current * 100) / 100);
  }
  return points;
}

function pickWorkloadType(): string {
  const roll = rng();
  if (roll < 0.7) return "Deployment";
  if (roll < 0.9) return "StatefulSet";
  return "DaemonSet";
}

export function generateMetrics(): CpuMemoryMetric[] {
  const metrics: CpuMemoryMetric[] = [];

  for (const project of PROJECTS) {
    // Workload-level metrics for project view
    const workloads = [...project.appSets, ...project.standaloneApps];

    for (const env of ENVIRONMENTS) {
      for (const region of REGIONS) {
        // Namespace-level aggregate metric (platform view)
        const nsCpuBase = (workloads.length * 0.2) + rng() * 2;
        const nsMemBase = workloads.length * 128 + rng() * 512;
        metrics.push({
          namespace: project.name,
          cpuUsage: Math.round(nsCpuBase * 100) / 100,
          cpuRequest: Math.round((nsCpuBase * 1.5) * 100) / 100,
          cpuLimit: Math.round((nsCpuBase * 2.5) * 100) / 100,
          memoryUsageMi: Math.round(nsMemBase),
          memoryRequestMi: Math.round(nsMemBase * 1.3),
          memoryLimitMi: Math.round(nsMemBase * 2),
          sparkline: generateSparkline(nsCpuBase, 0.3),
          environment: env,
          region,
        });

        // Workload-level metrics (project view)
        for (const workload of workloads) {
          const cpuBase = 0.05 + rng() * 0.8;
          const memBase = 32 + rng() * 384;
          const workloadType = pickWorkloadType();

          metrics.push({
            namespace: project.name,
            workload,
            workloadType,
            cpuUsage: Math.round(cpuBase * 1000) / 1000,
            cpuRequest: Math.round((cpuBase * 1.5) * 1000) / 1000,
            cpuLimit: Math.round((cpuBase * 3) * 1000) / 1000,
            memoryUsageMi: Math.round(memBase),
            memoryRequestMi: Math.round(memBase * 1.4),
            memoryLimitMi: Math.round(memBase * 2.5),
            sparkline: generateSparkline(cpuBase, 0.1),
            environment: env,
            region,
          });
        }
      }
    }
  }

  return metrics;
}

export function generateQuotas(): NamespaceQuota[] {
  const quotas: NamespaceQuota[] = [];

  for (const project of PROJECTS) {
    for (const env of ENVIRONMENTS) {
      for (const region of REGIONS) {
        const workloadCount = project.appSets.length + project.standaloneApps.length;
        const cpuLimit = workloadCount * 4 + Math.floor(rng() * 8);
        const memLimit = workloadCount * 2048 + Math.floor(rng() * 4096);
        // Usage ranges from 40% to 85% of limit
        const usageRatio = 0.4 + rng() * 0.45;

        quotas.push({
          namespace: project.name,
          cpuUsed: Math.round(cpuLimit * usageRatio * 100) / 100,
          cpuLimit,
          memoryUsedMi: Math.round(memLimit * usageRatio),
          memoryLimitMi: memLimit,
          environment: env,
          region,
        });
      }
    }
  }

  return quotas;
}

export function generateOomEvents(): OomEvent[] {
  const events: OomEvent[] = [];
  const now = Date.now();

  for (const project of PROJECTS) {
    const allWorkloads = [...project.appSets, ...project.standaloneApps];
    // 3-5 OOM events per project namespace
    const count = 3 + Math.floor(rng() * 3);

    for (let i = 0; i < count; i++) {
      const workload = allWorkloads[Math.floor(rng() * allWorkloads.length)] ?? "unknown-workload";
      const env = ENVIRONMENTS[Math.floor(rng() * ENVIRONMENTS.length)] ?? "DEV";
      const region = REGIONS[Math.floor(rng() * REGIONS.length)] ?? "eastus";
      const memLimit = 256 + Math.floor(rng() * 768);
      // Memory at kill is typically 95-100% of limit
      const memAtKill = Math.round(memLimit * (0.95 + rng() * 0.05));
      // Random timestamp within last 24 hours
      const timestamp = new Date(now - Math.floor(rng() * 86400000));

      events.push({
        podName: `${workload}-${Math.floor(rng() * 0xffff).toString(16).padStart(4, "0")}-${String.fromCharCode(97 + Math.floor(rng() * 26))}${String.fromCharCode(97 + Math.floor(rng() * 26))}${Math.floor(rng() * 9)}${Math.floor(rng() * 9)}${Math.floor(rng() * 9)}`,
        containerName: rng() < 0.8 ? workload : `${workload}-sidecar`,
        memoryAtKillMi: memAtKill,
        memoryLimitMi: memLimit,
        timestamp: timestamp.toISOString(),
        namespace: project.name,
        environment: env,
        region,
      });
    }
  }

  return events;
}

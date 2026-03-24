export type HealthStatus = "Healthy" | "Degraded" | "Progressing" | "Suspended" | "Missing" | "Unknown";
export type SyncStatus = "Synced" | "OutOfSync" | "Unknown";

export interface ApplicationStatus {
  readonly name: string;
  readonly project: string;
  readonly environment: string;
  readonly region: string;
  readonly health: HealthStatus;
  readonly sync: SyncStatus;
  readonly images: readonly string[];
}

export interface ApplicationSet {
  readonly name: string;
  readonly project: string;
  readonly generatorType: string;
  readonly applications: readonly string[];
}

export interface Project {
  readonly name: string;
  readonly description: string;
  readonly destinations: readonly { namespace: string; cluster: string }[];
}

export interface CpuMemoryMetric {
  readonly namespace: string;
  readonly workload?: string;
  readonly workloadType?: string;
  readonly cpuUsage: number;
  readonly cpuRequest: number;
  readonly cpuLimit: number;
  readonly memoryUsageMi: number;
  readonly memoryRequestMi: number;
  readonly memoryLimitMi: number;
  readonly sparkline: readonly number[];
  readonly environment: string;
  readonly region: string;
}

export interface NamespaceQuota {
  readonly namespace: string;
  readonly cpuUsed: number;
  readonly cpuLimit: number;
  readonly memoryUsedMi: number;
  readonly memoryLimitMi: number;
  readonly environment: string;
  readonly region: string;
}

export interface OomEvent {
  readonly podName: string;
  readonly containerName: string;
  readonly memoryAtKillMi: number;
  readonly memoryLimitMi: number;
  readonly timestamp: string;
  readonly namespace: string;
  readonly environment: string;
  readonly region: string;
}

export interface NetworkPolicy {
  readonly name: string;
  readonly namespace: string;
  readonly hasEgressRestriction: boolean;
  readonly ingressRuleCount: number;
  readonly egressRuleCount: number;
  readonly environment: string;
  readonly cluster: string;
}

export interface CiliumDrop {
  readonly sourceNamespace: string;
  readonly destNamespace: string;
  readonly ingressDrops: number;
  readonly egressDrops: number;
  readonly tcpResets: number;
  readonly environment: string;
  readonly region: string;
}

export interface DeniedConnection {
  readonly direction: "ingress" | "egress";
  readonly sourceNamespace: string;
  readonly destNamespace: string;
  readonly protocol: string;
  readonly port: number;
  readonly dropCount: number;
  readonly resetCount: number;
  readonly policyVerdict: string;
  readonly cluster: string;
}

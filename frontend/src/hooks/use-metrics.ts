import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import type {
  CpuMemoryMetric,
  NamespaceQuota,
  OomEvent,
} from "../mocks/data/types";

export function useCpuMetrics(
  env: string,
  region: string,
  namespace?: string,
) {
  return useQuery<readonly CpuMemoryMetric[]>({
    queryKey: queryKeys.prometheus.cpu(env, region, namespace),
    queryFn: async () => {
      const params = new URLSearchParams({ env, region });
      if (namespace) params.set("namespace", namespace);
      const res = await fetch(`/api/prometheus/cpu?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch CPU metrics");
      return res.json();
    },
  });
}

export function useMemoryMetrics(
  env: string,
  region: string,
  namespace?: string,
) {
  return useQuery<readonly CpuMemoryMetric[]>({
    queryKey: queryKeys.prometheus.memory(env, region, namespace),
    queryFn: async () => {
      const params = new URLSearchParams({ env, region });
      if (namespace) params.set("namespace", namespace);
      const res = await fetch(`/api/prometheus/memory?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch memory metrics");
      return res.json();
    },
  });
}

export function useQuota(namespace?: string) {
  return useQuery<readonly NamespaceQuota[]>({
    queryKey: queryKeys.prometheus.quota(namespace),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.set("namespace", namespace);
      const qs = params.toString();
      const url = qs ? `/api/prometheus/quota?${qs}` : "/api/prometheus/quota";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch quota data");
      return res.json();
    },
  });
}

export function useOomEvents(namespace?: string) {
  return useQuery<readonly OomEvent[]>({
    queryKey: queryKeys.prometheus.oomEvents(namespace),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.set("namespace", namespace);
      const qs = params.toString();
      const url = qs
        ? `/api/prometheus/oom-events?${qs}`
        : "/api/prometheus/oom-events";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch OOM events");
      return res.json();
    },
  });
}

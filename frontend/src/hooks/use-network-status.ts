import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import type {
  NetworkPolicy,
  CiliumDrop,
  DeniedConnection,
} from "../mocks/data/types";

export function useNetworkPolicies(cluster?: string, namespace?: string) {
  return useQuery<readonly NetworkPolicy[]>({
    queryKey: queryKeys.network.policies(cluster, namespace),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cluster) params.set("cluster", cluster);
      if (namespace) params.set("namespace", namespace);
      const qs = params.toString();
      const url = qs
        ? `/api/network/policies?${qs}`
        : "/api/network/policies";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch network policies");
      return res.json();
    },
  });
}

export function useCiliumDrops(namespace?: string) {
  return useQuery<readonly CiliumDrop[]>({
    queryKey: queryKeys.network.ciliumDrops(namespace),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.set("namespace", namespace);
      const qs = params.toString();
      const url = qs
        ? `/api/network/cilium-drops?${qs}`
        : "/api/network/cilium-drops";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch Cilium drop data");
      return res.json();
    },
  });
}

export function useDeniedConnections(namespace?: string) {
  return useQuery<readonly DeniedConnection[]>({
    queryKey: queryKeys.network.deniedConnections(namespace),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (namespace) params.set("namespace", namespace);
      const qs = params.toString();
      const url = qs
        ? `/api/network/denied-connections?${qs}`
        : "/api/network/denied-connections";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch denied connections");
      return res.json();
    },
  });
}

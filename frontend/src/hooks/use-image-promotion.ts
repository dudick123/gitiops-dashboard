import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import type { ApplicationStatus } from "../mocks/data/types";

export function useImagePromotion(env: string, project?: string) {
  return useQuery<readonly ApplicationStatus[]>({
    queryKey: queryKeys.argocd.apps(env, project),
    queryFn: async () => {
      const params = new URLSearchParams({ env });
      if (project) params.set("project", project);
      const res = await fetch(`/api/argocd/apps?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch application data");
      return res.json();
    },
  });
}

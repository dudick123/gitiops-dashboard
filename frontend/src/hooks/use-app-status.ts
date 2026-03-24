import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ApplicationStatus } from "../mocks/data/types";
import { queryKeys } from "../lib/query-keys";

export function useAppStatus(
  environment?: string,
  project?: string | null,
): UseQueryResult<readonly ApplicationStatus[]> {
  return useQuery({
    queryKey: queryKeys.argocd.apps(environment ?? "all", project ?? undefined),
    queryFn: () =>
      fetch(
        "/api/argocd/apps" + (project ? `?project=${encodeURIComponent(project)}` : ""),
      ).then((r) => r.json() as Promise<readonly ApplicationStatus[]>),
    refetchInterval: 1_800_000,
    refetchIntervalInBackground: false,
  });
}

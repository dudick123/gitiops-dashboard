import type { ReactElement } from "react";
import { useProjectScope } from "../../hooks/use-project-scope";
import {
  useNetworkPolicies,
  useCiliumDrops,
  useDeniedConnections,
} from "../../hooks/use-network-status";
import { PolicyList } from "./policy-list";
import { CiliumSummary } from "./cilium-summary";
import { DeniedConnectionsTable } from "./denied-connections-table";

export function NetworkModule(): ReactElement {
  const { project } = useProjectScope();
  const namespace = project ?? undefined;

  const policiesQuery = useNetworkPolicies(undefined, namespace);
  const ciliumQuery = useCiliumDrops(namespace);
  const deniedQuery = useDeniedConnections(namespace);

  const isLoading =
    policiesQuery.isLoading ||
    ciliumQuery.isLoading ||
    deniedQuery.isLoading;
  const isError =
    policiesQuery.isError || ciliumQuery.isError || deniedQuery.isError;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        aria-live="polite"
      >
        <p className="text-gray-500">Loading network status...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700" role="alert">
        Failed to load network status data. Please try again.
      </div>
    );
  }

  return (
    <section aria-label="Network Status">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Network Status
        {namespace ? ` \u2014 ${namespace}` : ""}
      </h2>

      <div className="space-y-8">
        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Network Policies
          </h3>
          <PolicyList policies={policiesQuery.data ?? []} />
        </div>

        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Cilium Flow Summary
          </h3>
          <CiliumSummary drops={ciliumQuery.data ?? []} />
        </div>

        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Denied Connections
          </h3>
          <DeniedConnectionsTable connections={deniedQuery.data ?? []} />
        </div>
      </div>
    </section>
  );
}

export default NetworkModule;

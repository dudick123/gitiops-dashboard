import type { ReactElement } from "react";
import { ShieldAlert } from "lucide-react";
import type { NetworkPolicy } from "../../mocks/data/types";

interface PolicyListProps {
  readonly policies: readonly NetworkPolicy[];
}

export function PolicyList({ policies }: PolicyListProps): ReactElement {
  if (policies.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No network policies found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        aria-label="Network policies"
      >
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Namespace
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Policy Name
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Ingress Rules
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Egress Rules
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Egress Restricted
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {policies.map((policy) => (
            <tr key={`${policy.namespace}-${policy.name}`}>
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {policy.namespace}
              </td>
              <td className="px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {policy.name}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-center">
                {policy.ingressRuleCount}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 text-center">
                {policy.egressRuleCount}
              </td>
              <td className="px-3 py-2 text-sm whitespace-nowrap">
                {policy.hasEgressRestriction ? (
                  <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    <ShieldAlert
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    <span>Open Egress</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

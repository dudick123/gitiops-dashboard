import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { DeniedConnection } from "../../mocks/data/types";

interface DeniedConnectionsTableProps {
  readonly connections: readonly DeniedConnection[];
}

export function DeniedConnectionsTable({
  connections,
}: DeniedConnectionsTableProps): ReactElement {
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(
    () =>
      [...connections].sort((a, b) =>
        sortAsc
          ? a.dropCount - b.dropCount
          : b.dropCount - a.dropCount,
      ),
    [connections, sortAsc],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No denied connections found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        aria-label="Denied connections"
      >
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Direction
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Source NS
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Dest NS
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Protocol
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Port
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer select-none"
              onClick={() => setSortAsc((prev) => !prev)}
              aria-sort={sortAsc ? "ascending" : "descending"}
            >
              Drop Count {sortAsc ? "\u2191" : "\u2193"}
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Reset Count
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Policy Verdict
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {sorted.map((conn, idx) => (
            <tr
              key={`${conn.sourceNamespace}-${conn.destNamespace}-${conn.port}-${idx}`}
            >
              <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap capitalize">
                {conn.direction}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {conn.sourceNamespace}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {conn.destNamespace}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 uppercase whitespace-nowrap">
                {conn.protocol}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {conn.port}
              </td>
              <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {conn.dropCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {conn.resetCount.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {conn.policyVerdict}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

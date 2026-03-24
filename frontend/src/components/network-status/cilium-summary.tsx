import { useMemo } from "react";
import type { ReactElement } from "react";
import type { CiliumDrop } from "../../mocks/data/types";

interface CiliumSummaryProps {
  readonly drops: readonly CiliumDrop[];
}

interface AggregatedRow {
  readonly sourceNamespace: string;
  readonly destNamespace: string;
  readonly ingressDrops: number;
  readonly egressDrops: number;
  readonly tcpResets: number;
}

export function CiliumSummary({ drops }: CiliumSummaryProps): ReactElement {
  const totals = useMemo(() => {
    let ingressDrops = 0;
    let egressDrops = 0;
    let tcpResets = 0;
    for (const d of drops) {
      ingressDrops += d.ingressDrops;
      egressDrops += d.egressDrops;
      tcpResets += d.tcpResets;
    }
    return { ingressDrops, egressDrops, tcpResets };
  }, [drops]);

  const aggregated = useMemo<readonly AggregatedRow[]>(() => {
    const map = new Map<string, AggregatedRow>();
    for (const d of drops) {
      const key = `${d.sourceNamespace}|${d.destNamespace}`;
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          sourceNamespace: d.sourceNamespace,
          destNamespace: d.destNamespace,
          ingressDrops: existing.ingressDrops + d.ingressDrops,
          egressDrops: existing.egressDrops + d.egressDrops,
          tcpResets: existing.tcpResets + d.tcpResets,
        });
      } else {
        map.set(key, {
          sourceNamespace: d.sourceNamespace,
          destNamespace: d.destNamespace,
          ingressDrops: d.ingressDrops,
          egressDrops: d.egressDrops,
          tcpResets: d.tcpResets,
        });
      }
    }
    return [...map.values()];
  }, [drops]);

  return (
    <div>
      {/* Summary cards */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6"
        aria-label="Cilium drop summary"
      >
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Ingress Drops
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totals.ingressDrops.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Egress Drops
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totals.egressDrops.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total TCP Resets
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {totals.tcpResets.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Aggregated table */}
      {aggregated.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
            aria-label="Cilium drops aggregated by namespace pair"
          >
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
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
                  Ingress Drops
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Egress Drops
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  TCP Resets
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {aggregated.map((row) => (
                <tr
                  key={`${row.sourceNamespace}-${row.destNamespace}`}
                >
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {row.sourceNamespace}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {row.destNamespace}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {row.ingressDrops.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {row.egressDrops.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {row.tcpResets.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

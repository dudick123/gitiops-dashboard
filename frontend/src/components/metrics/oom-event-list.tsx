import { useMemo } from "react";
import type { ReactElement } from "react";
import type { OomEvent } from "../../mocks/data/types";

interface OomEventListProps {
  readonly events: readonly OomEvent[];
}

export function OomEventList({ events }: OomEventListProps): ReactElement {
  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">No OOM events recorded.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        aria-label="OOM kill events"
      >
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Pod
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Container
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Memory at Kill
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Limit
            </th>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Timestamp
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {sorted.map((event, idx) => (
            <tr key={`${event.podName}-${event.timestamp}-${idx}`}>
              <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {event.podName}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {event.containerName}
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {event.memoryAtKillMi}Mi
              </td>
              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {event.memoryLimitMi}Mi
              </td>
              <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {new Date(event.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

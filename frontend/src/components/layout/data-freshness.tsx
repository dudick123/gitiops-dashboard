import type { ReactElement } from "react";
import { cn } from "../../lib/utils";

interface DataFreshnessProps {
  readonly dataUpdatedAt: number | undefined;
  readonly isError: boolean;
  readonly lastSuccessfulAt?: number;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DataFreshness({
  dataUpdatedAt,
  isError,
  lastSuccessfulAt,
}: DataFreshnessProps): ReactElement {
  if (isError || !dataUpdatedAt) {
    const fallback = lastSuccessfulAt ? formatTimestamp(lastSuccessfulAt) : "N/A";
    return (
      <p
        className={cn(
          "text-xs text-amber-600 dark:text-amber-400",
          "flex items-center gap-1",
        )}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Unknown — last successful: {fallback}
      </p>
    );
  }

  return (
    <p
      className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
      Last updated: {formatTimestamp(dataUpdatedAt)}
    </p>
  );
}

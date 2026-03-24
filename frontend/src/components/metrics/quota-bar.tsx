import type { ReactElement } from "react";
import { cn } from "../../lib/utils";

interface QuotaBarProps {
  readonly used: number;
  readonly limit: number;
  readonly unit: string;
}

function formatValue(value: number, unit: string): string {
  if (unit === "Mi") return `${Math.round(value)}Mi`;
  if (unit === "cores") return `${value.toFixed(2)} cores`;
  return `${value}${unit}`;
}

export function QuotaBar({ used, limit, unit }: QuotaBarProps): ReactElement {
  const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const clamped = Math.min(percentage, 100);

  const barColor =
    percentage > 90
      ? "bg-red-500"
      : percentage >= 70
        ? "bg-amber-500"
        : "bg-green-500";

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <div
        className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percentage}% used (${formatValue(used, unit)} / ${formatValue(limit, unit)})`}
      >
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {percentage}% ({formatValue(used, unit)} / {formatValue(limit, unit)})
      </span>
    </div>
  );
}

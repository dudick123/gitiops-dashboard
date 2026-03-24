import type { ReactElement } from "react";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HealthStatus } from "../../mocks/data/types";

interface StatusBadgeProps {
  readonly status: HealthStatus;
}

const STATUS_CONFIG = {
  Healthy: {
    icon: CheckCircle2,
    label: "Healthy",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    iconClassName: "text-green-600 dark:text-green-400",
  },
  Degraded: {
    icon: AlertTriangle,
    label: "Degraded",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  Progressing: {
    icon: HelpCircle,
    label: "Progressing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
  Suspended: {
    icon: HelpCircle,
    label: "Suspended",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
    iconClassName: "text-gray-500 dark:text-gray-400",
  },
  Missing: {
    icon: XCircle,
    label: "Missing",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  Unknown: {
    icon: HelpCircle,
    label: "Unknown",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    iconClassName: "text-gray-400 dark:text-gray-500",
  },
} as const;

export function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
      role="status"
      aria-label={`Health status: ${config.label}`}
    >
      <Icon className={cn("h-3 w-3", config.iconClassName)} aria-hidden="true" />
      {config.label}
    </span>
  );
}

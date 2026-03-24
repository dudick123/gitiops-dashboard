import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

interface TagCellProps {
  readonly tag: string;
  readonly fullImagePath: string;
  readonly previousTag?: string | undefined;
}

export function TagCell({
  tag,
  fullImagePath,
  previousTag,
}: TagCellProps): ReactElement {
  const isMismatch = previousTag !== undefined && tag !== previousTag;
  const isInvalidSemver = !SEMVER_PATTERN.test(tag);

  return (
    <td
      className={cn(
        "px-3 py-2 text-sm font-mono whitespace-nowrap relative group",
        isMismatch && "bg-amber-100 dark:bg-amber-900/30",
      )}
      title={fullImagePath}
    >
      <span className="inline-flex items-center gap-1">
        {tag || "\u2014"}
        {isInvalidSemver && tag && (
          <AlertTriangle
            className="h-3.5 w-3.5 text-yellow-500"
            aria-label="Tag does not match semver pattern"
          />
        )}
      </span>
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap"
      >
        {fullImagePath}
      </span>
    </td>
  );
}

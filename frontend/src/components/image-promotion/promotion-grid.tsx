import type { ReactElement } from "react";
import type { ApplicationStatus } from "../../mocks/data/types";
import { TagCell } from "./tag-cell";

/**
 * Pipeline steps in promotion order.
 * Each step corresponds to an (environment, region) pair.
 */
const PIPELINE_STEPS = [
  { label: "DEV-E", env: "DEV", region: "eastus" },
  { label: "DEV-W", env: "DEV", region: "westus" },
  { label: "STAGE-E", env: "STAGE", region: "eastus" },
  { label: "STAGE-W", env: "STAGE", region: "westus" },
  { label: "PROD-E", env: "PROD", region: "eastus" },
  { label: "PROD-W", env: "PROD", region: "westus" },
] as const;

interface PromotionGridProps {
  readonly apps: readonly ApplicationStatus[];
}

/**
 * Extracts the image tag from a full image path (e.g. "myregistry/app:1.3.2" -> "1.3.2").
 * Returns the full string if no tag separator is found.
 */
function extractTag(imagePath: string): string {
  const colonIdx = imagePath.lastIndexOf(":");
  return colonIdx === -1 ? imagePath : imagePath.slice(colonIdx + 1);
}

/**
 * Groups applications by name, building a map of name -> step -> ApplicationStatus.
 */
function buildPromotionMap(
  apps: readonly ApplicationStatus[],
): Map<string, Map<string, ApplicationStatus>> {
  const map = new Map<string, Map<string, ApplicationStatus>>();
  for (const app of apps) {
    const key = `${app.environment}-${app.region}`;
    if (!map.has(app.name)) {
      map.set(app.name, new Map());
    }
    map.get(app.name)!.set(key, app);
  }
  return map;
}

export function PromotionGrid({ apps }: PromotionGridProps): ReactElement {
  const promotionMap = buildPromotionMap(apps);
  const appNames = [...promotionMap.keys()].sort();

  return (
    <div className="overflow-x-auto">
      <table
        className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
        aria-label="Image promotion grid"
      >
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              scope="col"
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              App Name
            </th>
            {PIPELINE_STEPS.map((step) => (
              <th
                key={step.label}
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {step.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {appNames.map((name) => {
            const stepMap = promotionMap.get(name)!;
            return (
              <tr key={name}>
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {name}
                </td>
                {PIPELINE_STEPS.map((step, idx) => {
                  const stepKey = `${step.env}-${step.region}`;
                  const app = stepMap.get(stepKey);
                  const firstImage = app?.images[0] ?? "";
                  const tag = firstImage ? extractTag(firstImage) : "\u2014";

                  // Previous step tag for mismatch detection
                  let previousTag: string | undefined;
                  if (idx > 0) {
                    const prevStep = PIPELINE_STEPS[idx - 1]!;
                    const prevKey = `${prevStep.env}-${prevStep.region}`;
                    const prevApp = stepMap.get(prevKey);
                    const prevImage = prevApp?.images[0] ?? "";
                    previousTag = prevImage ? extractTag(prevImage) : undefined;
                  }

                  return (
                    <TagCell
                      key={step.label}
                      tag={tag}
                      fullImagePath={firstImage || "No image"}
                      previousTag={previousTag}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

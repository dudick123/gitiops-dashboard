import type { ReactElement } from "react";
import { useImagePromotion } from "../../hooks/use-image-promotion";
import { useProjectScope } from "../../hooks/use-project-scope";
import { PromotionGrid } from "./promotion-grid";

export function ImagePromotionModule(): ReactElement {
  const { project } = useProjectScope();
  const projectParam = project ?? undefined;
  // Fetch from all environments to build the promotion grid
  const devQuery = useImagePromotion("DEV", projectParam);
  const stageQuery = useImagePromotion("STAGE", projectParam);
  const prodQuery = useImagePromotion("PROD", projectParam);

  const isLoading =
    devQuery.isLoading || stageQuery.isLoading || prodQuery.isLoading;
  const isError = devQuery.isError || stageQuery.isError || prodQuery.isError;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        aria-live="polite"
      >
        <p className="text-gray-500">Loading image promotion data...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700" role="alert">
        Failed to load image promotion data. Please try again.
      </div>
    );
  }

  const allApps = [
    ...(devQuery.data ?? []),
    ...(stageQuery.data ?? []),
    ...(prodQuery.data ?? []),
  ];

  return (
    <section aria-label="Image Promotion">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Image Promotion
      </h2>
      <PromotionGrid apps={allApps} />
    </section>
  );
}

export default ImagePromotionModule;

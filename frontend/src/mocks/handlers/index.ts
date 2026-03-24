import { http, HttpResponse } from "msw";
import { argocdHandlers } from "./argocd";
import { prometheusHandlers } from "./prometheus";
import { networkHandlers } from "./network";
import { mockData } from "../data";

// Dedicated handler for STAGE apps that returns 503 for westus (degraded state demo)
// This replaces the generic /api/argocd/:env/apps handler for the stage environment
const stageDegradedHandler = http.get("/api/argocd/stage/apps", ({ request }) => {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");

  // Simulate STAGE-West ArgoCD degraded state (503)
  if (region === "westus") {
    return HttpResponse.json(
      {
        error: "Service Unavailable",
        message: "ArgoCD STAGE-West is experiencing connectivity issues",
      },
      { status: 503 },
    );
  }

  // For non-westus stage requests, return the normal filtered data
  const project = url.searchParams.get("project");
  const health = url.searchParams.get("health");
  const sync = url.searchParams.get("sync");

  let apps = mockData.applications.filter((a) => a.environment === "STAGE");

  if (project) {
    apps = apps.filter((a) => a.project === project);
  }
  if (region) {
    apps = apps.filter((a) => a.region === region);
  }
  if (health) {
    apps = apps.filter((a) => a.health === health);
  }
  if (sync) {
    apps = apps.filter((a) => a.sync === sync);
  }

  return HttpResponse.json({ items: apps, total: apps.length });
});

export const handlers = [
  // Degraded handler must come first so it intercepts /api/argocd/stage/apps
  // before the generic /api/argocd/:env/apps handler
  stageDegradedHandler,
  ...argocdHandlers,
  ...prometheusHandlers,
  ...networkHandlers,
];

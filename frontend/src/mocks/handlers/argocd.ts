import { http, HttpResponse } from "msw";
import { mockData } from "../data";

const ENV_MAP: Record<string, string> = {
  dev: "DEV",
  stage: "STAGE",
  prod: "PROD",
};

export const argocdHandlers = [
  // List projects for an environment
  http.get("/api/argocd/:env/projects", ({ params }) => {
    const env = ENV_MAP[(params["env"] as string).toLowerCase()];
    if (!env) {
      return HttpResponse.json({ error: "Unknown environment" }, { status: 400 });
    }

    // Projects are shared across environments, but filter destinations
    const projects = mockData.projects.map((p) => ({
      ...p,
      destinations: p.destinations.filter((d) => d.cluster.includes(env.toLowerCase())),
    }));

    return HttpResponse.json({ items: projects });
  }),

  // List applications for an environment
  http.get("/api/argocd/:env/apps", ({ params, request }) => {
    const env = ENV_MAP[(params["env"] as string).toLowerCase()];
    if (!env) {
      return HttpResponse.json({ error: "Unknown environment" }, { status: 400 });
    }

    // Simulate STAGE-West degraded state (503) handled in handlers/index.ts
    const url = new URL(request.url);
    const project = url.searchParams.get("project");
    const region = url.searchParams.get("region");
    const health = url.searchParams.get("health");
    const sync = url.searchParams.get("sync");

    let apps = mockData.applications.filter((a) => a.environment === env);

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
  }),

  // Get a single application
  http.get("/api/argocd/:env/apps/:name", ({ params }) => {
    const env = ENV_MAP[(params["env"] as string).toLowerCase()];
    const name = params["name"] as string;

    const app = mockData.applications.find((a) => a.name === name && a.environment === env);
    if (!app) {
      return HttpResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return HttpResponse.json(app);
  }),

  // List application sets for an environment
  http.get("/api/argocd/:env/appsets", ({ params }) => {
    const env = ENV_MAP[(params["env"] as string).toLowerCase()];
    if (!env) {
      return HttpResponse.json({ error: "Unknown environment" }, { status: 400 });
    }

    // AppSets exist at the ArgoCD level; filter their apps by environment
    const appSets = mockData.appSets.map((as) => ({
      ...as,
      applications: as.applications.filter((appName) =>
        appName.includes(env.toLowerCase()),
      ),
    }));

    return HttpResponse.json({ items: appSets });
  }),

  // Summary/overview for an environment
  http.get("/api/argocd/:env/summary", ({ params }) => {
    const env = ENV_MAP[(params["env"] as string).toLowerCase()];
    if (!env) {
      return HttpResponse.json({ error: "Unknown environment" }, { status: 400 });
    }

    const apps = mockData.applications.filter((a) => a.environment === env);
    const healthCounts: Record<string, number> = {};
    const syncCounts: Record<string, number> = {};

    for (const app of apps) {
      healthCounts[app.health] = (healthCounts[app.health] || 0) + 1;
      syncCounts[app.sync] = (syncCounts[app.sync] || 0) + 1;
    }

    return HttpResponse.json({
      totalApplications: apps.length,
      healthCounts,
      syncCounts,
      projectCount: mockData.projects.length,
      appSetCount: mockData.appSets.length,
    });
  }),
];

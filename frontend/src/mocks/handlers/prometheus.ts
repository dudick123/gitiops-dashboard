import { http, HttpResponse } from "msw";
import { mockData } from "../data";

export const prometheusHandlers = [
  // Namespace-level CPU/memory metrics (platform view)
  http.get("/api/prometheus/metrics/namespaces", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const region = url.searchParams.get("region");
    const namespace = url.searchParams.get("namespace");

    // Return only namespace-level metrics (no workload field)
    let metrics = mockData.metrics.filter((m) => !m.workload);

    if (env) {
      metrics = metrics.filter((m) => m.environment === env);
    }
    if (region) {
      metrics = metrics.filter((m) => m.region === region);
    }
    if (namespace) {
      metrics = metrics.filter((m) => m.namespace === namespace);
    }

    return HttpResponse.json({ items: metrics, total: metrics.length });
  }),

  // Workload-level CPU/memory metrics (project view)
  http.get("/api/prometheus/metrics/workloads", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const region = url.searchParams.get("region");
    const namespace = url.searchParams.get("namespace");

    // Return only workload-level metrics (has workload field)
    let metrics = mockData.metrics.filter((m) => m.workload);

    if (env) {
      metrics = metrics.filter((m) => m.environment === env);
    }
    if (region) {
      metrics = metrics.filter((m) => m.region === region);
    }
    if (namespace) {
      metrics = metrics.filter((m) => m.namespace === namespace);
    }

    return HttpResponse.json({ items: metrics, total: metrics.length });
  }),

  // Namespace resource quotas
  http.get("/api/prometheus/quotas", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const region = url.searchParams.get("region");
    const namespace = url.searchParams.get("namespace");

    let quotas = [...mockData.quotas];

    if (env) {
      quotas = quotas.filter((q) => q.environment === env);
    }
    if (region) {
      quotas = quotas.filter((q) => q.region === region);
    }
    if (namespace) {
      quotas = quotas.filter((q) => q.namespace === namespace);
    }

    return HttpResponse.json({ items: quotas, total: quotas.length });
  }),

  // OOM kill events
  http.get("/api/prometheus/oom-events", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const region = url.searchParams.get("region");
    const namespace = url.searchParams.get("namespace");

    let events = [...mockData.oomEvents];

    if (env) {
      events = events.filter((e) => e.environment === env);
    }
    if (region) {
      events = events.filter((e) => e.region === region);
    }
    if (namespace) {
      events = events.filter((e) => e.namespace === namespace);
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return HttpResponse.json({ items: events, total: events.length });
  }),
];

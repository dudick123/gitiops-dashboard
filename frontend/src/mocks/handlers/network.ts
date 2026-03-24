import { http, HttpResponse } from "msw";
import { mockData } from "../data";

export const networkHandlers = [
  // List network policies
  http.get("/api/network/policies", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const cluster = url.searchParams.get("cluster");
    const namespace = url.searchParams.get("namespace");

    let policies = [...mockData.policies];

    if (env) {
      policies = policies.filter((p) => p.environment === env);
    }
    if (cluster) {
      policies = policies.filter((p) => p.cluster === cluster);
    }
    if (namespace) {
      policies = policies.filter((p) => p.namespace === namespace);
    }

    return HttpResponse.json({ items: policies, total: policies.length });
  }),

  // Namespaces with open egress (no egress restriction)
  http.get("/api/network/policies/open-egress", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const cluster = url.searchParams.get("cluster");

    let policies = mockData.policies.filter((p) => !p.hasEgressRestriction);

    if (env) {
      policies = policies.filter((p) => p.environment === env);
    }
    if (cluster) {
      policies = policies.filter((p) => p.cluster === cluster);
    }

    // Group by namespace
    const namespaces = [...new Set(policies.map((p) => p.namespace))];
    const results = namespaces.map((ns) => ({
      namespace: ns,
      policies: policies.filter((p) => p.namespace === ns),
    }));

    return HttpResponse.json({ items: results, total: results.length });
  }),

  // Cilium drop metrics
  http.get("/api/network/cilium/drops", ({ request }) => {
    const url = new URL(request.url);
    const env = url.searchParams.get("environment");
    const region = url.searchParams.get("region");

    let drops = [...mockData.ciliumDrops];

    if (env) {
      drops = drops.filter((d) => d.environment === env);
    }
    if (region) {
      drops = drops.filter((d) => d.region === region);
    }

    return HttpResponse.json({ items: drops, total: drops.length });
  }),

  // Denied connections
  http.get("/api/network/connections/denied", ({ request }) => {
    const url = new URL(request.url);
    const cluster = url.searchParams.get("cluster");
    const direction = url.searchParams.get("direction");
    const namespace = url.searchParams.get("namespace");

    let connections = [...mockData.deniedConnections];

    if (cluster) {
      connections = connections.filter((c) => c.cluster === cluster);
    }
    if (direction) {
      connections = connections.filter((c) => c.direction === direction);
    }
    if (namespace) {
      connections = connections.filter(
        (c) => c.sourceNamespace === namespace || c.destNamespace === namespace,
      );
    }

    return HttpResponse.json({ items: connections, total: connections.length });
  }),
];

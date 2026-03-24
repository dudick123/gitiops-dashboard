export const PROJECTS = [
  {
    name: "platform-infra",
    description: "Core platform infrastructure",
    appSets: ["ingress-controllers", "cert-managers", "external-secrets-operators"],
    standaloneApps: ["monitoring-stack", "logging-pipeline"],
  },
  {
    name: "payment-service",
    description: "Payment processing platform",
    appSets: ["payment-apis", "payment-workers"],
    standaloneApps: ["payment-gateway", "payment-reconciler", "payment-notifications"],
  },
  {
    name: "auth-service",
    description: "Authentication and authorization",
    appSets: ["auth-apis"],
    standaloneApps: ["auth-worker", "token-service", "session-store"],
  },
  {
    name: "notification-service",
    description: "Multi-channel notifications",
    appSets: ["notification-dispatchers", "notification-renderers"],
    standaloneApps: ["email-sender", "sms-gateway", "push-service", "notification-scheduler"],
  },
  {
    name: "data-pipeline",
    description: "Data ingestion and processing",
    appSets: ["etl-jobs", "stream-processors", "data-validators"],
    standaloneApps: ["schema-registry", "data-catalog", "pipeline-orchestrator", "dead-letter-handler"],
  },
] as const;

export const ENVIRONMENTS = ["DEV", "STAGE", "PROD"] as const;
export const REGIONS = ["eastus", "westus"] as const;
export const NAMESPACES = PROJECTS.map((p) => p.name);

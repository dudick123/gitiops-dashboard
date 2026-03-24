import type { NetworkPolicy, CiliumDrop, DeniedConnection } from "./types";
import { PROJECTS, ENVIRONMENTS, REGIONS } from "./seed";

// Deterministic pseudo-random number generator (mulberry32) with different seed
function createRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(99999);

function pick<T>(arr: readonly T[]): T {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- array is never empty
  return arr[Math.floor(rng() * arr.length)]!;
}

export function generatePolicies(): NetworkPolicy[] {
  const policies: NetworkPolicy[] = [];

  for (const project of PROJECTS) {
    for (const env of ENVIRONMENTS) {
      for (const region of REGIONS) {
        const cluster = `aks-${env.toLowerCase()}-${region}`;
        // 2-3 policies per namespace per cluster
        const policyCount = 2 + Math.floor(rng() * 2);

        for (let i = 0; i < policyCount; i++) {
          const policyNames = [
            `${project.name}-default-deny`,
            `${project.name}-allow-ingress`,
            `${project.name}-allow-egress`,
            `${project.name}-allow-dns`,
            `${project.name}-allow-monitoring`,
          ];
          const name = policyNames[i % policyNames.length] ?? "default-policy";

          // Some namespaces deliberately have no egress restriction for the open-egress warning
          // Make ~20% of policies lack egress restriction
          const hasEgressRestriction = rng() > 0.2;

          policies.push({
            name,
            namespace: project.name,
            hasEgressRestriction,
            ingressRuleCount: 1 + Math.floor(rng() * 4),
            egressRuleCount: hasEgressRestriction ? 1 + Math.floor(rng() * 3) : 0,
            environment: env,
            cluster,
          });
        }
      }
    }
  }

  return policies;
}

export function generateCiliumDrops(): CiliumDrop[] {
  const drops: CiliumDrop[] = [];
  const namespaces = PROJECTS.map((p) => p.name);

  // 5-10 CiliumDrop records
  const count = 5 + Math.floor(rng() * 6);

  for (let i = 0; i < count; i++) {
    let src = pick(namespaces);
    let dest = pick(namespaces);
    // Avoid same namespace for source and dest most of the time
    if (src === dest && namespaces.length > 1) {
      dest = namespaces[(namespaces.indexOf(dest) + 1) % namespaces.length] ?? dest;
    }

    const env = pick(ENVIRONMENTS);
    const region = pick(REGIONS);

    drops.push({
      sourceNamespace: src,
      destNamespace: dest,
      ingressDrops: Math.floor(rng() * 500),
      egressDrops: Math.floor(rng() * 300),
      tcpResets: Math.floor(rng() * 50),
      environment: env,
      region,
    });
  }

  return drops;
}

export function generateDeniedConnections(): DeniedConnection[] {
  const connections: DeniedConnection[] = [];
  const namespaces = PROJECTS.map((p) => p.name);
  const protocols = ["TCP", "UDP"] as const;
  const commonPorts = [80, 443, 5432, 6379, 8080, 8443, 9090, 3000, 27017, 5672];
  const verdicts = [
    "DROPPED by default-deny",
    "DROPPED by egress-restriction",
    "DROPPED by namespace-isolation",
    "REJECTED by rate-limit-policy",
  ];

  // 5-10 DeniedConnection records
  const count = 5 + Math.floor(rng() * 6);

  for (let i = 0; i < count; i++) {
    let src = pick(namespaces);
    let dest = pick(namespaces);
    if (src === dest && namespaces.length > 1) {
      dest = namespaces[(namespaces.indexOf(dest) + 1) % namespaces.length] ?? dest;
    }

    const env = pick(["DEV", "STAGE", "PROD"] as const);
    const region = pick(["eastus", "westus"] as const);

    connections.push({
      direction: rng() < 0.5 ? "ingress" : "egress",
      sourceNamespace: src,
      destNamespace: dest,
      protocol: pick(protocols),
      port: pick(commonPorts),
      dropCount: Math.floor(rng() * 1000),
      resetCount: Math.floor(rng() * 100),
      policyVerdict: pick(verdicts),
      cluster: `aks-${env.toLowerCase()}-${region}`,
    });
  }

  return connections;
}

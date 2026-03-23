## ADDED Requirements

### Requirement: Network policy display and Cilium flow data (PRD §5.3 Module 4)

#### Scenario: Platform View lists NetworkPolicy objects per namespace
- **WHEN** "All Projects" is selected
- **THEN** the network module SHALL list NetworkPolicy objects per namespace, filterable by environment and cluster

#### Scenario: Open egress warning (PRD NS-02)
- **WHEN** a namespace has no egress restriction
- **THEN** a warning badge SHALL be displayed

#### Scenario: Cilium drop summary (PRD NS-03)
- **WHEN** the network module renders
- **THEN** Cilium L3/L4 drop counts (ingress drops, egress drops, TCP resets) SHALL be displayed

#### Scenario: Denied connections table (PRD NS-04)
- **WHEN** the network module renders
- **THEN** a denied connections table SHALL show direction, source namespace, destination namespace, protocol, port, drop count, and policy verdict

#### Scenario: Project View scopes to project namespace (PRD §5.3 Module 4)
- **WHEN** a project is selected
- **THEN** only NetworkPolicies and Cilium flows involving the project's namespace SHALL be displayed

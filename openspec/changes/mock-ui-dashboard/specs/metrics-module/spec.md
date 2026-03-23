## ADDED Requirements

### Requirement: CPU and Memory metrics with sparklines (PRD §5.3 Module 3)

#### Scenario: Platform View shows namespace-level metrics
- **WHEN** "All Projects" is selected
- **THEN** the metrics module SHALL display CPU and memory usage at namespace level with sparkline charts (10 data points per TECH-STANDARDS §2)

#### Scenario: Project View shows workload-level metrics (PRD MT-01)
- **WHEN** a project is selected
- **THEN** the metrics module SHALL display Deployment/StatefulSet/Job-level CPU and memory with request/limit ratios

#### Scenario: Namespace quota utilisation displayed (PRD MT-03)
- **WHEN** metrics render for a namespace
- **THEN** a quota utilisation bar SHALL show current usage vs limit

#### Scenario: OOM events listed (PRD MT-05)
- **WHEN** a project is selected
- **THEN** OOM events SHALL display with pod name, container name, memory at kill, limit, and timestamp

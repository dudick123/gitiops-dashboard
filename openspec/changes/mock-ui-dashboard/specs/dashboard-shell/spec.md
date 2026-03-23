## ADDED Requirements

### Requirement: Global navigation shell with persistent project scope selector (PRD §5.2)

The dashboard shell SHALL provide three persistent global filter controls visible on all modules.

#### Scenario: Project scope selector lists all ArgoCD projects
- **WHEN** the dashboard loads
- **THEN** a project scope selector SHALL be visible with "All Projects" as the default and all mock ArgoCD projects as options

#### Scenario: Project selection persists across browser sessions (PRD PS-04)
- **WHEN** the user selects a project
- **THEN** the selection SHALL be stored in localStorage with key prefix `gitops-dashboard:`
- **AND** on page reload, the previously selected project SHALL be restored

#### Scenario: Environment and region filters are visible
- **WHEN** the dashboard loads
- **THEN** environment filter (DEV/STAGE/PROD) and region filter (East US/West US/Both) SHALL be visible and functional

#### Scenario: Platform View vs Project View switching (PRD §5.2)
- **WHEN** "All Projects" is selected
- **THEN** the dashboard SHALL display Platform View with namespace-level aggregates
- **WHEN** a specific project is selected
- **THEN** the dashboard SHALL display Project View with workload-level detail

### Requirement: Module routing with lazy loading (TECH-STANDARDS §2)

#### Scenario: Dashboard modules load on navigation
- **WHEN** the user navigates to a module tab
- **THEN** the module code SHALL load lazily via React.lazy
- **AND** a skeleton loader SHALL display during load

### Requirement: Data freshness indicators on every module (PRD §5.4)

#### Scenario: Last updated timestamp displayed
- **WHEN** any module renders data
- **THEN** a "Last updated" timestamp SHALL be visible showing when mock data was loaded

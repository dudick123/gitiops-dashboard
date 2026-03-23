## ADDED Requirements

### Requirement: Application Status grid displays health and sync state (PRD §5.3 Module 1)

#### Scenario: Platform View shows flat application list
- **WHEN** "All Projects" is selected
- **THEN** the grid SHALL display all applications as rows with columns for DEV (East/West), STAGE (East/West), PROD (East/West)
- **AND** each cell SHALL show health (Healthy/Degraded/Unknown/Error) and sync (Synced/OutOfSync) status with colour + text indicator

#### Scenario: Project View shows ApplicationSet hierarchy (PRD AS-04)
- **WHEN** a specific project is selected
- **THEN** ApplicationSets SHALL display as collapsible parent rows with child Applications nested underneath
- **AND** standalone Applications (not from an ApplicationSet) SHALL display below the groups

#### Scenario: Text search filters applications (PRD AS-02)
- **WHEN** the user types in the search box
- **THEN** the application list SHALL filter in real time by name

#### Scenario: Virtualised scrolling handles 850+ rows (TECH-STANDARDS §2)
- **WHEN** the Platform View renders 850+ applications
- **THEN** only visible rows (plus overscan buffer) SHALL be rendered as DOM nodes using @tanstack/react-virtual

#### Scenario: Degraded state shows Unknown with timestamp (PRD DG-01)
- **WHEN** a connector returns 503 for a specific environment
- **THEN** the affected column SHALL show "Unknown" with the last successful refresh timestamp

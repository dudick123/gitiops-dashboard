## ADDED Requirements

### Requirement: Image Promotion view shows tag progression (PRD §5.3 Module 2)

#### Scenario: Promotion pipeline displays 6 steps
- **WHEN** the Image Promotion module renders
- **THEN** each application row SHALL show the deployed image tag at each step: DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West

#### Scenario: Tag mismatches highlighted (PRD IP-02)
- **WHEN** adjacent pipeline steps have different image tags
- **THEN** the mismatched cells SHALL be visually flagged with amber highlight

#### Scenario: Non-semver tags flagged (PRD IP-03)
- **WHEN** an image tag does not match semver pattern
- **THEN** a warning indicator SHALL be displayed on that cell

#### Scenario: Project View scopes to selected project (PRD §5.3 Module 2)
- **WHEN** a project is selected
- **THEN** only applications belonging to that project SHALL appear in the promotion grid

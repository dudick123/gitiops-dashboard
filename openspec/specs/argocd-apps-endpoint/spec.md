## ADDED Requirements

### Requirement: /apps endpoint returns ArgoCD application status list (PRD §4.3)

The argocd-connector SHALL expose a GET `/apps` endpoint returning a list of Application status records.

#### Scenario: GET /apps returns all applications
- **WHEN** a GET request is made to `/apps`
- **THEN** the response SHALL be a JSON array of Application objects
- **AND** each object SHALL include: `name` (str), `project` (str), `environment` (str), `region` (str), `health` (Literal["Healthy", "Degraded", "Progressing", "Suspended", "Missing", "Unknown"]), `sync` (Literal["Synced", "OutOfSync", "Unknown"]), `images` (list of str)
- **AND** the response status code SHALL be 200

#### Scenario: GET /apps supports project filter (PRD §4.3)
- **WHEN** a GET request is made to `/apps?project=auth-service`
- **THEN** the response SHALL contain only applications where `project` equals `auth-service`

#### Scenario: /apps response is cached in Redis with 30-min TTL
- **WHEN** a GET request is made to `/apps`
- **AND** the Redis cache contains a valid entry for the request
- **THEN** the cached data SHALL be returned without calling the upstream service
- **AND** the cache key SHALL follow the pattern `argocd:{environment}:{region}:apps`

#### Scenario: /apps falls through to upstream on cache miss
- **WHEN** a GET request is made to `/apps`
- **AND** the Redis cache does not contain a valid entry
- **THEN** the upstream service SHALL be called
- **AND** the result SHALL be written to Redis with TTL of 1800 seconds (30 minutes)

#### Scenario: /apps returns 502 on upstream failure
- **WHEN** a GET request is made to `/apps`
- **AND** the upstream service raises an error
- **AND** no cached data is available
- **THEN** the response SHALL be a 502 with an ErrorResponse body containing `error`, `detail`, `connector`, and `timestamp` fields
- **AND** the `detail` field SHALL NOT contain stack traces, internal paths, or credential values

#### Scenario: /apps returns cached data on upstream failure (graceful degradation)
- **WHEN** a GET request is made to `/apps`
- **AND** the upstream service raises an error
- **AND** cached data IS available (stale)
- **THEN** the stale cached data SHALL be returned with a 200 status

### Requirement: FastAPI lifespan manages httpx and Redis lifecycle (TECH-STANDARDS §4)

#### Scenario: Lifespan creates and closes connections
- **WHEN** the FastAPI application starts
- **THEN** an httpx.AsyncClient SHALL be created with explicit timeouts
- **AND** a redis.asyncio connection pool SHALL be created with authentication
- **WHEN** the application shuts down
- **THEN** both connections SHALL be closed cleanly

### Requirement: CI toolchain passes on the implemented code

#### Scenario: make lint passes
- **WHEN** `make lint` is run
- **THEN** ruff SHALL report zero violations across all 19 rule sets

#### Scenario: make typecheck passes
- **WHEN** `make typecheck` is run
- **THEN** mypy --strict SHALL report zero errors for the argocd-connector

#### Scenario: make test passes with 90%+ coverage
- **WHEN** `make test` is run
- **THEN** all tests SHALL pass
- **AND** line coverage for `connectors/argocd-connector/src/` SHALL be >= 90%

#### Scenario: Docker image builds and serves
- **WHEN** `docker build` is run from the argocd-connector directory
- **THEN** the image SHALL build without errors
- **AND** `docker run` SHALL serve `/healthz` returning HTTP 200
- **AND** `docker run` SHALL serve `/apps` returning a JSON array

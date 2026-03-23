---
reviewer: Senior QA Test Engineer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior QA Test Engineer — Review: repo-scaffolding

## Summary

The repo-scaffolding proposal creates the foundational monorepo structure for the GitOps Dashboard project. While the directory layout and build tooling are well-considered, the proposal has **significant gaps in test infrastructure** relative to the requirements defined in TECH-STANDARDS.md v1.5 section 8. The scaffold is the ideal moment to establish testing conventions, configurations, and directory structures that enforce TDD from day one. As written, the proposal defers nearly all testing decisions to future connector proposals, which will lead to inconsistency and rework. This review identifies 10 critical findings and 8 recommendations.

## Critical Findings

### Finding QA-1: Missing `tests/unit/` subdirectory in connector test scaffolds

- **Artifact**: tasks.md
- **Location**: Tasks 2.6, 3.6, 4.6
- **Issue**: Task 2.6 creates `tests/generated/` and `tests/integration/` but does not create `tests/unit/`. Tasks 3.6 and 4.6 say only "empty subdirectories" without specifying which ones. TECH-STANDARDS section 8 explicitly requires `tests/unit/` and `tests/integration/` per connector.
- **Impact**: Without a `tests/unit/` directory in the scaffold, the first developer writing a connector has no clear place to put unit tests. This delays TDD adoption and risks inconsistent directory structures across connectors.
- **Recommendation**: Explicitly create `tests/unit/`, `tests/integration/`, and `tests/generated/` with `__init__.py` files in all three connector test tasks (2.6, 3.6, 4.6). Ensure task wording is consistent across all connectors.

### Finding QA-2: No pytest configuration in pyproject.toml

- **Artifact**: tasks.md, design.md
- **Location**: Tasks 2.1, 3.1, 4.1 (pyproject.toml creation)
- **Issue**: The pyproject.toml tasks specify runtime dependencies (FastAPI, Pydantic, structlog, redis, uvicorn) but do not mention `[tool.pytest.ini_options]` configuration. TECH-STANDARDS section 8 requires `asyncio_mode = "auto"` in pyproject.toml. Without this, async tests will fail or require manual `@pytest.mark.asyncio` decorators on every test.
- **Impact**: Every connector proposal will need to independently discover and add pytest configuration, leading to divergence. Async tests will not work out of the box, contradicting the "works from day one" design goal.
- **Recommendation**: Add `[tool.pytest.ini_options]` with `asyncio_mode = "auto"`, `testpaths = ["tests"]`, and `addopts = "--cov=src --cov-report=term-missing --cov-fail-under=90"` to each connector's `pyproject.toml` task.

### Finding QA-3: No test dependencies declared

- **Artifact**: tasks.md, design.md
- **Location**: Tasks 2.1, 3.1, 4.1
- **Issue**: The pyproject.toml tasks list only runtime dependencies. TECH-STANDARDS section 5 (Python Dependencies) specifies that `pytest`, `pytest-asyncio`, `pytest-cov`, `pytest-mock` are shared dev dependencies. Additionally, `respx` (for HTTP mocking) and `httpx` (for AsyncClient test transport) are required by section 8. None of these are mentioned in the scaffold tasks.
- **Impact**: `make test` will fail immediately because pytest is not installed. Developers cannot write or run any tests until they manually figure out which test packages to add.
- **Recommendation**: Add `[project.optional-dependencies]` or `[dependency-groups]` dev group to each connector's `pyproject.toml` including: `pytest`, `pytest-asyncio`, `pytest-cov`, `pytest-mock`, `respx`, `httpx`. Also add a workspace-level `pyproject.toml` with shared dev dependency versions per TECH-STANDARDS section 5.

### Finding QA-4: No conftest.py scaffold

- **Artifact**: tasks.md
- **Location**: Tasks 2.6, 3.6, 4.6 (test directory creation)
- **Issue**: TECH-STANDARDS section 8 states "Shared fixtures live in `conftest.py`." The scaffold creates empty test directories but does not include even a minimal `conftest.py` in each connector's `tests/` directory. This is the natural place to establish the FastAPI test client fixture pattern (`httpx.AsyncClient` with `ASGITransport`) that section 8 explicitly documents.
- **Impact**: Each connector developer will create their own conftest.py from scratch, likely with different patterns. The standard `AsyncClient` fixture pattern will not be consistently applied.
- **Recommendation**: Create a `conftest.py` in each connector's `tests/` directory with at minimum: (1) an async FastAPI app fixture using `ASGITransport`, (2) a mock Redis fixture, and (3) a comment block referencing the TECH-STANDARDS section 8 test client pattern.

### Finding QA-5: No frontend test infrastructure

- **Artifact**: tasks.md
- **Location**: Section 5 (Frontend Scaffold), specifically tasks 5.1-5.12
- **Issue**: The frontend scaffold creates `src/` directories with `.gitkeep` files but includes zero test infrastructure. Missing items required by TECH-STANDARDS section 8 (Frontend): (1) `vitest.config.ts`, (2) MSW setup (`frontend/src/mocks/handlers/` directory and `frontend/src/mocks/browser.ts` / `server.ts`), (3) test utilities file with `createTestQueryClient` and `renderWithQuery` helpers, (4) Vitest and React Testing Library in `package.json` devDependencies, (5) `@axe-core/react` or `vitest-axe` for accessibility testing.
- **Impact**: The frontend is entirely untestable after scaffold. Unlike the backend where at least empty test directories exist, the frontend has no test directory, no test runner config, and no test dependencies. This is the largest single gap in the proposal.
- **Recommendation**: Add the following tasks: (a) `vitest.config.ts` with React plugin, coverage thresholds (80%), and `src/api/` exclusion; (b) `frontend/src/mocks/handlers/` directory with `.gitkeep`; (c) `frontend/src/test-utils.tsx` with `renderWithQuery` wrapper; (d) Vitest, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `msw`, and `vitest-axe` in `package.json` devDependencies.

### Finding QA-6: Makefile `test` target is underspecified

- **Artifact**: tasks.md, spec.md
- **Location**: Task 1.3, spec.md Makefile requirement
- **Issue**: Task 1.3 lists a single `test` target. TECH-STANDARDS section 9 defines four distinct test targets: `test` (pytest with coverage across all connectors), `test-unit` (unit tests only), `test-int` (integration tests only), `test-frontend` (Vitest). The proposal Makefile omits `test-unit`, `test-int`, and `test-frontend`. It also omits `check` and `check-all` (combined lint + typecheck + test gates).
- **Impact**: Developers cannot run unit tests in isolation during TDD red-green-refactor cycles. CI cannot run test stages independently. Frontend tests have no Makefile entry point.
- **Recommendation**: Expand the Makefile task to include all test-related targets from TECH-STANDARDS section 9: `test`, `test-unit`, `test-int`, `test-frontend`, `check`, `check-all`.

### Finding QA-7: No coverage configuration or thresholds

- **Artifact**: tasks.md, spec.md, design.md
- **Location**: Entire proposal
- **Issue**: TECH-STANDARDS section 8 requires 90%+ line coverage for each connector's `src/` directory and 80%+ for frontend component logic. The scaffold defines no coverage configuration anywhere -- no `[tool.pytest.ini_options]` with `--cov`, no `[tool.coverage.run]` section in pyproject.toml, no coverage thresholds in vitest.config.ts, and no coverage exclusion patterns for generated code.
- **Impact**: Coverage enforcement will not exist until someone manually adds it. Without thresholds from the start, code can be merged with 0% coverage, undermining the TDD mandate.
- **Recommendation**: Add `[tool.coverage.run]` and `[tool.coverage.report]` sections to each connector's `pyproject.toml` with `source = ["src"]`, `fail_under = 90`, and `omit = ["tests/*", "src/generated/*"]`. Add coverage configuration to `vitest.config.ts` with `thresholds: { lines: 80 }` and `exclude: ["src/api/**"]`.

### Finding QA-8: No shared test fixtures package

- **Artifact**: tasks.md
- **Location**: Entire proposal (missing task)
- **Issue**: TECH-STANDARDS section 8 states: "Common fixtures across connectors (e.g., mock Redis, mock httpx responses) live in a shared `tests/fixtures/` package." No task creates this shared fixtures directory. The location is ambiguous (repo root `tests/fixtures/` or per-connector), but the standard clearly intends a cross-connector shared package.
- **Impact**: Each connector will independently create mock Redis fixtures and mock HTTP transport fixtures, leading to duplication and inconsistency across the three connectors.
- **Recommendation**: Add a task to create `tests/fixtures/` at the repo root (or under a `shared/` directory) with `__init__.py`, `redis.py` (mock Redis fixture), and `http.py` (mock httpx transport fixture). Include this package as a dev dependency path in each connector's pyproject.toml.

### Finding QA-9: spec.md has no testability requirements

- **Artifact**: spec.md
- **Location**: specs/repo-scaffold/spec.md -- entire document
- **Issue**: The spec.md defines 10 requirements with scenarios, but none address testability of the scaffold itself. There are no scenarios verifying: (1) `make test` succeeds with zero tests (exit 0, not error), (2) pytest collects zero tests without error from each connector, (3) vitest runs without error from the frontend, (4) coverage reports generate correctly even with no source code. These are verifiable properties of the scaffold.
- **Impact**: There is no definition of "done" for testing infrastructure. A scaffold that creates test directories but where `make test` fails due to missing dependencies would technically satisfy all current spec scenarios.
- **Recommendation**: Add a "Testability" requirement to spec.md with scenarios: (a) `make test` exits 0 with "no tests collected" from a clean scaffold, (b) `make test-frontend` exits 0 with "no tests found", (c) pytest configuration is parseable (`pytest --co` exits 0), (d) coverage configuration is valid.

### Finding QA-10: No security test scaffolding

- **Artifact**: tasks.md
- **Location**: Missing from all connector test tasks
- **Issue**: TECH-STANDARDS section 12.8 defines REQUIRED security test patterns: input validation tests (parametrized with path traversal, SQL injection, XSS, oversized input, empty string), auth header handling tests, error response leakage tests, and request limit tests. The scaffold creates no placeholder or template for these patterns in any connector's test directory.
- **Impact**: Security tests are mandatory per TECH-STANDARDS but have no scaffolded home. Developers may not be aware of the requirement until code review, causing late-stage rework.
- **Recommendation**: Create a `tests/unit/test_security.py` template in each connector with commented-out test stubs referencing TECH-STANDARDS section 12.8 patterns. This ensures the patterns are visible to developers from day one.

## Recommendations

### Recommendation QA-1: Add a "Testing Infrastructure" task group to tasks.md

Create a new section (e.g., "Section 9: Testing Infrastructure") that consolidates all test-related scaffold tasks: pytest configuration, test dependencies, conftest.py files, coverage config, vitest config, MSW setup, shared fixtures package, and security test templates. This makes the testing scaffold a first-class deliverable rather than an afterthought scattered across connector tasks.

### Recommendation QA-2: Include a workspace-level pyproject.toml for shared dev dependencies

TECH-STANDARDS section 5 specifies shared dev dependencies at the workspace level. Add a root-level `pyproject.toml` with a `[dependency-groups]` dev section pinning `pytest`, `pytest-asyncio`, `pytest-cov`, `pytest-mock`, `ruff`, and `mypy` versions. This ensures all connectors use identical test tooling versions.

### Recommendation QA-3: Add a `make test-smoke` target for scaffold validation

Create a Makefile target that validates the scaffold is correctly configured: pytest collects without errors, vitest config parses, coverage configuration is valid, and all test directories contain `__init__.py`. This target can run in CI as part of the scaffold PR validation.

### Recommendation QA-4: Document the TDD workflow in a developer-facing location

The scaffold is the first thing developers interact with. Add a `CONTRIBUTING.md` or a "Testing" section in the root README (when created) that references TECH-STANDARDS section 8 and explains the TDD workflow: write failing test, minimal implementation, refactor. Include the `httpx.AsyncClient` + `ASGITransport` pattern and the `renderWithQuery` frontend pattern.

### Recommendation QA-5: Add mypy configuration to pyproject.toml

TECH-STANDARDS section 3 and section 10 (CI checks) require `mypy --strict` on all connectors. The scaffold pyproject.toml tasks do not include `[tool.mypy]` configuration. Add `strict = true`, `plugins = ["pydantic.mypy"]`, and appropriate ignore patterns for generated code.

### Recommendation QA-6: Ensure `make install` installs dev dependencies

Task 1.3 defines `make install` but does not specify whether it installs dev/test dependencies. For a TDD project, `make install` must install test dependencies by default (e.g., `pip install -e ".[dev]"` or `uv sync --group dev`). A developer running `make install && make test` should succeed.

### Recommendation QA-7: Add pre-commit hook configuration

TECH-STANDARDS section 10 references `commitlint` via pre-commit hooks. The scaffold should include a `.pre-commit-config.yaml` with hooks for ruff, mypy, and commitlint. This ensures code quality checks run locally before tests even reach CI.

### Recommendation QA-8: Align package manager with TECH-STANDARDS

Design.md Decision 4 selects pnpm, but TECH-STANDARDS section 5 (Frontend) says "npm (or pnpm if adopted)". Design.md Decision 2 uses pip/hatchling, but TECH-STANDARDS section 5 (Python) says "uv is the sole package manager. Never use pip install directly." The scaffold should use `uv` for Python to match the standard, or the standard should be updated. This affects how `make install` and `make test` work.

## Observations

1. **Tasks 3.6 and 4.6 are vague compared to 2.6**: Task 2.6 explicitly names `tests/generated/` and `tests/integration/`, while 3.6 and 4.6 say only "empty subdirectories." This inconsistency will likely result in different directory structures across connectors. All three should use identical, explicit language.

2. **No `.gitkeep` in empty test subdirectories**: The frontend uses `.gitkeep` files to preserve empty directories, but the backend test directories use `__init__.py`. This is correct for Python packages, but `tests/generated/` may not need an `__init__.py` if its contents are auto-generated. Consider whether `tests/generated/` should have a `.gitkeep` instead, with a note that `__init__.py` will be auto-generated alongside the test files.

3. **The proposal creates `src/main.py` with a health endpoint**: This is actually testable -- it would be valuable to include a corresponding `tests/unit/test_main.py` with a basic health endpoint test as a proof-of-concept for the TDD workflow. This would validate that the entire test chain (pytest, asyncio, httpx, FastAPI) works end-to-end in the scaffold.

4. **Docker Compose does not include a test runner service**: For integration tests that require Redis, developers need either a local Redis or a docker-compose profile for testing. Consider adding a `docker-compose.test.yml` override or a `test` profile.

5. **The proposal mentions `generate-stubs.py` as a placeholder**: The generated spec-conformance tests (`tests/generated/`) depend on this script. The relationship between spec generation and test generation should be documented even if the scripts are placeholders.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| pytest + pytest-asyncio framework (section 8) | NOT MET | No pytest configuration, no test dependencies declared |
| asyncio_mode = "auto" (section 8) | NOT MET | No `[tool.pytest.ini_options]` in any pyproject.toml |
| tests/unit/ + tests/integration/ per connector (section 8) | PARTIAL | tests/integration/ and tests/generated/ in task 2.6; tests/unit/ missing; tasks 3.6/4.6 vague |
| 90%+ line coverage per connector (section 8) | NOT MET | No coverage configuration or thresholds defined |
| conftest.py with factory fixtures (section 8) | NOT MET | No conftest.py created in scaffold |
| Shared tests/fixtures/ package (section 8) | NOT MET | No shared fixtures directory or package |
| Vitest + RTL + MSW frontend testing (section 8) | NOT MET | No frontend test infrastructure whatsoever |
| 80%+ frontend coverage (section 8) | NOT MET | No vitest.config.ts or coverage config |
| MSW handlers directory (section 8) | NOT MET | frontend/src/mocks/handlers/ not created |
| Makefile test/test-unit/test-int/test-frontend (section 9) | PARTIAL | Only `test` target defined; missing test-unit, test-int, test-frontend |
| Makefile check/check-all (section 9) | NOT MET | Not mentioned in scaffold |
| Security test patterns (section 12.8) | NOT MET | No security test templates or stubs |
| CI gate: all tests pass (section 8) | NOT MET | No CI pipeline defined (out of scope, but scaffold should ensure `make test` works) |
| No skipped tests without linked issue (section 8) | N/A | No tests exist yet |
| TDD workflow enforced (section 8) | AT RISK | Scaffold provides no test infrastructure to support TDD from first commit |
| uv as sole Python package manager (section 5) | NOT MET | Design uses pip/hatchling; TECH-STANDARDS mandates uv |

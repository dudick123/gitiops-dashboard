# Post-Implementation Review: Test Infrastructure Scaffolding

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| **Reviewer**   | Senior QA Test Engineer                    |
| **Date**       | 2026-03-23                                 |
| **Scope**      | Test infrastructure across all connectors and frontend |
| **Standard**   | TECH-STANDARDS v1.5, sections 8, 9, 12.8   |

---

## Summary

The test infrastructure scaffolding is structurally aligned with TECH-STANDARDS section 8 but is not executable in its current state. Every `make test` variant will fail immediately due to zero collected tests combined with a 90% coverage floor. Several required fixtures, setup files, and security test patterns specified in the standards are absent. The scaffold provides a correct directory layout and tooling configuration but stops short of being a usable starting point for TDD.

---

## Findings

### QA-1 [BLOCKER] Zero tests means all test targets fail on first run

**Affected files:** All three `connectors/*/tests/` directories; `Makefile` lines 49-53

**Evidence:** Each connector's `pyproject.toml` sets `addopts = "--cov=src --cov-report=term-missing --cov-fail-under=90"`. With no test files present in `tests/unit/`, `tests/integration/`, or `tests/generated/`, pytest will collect 0 tests. Coverage with 0 tests reports 0% line coverage, which fails the `--cov-fail-under=90` threshold. Additionally, `make test-unit` and `make test-int` will exit with `no tests ran` warnings.

**Impact:** `make check` and `make check-all` are broken from day zero. Developers cannot validate that the scaffold itself works. CI gates referencing these targets will block all PRs.

**Recommendation:** Add a minimal smoke test per connector (e.g., `tests/unit/test_health.py`) that hits `/healthz` and asserts a 200 response. This validates the scaffold, exercises the conftest fixture, and provides nonzero coverage. Alternatively, temporarily set `--cov-fail-under=0` until the first real implementation lands, but this risks the threshold never being restored.

---

### QA-2 [HIGH] `from src.main import app` import path is fragile

**Affected files:**
- `connectors/argocd-connector/tests/conftest.py` (line 11)
- `connectors/prometheus-connector/tests/conftest.py` (line 11)
- `connectors/network-connector/tests/conftest.py` (line 11)

**Evidence:** The import `from src.main import app` assumes `src` is importable as a top-level package. This only works if pytest is invoked with the connector root directory as the working directory AND that directory is on `sys.path`. The Makefile does `cd $$dir && uv run pytest`, which changes the working directory, and `uv run` may or may not add the cwd to `sys.path` depending on the project layout configuration. There is no `[tool.pytest.ini_options] pythonpath` setting in any `pyproject.toml`, and no `conftest.py` at the connector root to manipulate the path.

**Impact:** Tests may fail with `ModuleNotFoundError: No module named 'src'` depending on how the test runner resolves imports. This is environment-dependent and will produce different results locally vs. CI.

**Recommendation:** Add `pythonpath = ["."]` to `[tool.pytest.ini_options]` in each connector's `pyproject.toml`, or configure the project as an installable package so `src` is on the path via `uv sync`. Verify with an actual test run.

---

### QA-3 [HIGH] Shared test fixtures package is missing

**Affected:** All connectors

**Evidence:** TECH-STANDARDS section 8 (line 686) states: "Common fixtures across connectors (e.g., mock Redis, mock httpx responses) live in a shared `tests/fixtures/` package." No `tests/fixtures/` directory exists anywhere in the repository. The `Glob` search for `**/tests/fixtures/**` returned zero results.

**Impact:** Each connector will independently implement mock Redis and mock HTTP fixtures, leading to divergent test patterns, duplicated boilerplate, and inconsistency across the three services. The standards explicitly require this shared package.

**Recommendation:** Create a top-level `tests/fixtures/` package (or a shared `testing-utils` package in the monorepo root) containing:
- Mock Redis fixture (async fakeredis or mock)
- Mock httpx response factory (using `respx` or `httpx.MockTransport`)
- Common assertion helpers

Each connector's `conftest.py` should import from this shared package.

---

### QA-4 [HIGH] No mock Redis fixture in conftest.py

**Affected files:** All three `connectors/*/tests/conftest.py`

**Evidence:** The conftest.py files contain only the `client` fixture (AsyncClient with ASGITransport). Every connector lists `redis>=5.0` as a dependency, and the health endpoints reference Redis checks. TECH-STANDARDS section 8 line 686 explicitly calls out "mock Redis" as a required shared fixture. No Redis mock, fakeredis dependency, or Redis fixture exists anywhere in the test infrastructure.

**Impact:** Any test that exercises Redis-dependent code paths (caching, health checks with real Redis connectivity checks) will either require a running Redis instance or fail. This contradicts the unit test principle of fast isolated tests.

**Recommendation:** Add `fakeredis[aiocompat]` or a similar library to each connector's dev dependencies. Create a `mock_redis` fixture that provides an in-memory Redis substitute. Wire it into the app's dependency injection so tests do not require external services.

---

### QA-5 [HIGH] Frontend vitest setupFiles is empty -- jest-dom matchers unavailable

**Affected file:** `frontend/vitest.config.ts` (line 15)

**Evidence:** `setupFiles: []` is explicitly set to an empty array. The project installs `@testing-library/jest-dom` (package.json line 35) but never imports it in a setup file. Without a setup file that calls `import '@testing-library/jest-dom'`, custom matchers like `toBeInTheDocument()`, `toHaveTextContent()`, `toBeVisible()`, etc. will not be available in tests.

**Impact:** The first developer who writes a test using RTL's `expect(element).toBeInTheDocument()` will get a TypeScript/runtime error. This is the most common assertion pattern in React Testing Library and its absence will cause immediate friction.

**Recommendation:** Create `frontend/src/setup-tests.ts` with:
```typescript
import '@testing-library/jest-dom';
```
Update `vitest.config.ts` to: `setupFiles: ['./src/setup-tests.ts']`

---

### QA-6 [MEDIUM] No MSW handlers defined -- frontend integration test pattern incomplete

**Affected file:** `frontend/src/mocks/handlers/.gitkeep`

**Evidence:** The mock handlers directory contains only a `.gitkeep` placeholder. TECH-STANDARDS section 8 (line 709) states: "Define mock handlers per connector in `frontend/src/mocks/handlers/`." No `server.ts` MSW setup file exists, and no example handler demonstrates the expected pattern.

**Impact:** Frontend developers have no working example of the MSW integration pattern. The gap between "MSW is installed" and "MSW is usable in tests" requires creating server setup, defining handlers, and wiring them into test lifecycle hooks. Without at least a skeleton, each developer will implement this differently.

**Recommendation:** Provide a minimal MSW setup:
1. `frontend/src/mocks/server.ts` -- `setupServer()` configuration
2. `frontend/src/mocks/handlers/health.ts` -- example handler for `/healthz`
3. Wire MSW into the vitest setup file (see QA-5) with `beforeAll`/`afterEach`/`afterAll` lifecycle hooks

---

### QA-7 [MEDIUM] Security test patterns from section 12.8 are not scaffolded

**Affected:** All three connector test suites

**Evidence:** TECH-STANDARDS section 12.8 defines REQUIRED test patterns:
- Input validation tests (path traversal, SQL injection, XSS, oversized input, empty string)
- Auth header handling tests (no reflection in responses/logs, upstream auth failures return 502)
- Error response leakage tests (no stack traces, file paths, or env vars in 500 responses)
- Request limit tests (max body size middleware, trusted host middleware)

None of these patterns are scaffolded. No template files, no test stubs, no marker comments indicating where they should go.

**Impact:** Security tests are the most commonly deferred test category. Without scaffolding or stubs, they risk being forgotten entirely until a security review flags their absence.

**Recommendation:** Create `tests/unit/test_security.py` in each connector with stubbed-out test functions matching the section 12.8 patterns. Use `pytest.mark.skip(reason="Awaiting implementation -- TECH-STANDARDS §12.8")` to make them visible in test reports without blocking CI.

---

### QA-8 [MEDIUM] Coverage threshold of 90% with no grace period blocks TDD workflow

**Affected files:** All three `connectors/*/pyproject.toml` (line 30)

**Evidence:** `--cov-fail-under=90` is hardcoded in `addopts`. The Makefile `test` target also duplicates this: `--cov=src --cov-report=term-missing --cov-fail-under=90`. TECH-STANDARDS section 8 says "Target: 90%+ line coverage" but frames it as a target, not a hard gate for the initial scaffold.

**Impact:** During early development, adding a new module to `src/` (e.g., `src/routes/apps.py`) without simultaneously writing complete tests will fail CI. This is correct for a mature codebase but punitive for a scaffold where developers are building the first implementation. The TDD workflow described in the standards (write test first, then implement) partially mitigates this, but structural code (models, config, middleware) often precedes testable routes.

**Recommendation:** Consider a phased approach:
- Phase 1 (scaffold): `--cov-fail-under=50` to allow initial implementation
- Phase 2 (feature complete): `--cov-fail-under=80`
- Phase 3 (production): `--cov-fail-under=90`

Document the phase transition criteria. Alternatively, keep 90% but ensure every new module has a companion test file committed in the same PR.

---

### QA-9 [MEDIUM] `make test` duplicates coverage flags already in pyproject.toml

**Affected file:** `Makefile` (line 52)

**Evidence:** The Makefile `test` target runs `uv run pytest --cov=src --cov-report=term-missing --cov-fail-under=90`, but `pyproject.toml` already sets `addopts = "--cov=src --cov-report=term-missing --cov-fail-under=90"`. When running via the Makefile, these flags are effectively applied twice. While pytest-cov handles this gracefully (duplicate flags are merged), it creates a maintenance burden: changing the threshold requires updating both files, and they can drift.

**Impact:** Low immediate risk, but a maintenance hazard. A developer updating the threshold in `pyproject.toml` may not update the Makefile (or vice versa), leading to confusion when `uv run pytest` and `make test` behave differently.

**Recommendation:** Remove the explicit flags from the Makefile `test` target and rely on `pyproject.toml` as the single source of truth. Change line 52 to: `cd $$dir && uv run pytest && cd ../..`

---

### QA-10 [MEDIUM] network-connector is missing `respx` dev dependency

**Affected file:** `connectors/network-connector/pyproject.toml` (lines 19-24)

**Evidence:** The argocd-connector and prometheus-connector both include `respx>=0.22.0` in their dev dependencies. The network-connector does not. While the network-connector's primary upstream is the Kubernetes API (not HTTP-based in the same way), TECH-STANDARDS section 8 line 687 mandates using `respx` for mocking upstream HTTP calls. The network-connector's health check endpoint and any future HTTP-based interactions would require this library.

**Impact:** Tests that mock HTTP calls in the network-connector will fail with an import error for `respx`. Inconsistency across connectors creates confusion.

**Recommendation:** Add `respx>=0.22.0` to the network-connector's dev dependencies for consistency. If the connector genuinely never makes HTTP calls, document the intentional omission.

---

### QA-11 [LOW] No vitest coverage threshold for branches, functions, or statements

**Affected file:** `frontend/vitest.config.ts` (lines 20-22)

**Evidence:** The coverage thresholds only specify `lines: 80`. TECH-STANDARDS section 8 says "Target 80%+ for component logic" without specifying which metric. Industry practice and comprehensive coverage gating typically include branch coverage (to catch untested conditional paths) and function coverage.

**Impact:** A codebase can achieve 80% line coverage while leaving significant conditional branches untested, particularly in error handling and edge-case paths.

**Recommendation:** Add `branches: 70` and `functions: 80` thresholds alongside `lines: 80`. These can be tuned upward as the codebase matures.

---

### QA-12 [LOW] No example or template test file to establish conventions

**Affected:** All connectors and frontend

**Evidence:** The standards document (section 8 line 685) defines naming conventions: "Test files mirror source files (`src/routes/apps.py` -> `tests/unit/test_routes_apps.py`). Test functions use `test_<behaviour_under_test>` naming." However, no example test file exists to demonstrate these conventions in practice. The conftest.py fixture exists but is never consumed.

**Impact:** Without a working example, the first test file written in each connector will set the de facto convention, which may or may not match the standards.

**Recommendation:** Add `tests/unit/test_health.py` per connector with a minimal test exercising the `/healthz` endpoint via the `client` fixture. This serves triple duty: validates the scaffold works, demonstrates naming conventions, and provides nonzero coverage (resolving QA-1).

---

### QA-13 [LOW] `tests/generated/` directory present but no generation mechanism exists

**Affected:** `connectors/*/tests/generated/__init__.py`

**Evidence:** TECH-STANDARDS section 8 line 689 states: "Spec-conformance tests under `tests/generated/` are auto-generated from OpenAPI specs. Do not hand-edit." The directory exists with an `__init__.py`, but the `scripts/generate-stubs.py` referenced in the Makefile does not exist (the Makefile target `generate-stubs` calls it). No OpenAPI specs exist yet to generate from.

**Impact:** The directory creates an expectation that generated tests will appear, but the generation pipeline does not exist. This is expected for a scaffold but should be documented.

**Recommendation:** Add a `README` or comment in the `__init__.py` explaining that this directory will be populated by the spec-conformance test generator once OpenAPI specs are committed. Reference the Makefile `generate-stubs` target.

---

### QA-14 [LOW] Frontend coverage excludes `src/mocks/**` but no test lifecycle cleanup is configured

**Affected file:** `frontend/vitest.config.ts` (line 19)

**Evidence:** `src/mocks/**` is excluded from coverage (correct), but no global test setup ensures MSW server lifecycle management (start before all, reset after each, close after all). Without this, mock handlers from one test can leak into another, causing flaky tests.

**Impact:** Test isolation issues will emerge once MSW handlers are defined and multiple test files run in sequence.

**Recommendation:** This is resolved by implementing the setup file recommended in QA-5 and QA-6. Ensure the setup file includes:
```typescript
import { server } from './mocks/server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Risk Matrix

| ID    | Severity | Category              | Blocks Development? |
| ----- | -------- | --------------------- | ------------------- |
| QA-1  | BLOCKER  | Test execution        | Yes                 |
| QA-2  | HIGH     | Import resolution     | Likely              |
| QA-3  | HIGH     | Standards compliance  | No (deferred risk)  |
| QA-4  | HIGH     | Missing fixture       | No (deferred risk)  |
| QA-5  | HIGH     | Frontend test setup   | Yes (first test)    |
| QA-6  | MEDIUM   | Frontend mock pattern | No (deferred risk)  |
| QA-7  | MEDIUM   | Security testing      | No (deferred risk)  |
| QA-8  | MEDIUM   | CI gating             | Partially           |
| QA-9  | MEDIUM   | Maintainability       | No                  |
| QA-10 | MEDIUM   | Dependency parity     | No (deferred risk)  |
| QA-11 | LOW      | Coverage granularity  | No                  |
| QA-12 | LOW      | Conventions           | No                  |
| QA-13 | LOW      | Documentation         | No                  |
| QA-14 | LOW      | Test isolation        | No (deferred risk)  |

---

## Recommended Immediate Actions (Pre-First-Sprint)

1. **Add smoke tests** (`tests/unit/test_health.py`) per connector to unblock `make test` (resolves QA-1, QA-12)
2. **Add `pythonpath = ["."]`** to each connector's `[tool.pytest.ini_options]` (resolves QA-2)
3. **Create `frontend/src/setup-tests.ts`** with jest-dom import and MSW lifecycle (resolves QA-5, QA-14)
4. **Remove duplicate coverage flags** from Makefile test target (resolves QA-9)
5. **Add `respx` to network-connector** dev dependencies (resolves QA-10)

These five actions make the scaffold executable and prevent the first developer from hitting immediate failures.

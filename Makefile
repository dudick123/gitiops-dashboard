# GitOps Dashboard — Development Commands
# TECH-STANDARDS §9

CONNECTORS := connectors/argocd-connector connectors/prometheus-connector connectors/network-connector
GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")

.PHONY: install lint lint-frontend format format-frontend typecheck typecheck-frontend \
        test test-frontend test-unit test-int check check-all security-audit build \
        generate-stubs generate-ts-clients generate-sbom render-manifests validate-manifests \
        lighthouse docker-up docker-down

# --- Setup ---

install:
	@echo "Installing connector dependencies..."
	@for dir in $(CONNECTORS); do \
		echo "  $$dir"; \
		(cd $$dir && uv sync); \
	done
	@echo "Installing frontend dependencies..."
	(cd frontend && npm install)

# --- Python Linting & Formatting ---

lint:
	uv run ruff check connectors/

format:
	uv run ruff format connectors/

typecheck:
	@for dir in $(CONNECTORS); do \
		echo "Typechecking $$dir..."; \
		(cd $$dir && uv run mypy --strict src/); \
	done

# --- Frontend Linting & Formatting ---

lint-frontend:
	(cd frontend && npm run lint)

format-frontend:
	(cd frontend && npm run format)

typecheck-frontend:
	(cd frontend && npm run typecheck)

# --- Testing ---

test:
	@for dir in $(CONNECTORS); do \
		echo "Testing $$dir..."; \
		(cd $$dir && uv run pytest); \
	done

test-unit:
	@for dir in $(CONNECTORS); do \
		(cd $$dir && uv run pytest tests/unit/); \
	done

test-int:
	@for dir in $(CONNECTORS); do \
		(cd $$dir && uv run pytest tests/integration/); \
	done

test-frontend:
	(cd frontend && npm run test)

# --- Combined Gates ---

check: lint typecheck test

check-all: check lint-frontend typecheck-frontend test-frontend

# --- Security ---

security-audit:
	@echo "Running Python dependency audit..."
	@for dir in $(CONNECTORS); do \
		(cd $$dir && uv run pip-audit); \
	done
	@echo "Running frontend dependency audit..."
	(cd frontend && npm audit --audit-level=high) || true
	@echo "Running secret detection..."
	detect-secrets scan --baseline .secrets.baseline

# --- Build ---

build:
	@echo "Syncing uv.lock to connector directories..."
	@for dir in $(CONNECTORS); do \
		cp uv.lock $$dir/uv.lock; \
	done
	@for dir in $(CONNECTORS); do \
		name=$$(basename $$dir); \
		echo "Building $$name (sha-$(GIT_SHA))..."; \
		docker build -t gitops-dashboard/$$name:sha-$(GIT_SHA) -t gitops-dashboard/$$name:latest $$dir; \
	done
	docker build -t gitops-dashboard/frontend:sha-$(GIT_SHA) -t gitops-dashboard/frontend:latest frontend/

# --- Code Generation ---

generate-stubs:
	python scripts/generate-stubs.py

generate-ts-clients:
	bash scripts/generate-ts-clients.sh

# --- SBOM & Manifest Validation ---

generate-sbom:
	@echo "SBOM generation — requires syft or trivy. See TECH-STANDARDS §12.9"

render-manifests:
	@echo "Manifest rendering — requires deploy repo. See TECH-STANDARDS §14.4"

validate-manifests:
	@echo "Manifest validation — requires kubeconform + kube-linter. See TECH-STANDARDS §14.4"

# --- Performance ---

lighthouse:
	@echo "Lighthouse CI — requires production frontend build. See TECH-STANDARDS §2"

# --- Docker Compose ---

docker-up:
	@echo "Syncing uv.lock to connector directories..."
	@for dir in $(CONNECTORS); do \
		cp uv.lock $$dir/uv.lock; \
	done
	docker compose up --build -d

docker-down:
	docker compose down

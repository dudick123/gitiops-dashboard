"""Generate FastAPI stubs from OpenAPI specs.

This is a placeholder script. It will be implemented when the first connector
proposal (PROP-01: argocd-connector) is approved and code generation begins.

Usage:
    python scripts/generate-stubs.py --spec specs/argocd-connector/openapi.yaml \
                                      --output connectors/argocd-connector/src/

See PRD §6.2 (Proposal Lifecycle) and TECH-STANDARDS §9 (Makefile Commands).
"""


def main() -> None:
    """Generate FastAPI route stubs and Pydantic models from an OpenAPI 3.1 spec."""
    msg = (
        "Stub generation not yet implemented. "
        "This script will be completed as part of PROP-01 (argocd-connector)."
    )
    raise NotImplementedError(msg)


if __name__ == "__main__":
    main()

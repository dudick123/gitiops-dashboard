"""Structured logging configuration.

TECH-STANDARDS §4 — structlog with JSON rendering in production.
TECH-STANDARDS §12.4 — Log sanitisation with scrub_secrets processor.
"""

import os
import re

import structlog

SENSITIVE_PATTERNS = re.compile(
    r"(token|password|secret|credential|authorization|api[_-]?key)"
    r"\s*[:=]\s*\S+",
    re.IGNORECASE,
)


def scrub_secrets(
    logger: structlog.types.WrappedLogger,
    method_name: str,
    event_dict: structlog.types.EventDict,
) -> structlog.types.EventDict:
    """Redact sensitive values from log entries."""
    for key, value in event_dict.items():
        if isinstance(value, str) and SENSITIVE_PATTERNS.search(value):
            event_dict[key] = SENSITIVE_PATTERNS.sub(
                r"\1=***REDACTED***", value
            )
    return event_dict


def configure_logging(*, connector: str) -> None:
    """Configure structlog for a connector.

    Args:
        connector: The connector name (e.g., "prometheus-connector").
    """
    log_format = os.environ.get("LOG_FORMAT", "json")

    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.TimeStamper(fmt="iso"),
        scrub_secrets,
    ]

    if log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

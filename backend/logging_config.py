"""Central structured logging configuration using structlog + stdlib."""

import atexit
import logging
import logging.config
import sys

import structlog

from backend.config import settings


class _FlushingStreamHandler(logging.StreamHandler):
    """StreamHandler that flushes after every emit.

    Prevents log loss during uvicorn ``--reload`` process restarts by
    ensuring each log record is written to stderr immediately.
    """

    def emit(self, record: logging.LogRecord) -> None:
        super().emit(record)
        self.flush()


def setup_logging() -> None:
    """Configure structlog on top of stdlib logging.

    All existing ``logging.getLogger(__name__)`` calls automatically
    gain structured output with request context.  Zero changes needed
    in any application module.
    """
    log_level = settings.log_level.upper()

    # Determine renderer: JSON for production, colored console for dev
    fmt = settings.log_format.lower()
    if fmt == "auto":
        use_json = not sys.stderr.isatty()
    else:
        use_json = fmt == "json"

    # Shared processors applied to every log entry (structlog + stdlib foreign)
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.ExtraAdder(),
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    # Final renderer
    if use_json:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    # Configure structlog itself (for code that uses structlog.get_logger())
    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure stdlib logging via dictConfig so every existing
    # ``logging.getLogger(__name__)`` call routes through structlog processors.
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "structlog": {
                    "()": structlog.stdlib.ProcessorFormatter,
                    "processors": [
                        structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                        renderer,
                    ],
                    "foreign_pre_chain": shared_processors,
                },
            },
            "handlers": {
                "default": {
                    "()": _FlushingStreamHandler,
                    "stream": sys.stderr,
                    "formatter": "structlog",
                },
            },
            "loggers": {
                # Root logger
                "": {
                    "handlers": ["default"],
                    "level": log_level,
                    "propagate": True,
                },
                # Uvicorn loggers — keep aligned with root level
                "uvicorn": {"level": log_level},
                "uvicorn.error": {"level": log_level},
                "uvicorn.access": {"level": log_level},
                # Noisy third-party loggers — suppress below WARNING
                "httpx": {"level": "WARNING"},
                "httpcore": {"level": "WARNING"},
                "supabase": {"level": "WARNING"},
                "hpack": {"level": "WARNING"},
            },
        }
    )

    # Flush all handlers on process exit (protects against --reload log loss)
    atexit.register(logging.shutdown)

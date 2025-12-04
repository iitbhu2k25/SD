import logging
from logging.config import dictConfig
from pathlib import Path

log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

log_config = {
    "version": 1,
    "disable_existing_loggers": False,  # Keep Uvicorn loggers active
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "file": {
            "class": "logging.FileHandler",
            "level": "INFO",  # Captures INFO and above from ALL loggers
            "formatter": "default",
            "filename": "logs/applog.log",
            "mode": "a",
            "encoding": "utf-8"
        },
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "default"
        }
    },
    "root": {  # This captures EVERYTHING (Uvicorn, FastAPI, your app)
        "level": "INFO",
        "handlers": ["file", "console"]
    },
    "loggers": {
        "app_logger": {
            "level": "DEBUG",  # Your app can log more detailed
            "handlers": ["file", "console"],
            "propagate": False  # Don't double-log app_logger
        },
        "uvicorn": {  # Specifically target Uvicorn
            "level": "INFO",
            "propagate": True
        },
        "uvicorn.error": {
            "level": "INFO",
            "propagate": True
        }
    }
}

dictConfig(log_config)

# Root logger captures everything automatically
logger = logging.getLogger("app_logger")
logger.info("Application started")

from app.conf.settings import Settings
from app.conf.logging import logger
from celery import Celery


import logging

log = logging.getLogger("app_logger")
log.info("Celery starting…")


app = Celery('myapp', backend=Settings().CELERY_BROKER_URL,broker=Settings().CELERY_BROKER_URL)
app.autodiscover_tasks(
    ['app.api.service.celery.celery_task'],
)
app.conf.update(
    task_serializer='json',
    accept_content=['json'],  # Ignore other content types
    result_serializer='json',
    timezone='Asia/Kolkata',  # optional
    enable_utc=True,
    
    result_backend=Settings().CELERY_BROKER_URL,
    result_extended=True,
    task_track_started=True,
    
    # Performance settings
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=50,
    
    # Chord settings
    result_expires=3600,
    task_ignore_result=False,
)

app.autodiscover_tasks()
log.info("Celery app initialized successfully")
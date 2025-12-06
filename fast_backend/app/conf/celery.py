from app.conf.settings import Settings
from app.conf.logging import logger
from kombu import Queue
from celery import Celery


import logging

log = logging.getLogger("app_logger")
log.info("Celery starting…")


app = Celery('myapp', backend=Settings().CELERY_RESULT_BACKEND,broker=Settings().CELERY_BROKER_URL)
app.autodiscover_tasks(
    ['app.api.service.celery.celery_task'],
)
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Kolkata', 
    enable_utc=True,
    
    
    broker_connection_retry_on_startup=True,
    broker_heartbeat=30,
    broker_pool_limit=10,
    broker_transport_options={"visibility_timeout": 3600},
    task_reject_on_worker_lost=True,
    
    
    result_extended=True,
    result_expires=3600,

    task_track_started=True,
    task_send_sent_event=True,
    worker_send_task_events=True,

    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=50,

    worker_hijack_root_logger=False,

    task_soft_time_limit=120,
    task_time_limit=150,
)


app.autodiscover_tasks()
log.info("Celery app initialized successfully")
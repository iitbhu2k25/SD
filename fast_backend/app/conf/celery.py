from app.conf.settings import Settings
from celery import Celery
app = Celery('myapp', backend=Settings().CELERY_BROKER_URL,broker=Settings().CELERY_BROKER_URL)
app.autodiscover_tasks(
    ['app.api.service.celery.celery_task'],
)
app.conf.update(
    task_serializer='json',
    accept_content=['json'],  # Ignore other content types
    result_serializer='json',
    timezone='Asia/Kolkata',  # optional
    enable_utc=True
)

app.autodiscover_tasks()

print("Registered tasks:", list(app.tasks.keys()))
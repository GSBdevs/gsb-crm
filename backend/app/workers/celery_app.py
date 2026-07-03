from celery import Celery

from app.core.config import settings

celery = Celery(
    "gruposb_crm",
    broker=settings.redis_url,
    include=["app.workers.tasks"],
)
celery.conf.update(
    task_default_queue="crm",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

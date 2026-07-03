from fastapi import APIRouter

from app.api import (
    accounts,
    activities,
    auth,
    contacts,
    leads,
    notifications,
    opportunities,
    reports,
    stages,
    users,
    workflows,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(leads.router)
api_router.include_router(contacts.router)
api_router.include_router(accounts.router)
api_router.include_router(stages.router)
api_router.include_router(opportunities.router)
api_router.include_router(activities.router)
api_router.include_router(workflows.router)
api_router.include_router(notifications.router)
api_router.include_router(reports.router)

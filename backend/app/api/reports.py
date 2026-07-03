from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, get_current_user
from app.schemas.report import (
    ActivityDayPoint,
    ForecastPoint,
    StageMetric,
    SummaryOut,
    TimeSeriesPoint,
)
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_user)])


@router.get("/summary", response_model=SummaryOut)
async def summary(db: DbSession):
    return await report_service.summary(db)


@router.get("/pipeline-by-stage", response_model=list[StageMetric])
async def pipeline_by_stage(db: DbSession):
    return await report_service.pipeline_by_stage(db)


@router.get("/leads-timeline", response_model=list[TimeSeriesPoint])
async def leads_timeline(db: DbSession, months: int = Query(default=6, ge=1, le=24)):
    return await report_service.leads_timeline(db, months)


@router.get("/activities-by-day", response_model=list[ActivityDayPoint])
async def activities_by_day(db: DbSession, days: int = Query(default=14, ge=1, le=90)):
    return await report_service.activities_by_day(db, days)


@router.get("/forecast", response_model=list[ForecastPoint])
async def forecast(db: DbSession, months: int = Query(default=6, ge=1, le=12)):
    return await report_service.forecast(db, months)

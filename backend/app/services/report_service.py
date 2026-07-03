"""Agregações para relatórios.

Group-by simples fica no SQL; agrupamento por mês/dia é feito em Python para
manter portabilidade SQLite/Postgres (volumes pequenos nesta escala).
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, Contact, Lead, LeadStatus, Opportunity, PipelineStage


def _month_key(d: datetime | date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _last_months(n: int) -> list[str]:
    today = date.today()
    months: list[str] = []
    year, month = today.year, today.month
    for _ in range(n):
        months.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(months))


def _next_months(n: int) -> list[str]:
    today = date.today()
    months: list[str] = []
    year, month = today.year, today.month
    for _ in range(n):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return months


async def summary(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today = now.date()

    open_leads = await db.scalar(
        select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.NEW)
    )
    qualified = await db.scalar(
        select(func.count()).select_from(Lead).where(Lead.status == LeadStatus.QUALIFIED)
    )
    open_opps = (
        await db.execute(
            select(func.count(Opportunity.id), func.coalesce(func.sum(Opportunity.value), 0))
            .join(PipelineStage, Opportunity.stage_id == PipelineStage.id)
            .where(PipelineStage.is_won.is_(False), PipelineStage.is_lost.is_(False))
        )
    ).one()

    won_rows = (
        await db.execute(
            select(Opportunity.value, Opportunity.closed_at)
            .join(PipelineStage, Opportunity.stage_id == PipelineStage.id)
            .where(PipelineStage.is_won.is_(True), Opportunity.closed_at.is_not(None))
        )
    ).all()
    won_month = sum(
        float(v or 0)
        for v, closed in won_rows
        if closed and closed.year == today.year and closed.month == today.month
    )

    act_rows = (
        await db.execute(select(Activity.due_at).where(Activity.done_at.is_(None)))
    ).all()
    due_today = sum(1 for (due,) in act_rows if due and due.date() == today)
    overdue = sum(1 for (due,) in act_rows if due and due.date() < today)

    contacts_total = await db.scalar(select(func.count()).select_from(Contact))

    return {
        "open_leads": open_leads or 0,
        "qualified_leads": qualified or 0,
        "open_opportunities": open_opps[0] or 0,
        "open_value": float(open_opps[1] or 0),
        "won_value_month": won_month,
        "activities_due_today": due_today,
        "activities_overdue": overdue,
        "contacts_total": contacts_total or 0,
    }


async def pipeline_by_stage(db: AsyncSession) -> list[dict]:
    rows = (
        await db.execute(
            select(
                PipelineStage.name,
                PipelineStage.color,
                func.count(Opportunity.id),
                func.coalesce(func.sum(Opportunity.value), 0),
            )
            .outerjoin(Opportunity, Opportunity.stage_id == PipelineStage.id)
            .group_by(PipelineStage.id)
            .order_by(PipelineStage.position)
        )
    ).all()
    return [
        {"stage": name, "color": color, "count": count, "value": float(value or 0)}
        for name, color, count, value in rows
    ]


async def leads_timeline(db: AsyncSession, months: int = 6) -> list[dict]:
    keys = _last_months(months)
    created: dict[str, int] = defaultdict(int)
    converted: dict[str, int] = defaultdict(int)
    rows = (await db.execute(select(Lead.created_at, Lead.converted_at))).all()
    for created_at, converted_at in rows:
        if created_at:
            created[_month_key(created_at)] += 1
        if converted_at:
            converted[_month_key(converted_at)] += 1
    return [
        {"period": k, "created": created.get(k, 0), "converted": converted.get(k, 0)}
        for k in keys
    ]


async def activities_by_day(db: AsyncSession, days: int = 14) -> list[dict]:
    start = date.today() - timedelta(days=days - 1)
    buckets: dict[str, dict[str, int]] = {
        (start + timedelta(days=i)).isoformat(): {"call": 0, "email": 0, "meeting": 0, "task": 0}
        for i in range(days)
    }
    rows = (await db.execute(select(Activity.created_at, Activity.type))).all()
    for created_at, activity_type in rows:
        if not created_at:
            continue
        key = created_at.date().isoformat()
        if key in buckets:
            buckets[key][str(activity_type)] += 1
    return [{"day": day, **counts} for day, counts in buckets.items()]


async def forecast(db: AsyncSession, months: int = 6) -> list[dict]:
    keys = _next_months(months)
    weighted: dict[str, float] = defaultdict(float)
    total: dict[str, float] = defaultdict(float)
    rows = (
        await db.execute(
            select(Opportunity.value, Opportunity.probability, Opportunity.expected_close)
            .join(PipelineStage, Opportunity.stage_id == PipelineStage.id)
            .where(
                PipelineStage.is_won.is_(False),
                PipelineStage.is_lost.is_(False),
                Opportunity.expected_close.is_not(None),
            )
        )
    ).all()
    for value, probability, expected in rows:
        key = _month_key(expected)
        if key in keys:
            total[key] += float(value or 0)
            weighted[key] += float(value or 0) * (probability or 0) / 100
    return [
        {"period": k, "weighted": round(weighted.get(k, 0), 2), "total": round(total.get(k, 0), 2)}
        for k in keys
    ]

from pydantic import BaseModel


class SummaryOut(BaseModel):
    open_leads: int
    qualified_leads: int
    open_opportunities: int
    open_value: float
    won_value_month: float
    activities_due_today: int
    activities_overdue: int
    contacts_total: int


class StageMetric(BaseModel):
    stage: str
    color: str
    count: int
    value: float


class TimeSeriesPoint(BaseModel):
    period: str
    created: int = 0
    converted: int = 0


class ActivityDayPoint(BaseModel):
    day: str
    call: int = 0
    email: int = 0
    meeting: int = 0
    task: int = 0


class ForecastPoint(BaseModel):
    period: str
    weighted: float
    total: float

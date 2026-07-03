import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

ConditionOp = Literal[
    "eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", "is_empty", "not_empty"
]


class Condition(BaseModel):
    field: str
    op: ConditionOp = "eq"
    value: Any = None


class ActionSpec(BaseModel):
    type: Literal["create_activity", "notify", "send_email", "webhook"]
    params: dict[str, Any] = {}


class WorkflowRuleCreate(BaseModel):
    name: str
    trigger_event: str
    conditions: list[Condition] = []
    actions: list[ActionSpec] = []
    is_active: bool = True


class WorkflowRuleUpdate(BaseModel):
    name: str | None = None
    trigger_event: str | None = None
    conditions: list[Condition] | None = None
    actions: list[ActionSpec] | None = None
    is_active: bool | None = None


class WorkflowRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    trigger_event: str
    conditions: list[dict[str, Any]]
    actions: list[dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WorkflowExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_id: uuid.UUID
    event: str
    entity_type: str
    entity_id: uuid.UUID | None
    status: str
    detail: str
    executed_at: datetime

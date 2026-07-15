from datetime import datetime, timezone
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel

T = TypeVar("T")


def _assume_utc(value: datetime) -> datetime:
    # O banco sempre grava UTC, mas o driver SQLite devolve datetimes naive;
    # sem tzinfo o JSON sai sem offset e o navegador interpreta como hora local.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


UTCDateTime = Annotated[datetime, AfterValidator(_assume_utc)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int

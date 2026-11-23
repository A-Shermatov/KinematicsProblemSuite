from __future__ import annotations

import json
from typing import Any

import asyncpg
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.deps import Conn, not_found
from app.modules.geo import queries as q
from app.modules.geo.countries import COUNTRY_CODES

router = APIRouter(prefix="/geo", tags=["geo"])


def check_country(code: str) -> str:
    code = code.strip().upper()
    if code not in COUNTRY_CODES:
        raise ValueError("Неизвестная страна")
    return code


@router.get("/regions")
async def regions(conn: Conn, country: str = Query("TJ", min_length=2, max_length=2)) -> list[dict[str, Any]]:
    """Области страны с городами — для выпадающих списков в регистрации и профиле."""
    try:
        code = check_country(country)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc
    return [{**dict(r), "cities": json.loads(r["cities"])} for r in await conn.fetch(q.REGIONS, code)]


# ---------- Администрирование справочника (подключается в admin router) ----------


class RegionIn(BaseModel):
    country_code: str = "TJ"
    name: str = Field(min_length=2, max_length=80)
    position: int = Field(default=0, ge=0, le=1000)

    @field_validator("country_code")
    @classmethod
    def country(cls, value: str) -> str:
        return check_country(value)

    @field_validator("name")
    @classmethod
    def strip(cls, value: str) -> str:
        return " ".join(value.split())


class CityIn(BaseModel):
    region_id: int
    name: str = Field(min_length=2, max_length=80)

    @field_validator("name")
    @classmethod
    def strip(cls, value: str) -> str:
        return " ".join(value.split())


admin_router = APIRouter(prefix="/geo", tags=["admin"])


@admin_router.post("/regions", status_code=status.HTTP_201_CREATED)
async def create_region(data: RegionIn, conn: Conn) -> dict[str, int]:
    try:
        return {"id": await conn.fetchval(q.INSERT_REGION, data.country_code, data.name, data.position)}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(409, detail="Такая область уже есть") from exc


@admin_router.put("/regions/{region_id}")
async def update_region(region_id: int, data: RegionIn, conn: Conn) -> dict[str, int]:
    try:
        if await conn.fetchval(q.UPDATE_REGION, region_id, data.name, data.position) is None:
            raise not_found("Область")
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(409, detail="Такая область уже есть") from exc
    return {"id": region_id}


@admin_router.delete("/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_region(region_id: int, conn: Conn) -> None:
    """Города области удаляются вместе с ней; у пользователей область сбрасывается, город остаётся текстом."""
    if await conn.fetchval(q.DELETE_REGION, region_id) is None:
        raise not_found("Область")


@admin_router.post("/cities", status_code=status.HTTP_201_CREATED)
async def create_city(data: CityIn, conn: Conn) -> dict[str, int]:
    if await conn.fetchrow(q.GET_REGION, data.region_id) is None:
        raise not_found("Область")
    try:
        return {"id": await conn.fetchval(q.INSERT_CITY, data.region_id, data.name)}
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(409, detail="Такой город уже есть") from exc


@admin_router.delete("/cities/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_city(city_id: int, conn: Conn) -> None:
    if await conn.fetchval(q.DELETE_CITY, city_id) is None:
        raise not_found("Город")

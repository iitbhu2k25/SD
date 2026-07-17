"""dashboard tables added

Revision ID: a1b2c3d4e5f6
Revises: 64a64c5b42e7
Create Date: 2026-07-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "64a64c5b42e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dashboard_drainwaterquality",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("location", sa.String(length=150), nullable=False),
        sa.Column("ph", sa.Float(), nullable=False),
        sa.Column("temp", sa.Float(), nullable=False),
        sa.Column("ec_us_cm", sa.Float(), nullable=False),
        sa.Column("tds_ppm", sa.Float(), nullable=False),
        sa.Column("do_mg_l", sa.Float(), nullable=False),
        sa.Column("turbidity", sa.Float(), nullable=False),
        sa.Column("tss_mg_l", sa.Float(), nullable=False),
        sa.Column("cod", sa.Float(), nullable=False),
        sa.Column("bod_mg_l", sa.Float(), nullable=False),
        sa.Column("ts_mg_l", sa.Float(), nullable=False),
        sa.Column("chloride", sa.Float(), nullable=False),
        sa.Column("nitrate", sa.Float(), nullable=True),
        sa.Column("faecal_col", sa.String(length=100), nullable=True),
        sa.Column("total_col", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("stream", sa.String(length=255), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("sampling_time", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_drainwaterquality_id"),
        "dashboard_drainwaterquality",
        ["id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_dashboard_drainwaterquality_sampling_time"),
        "dashboard_drainwaterquality",
        ["sampling_time"],
        unique=False,
    )

    op.create_table(
        "dashboard_mapstory",
        sa.Column("station_id", sa.String(length=50), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("image_path", sa.String(length=500), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("other", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("station_id"),
        sa.UniqueConstraint("station_id"),
    )
    op.create_index(
        op.f("ix_dashboard_mapstory_location"),
        "dashboard_mapstory",
        ["location"],
        unique=False,
    )

    op.create_table(
        "dashboard_depth",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("season", sa.String(length=30), nullable=False),
        sa.Column("depth_m", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_depth_id"), "dashboard_depth", ["id"], unique=True
    )

    op.create_table(
        "dashboard_rainfall",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=False),
        sa.Column("annual_rainfall", sa.Numeric(precision=15, scale=10), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_rainfall_id"), "dashboard_rainfall", ["id"], unique=True
    )
    op.create_index(
        op.f("ix_dashboard_rainfall_district"),
        "dashboard_rainfall",
        ["district"],
        unique=False,
    )
    op.create_index(
        op.f("ix_dashboard_rainfall_year"), "dashboard_rainfall", ["year"], unique=False
    )

    op.create_table(
        "dashboard_distribution",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("year", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("percentage", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_distribution_id"),
        "dashboard_distribution",
        ["id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_dashboard_distribution_year"),
        "dashboard_distribution",
        ["year"],
        unique=False,
    )
    op.create_index(
        op.f("ix_dashboard_distribution_category"),
        "dashboard_distribution",
        ["category"],
        unique=False,
    )

    op.create_table(
        "dashboard_industrial_pollution",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("pollution_index", sa.String(length=50), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dashboard_industrial_pollution_id"),
        "dashboard_industrial_pollution",
        ["id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_dashboard_industrial_pollution_district"),
        "dashboard_industrial_pollution",
        ["district"],
        unique=False,
    )
    op.create_index(
        op.f("ix_dashboard_industrial_pollution_category"),
        "dashboard_industrial_pollution",
        ["category"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("dashboard_industrial_pollution")
    op.drop_table("dashboard_distribution")
    op.drop_table("dashboard_rainfall")
    op.drop_table("dashboard_depth")
    op.drop_table("dashboard_mapstory")
    op.drop_table("dashboard_drainwaterquality")

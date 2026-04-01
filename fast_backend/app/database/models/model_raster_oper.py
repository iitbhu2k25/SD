from sqlalchemy.orm import Mapped,mapped_column
from sqlalchemy import JSON, Boolean, Float, Integer, String
from app.database.models.base import Base


from sqlalchemy import String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase
from sqlalchemy.dialects.postgresql import JSON


class UserStorage(Base):
    __tablename__ = "user_storage"

    file_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    layer_name: Mapped[str] = mapped_column(String, nullable=False)

    # Self reference
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_storage.id"),
        nullable=True
    )

    storage_type: Mapped[str] = mapped_column(String, nullable=False)  # original/derived

    # Relationships
    parent: Mapped["UserStorage"] = relationship(
        "UserStorage",
        remote_side=lambda: [UserStorage.id],
        backref="children"
    )

    raster_metadata_record: Mapped["RasterMetadata"] = relationship(
        "RasterMetadata",
        back_populates="storage",
        uselist=False
    )
    vector_metadata_record:Mapped["VectorMetadata"]= relationship(
        "VectorMetadata",
        back_populates="storage",
        uselist=False

    )
    
class RasterMetadata(Base):
    __tablename__ = "raster_metadata"

    file_id: Mapped[str] = mapped_column(
        ForeignKey("user_storage.file_id"),
        unique=True,
        nullable=False
    )
    driver: Mapped[str] = mapped_column(String, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    band_count: Mapped[int] = mapped_column(Integer, nullable=False)

    dtypes: Mapped[str] = mapped_column(String, nullable=False)
    nodata: Mapped[float | None] = mapped_column(Float, nullable=True)

    crs: Mapped[str] = mapped_column(String, nullable=False)
    crs_unit: Mapped[str] = mapped_column(String, nullable=False)

    compression: Mapped[str | None] = mapped_column(String, nullable=True)
    is_tiled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    block_shapes: Mapped[dict | None] = mapped_column(JSON)
    is_cog_like: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Structured metadata stored as JSON
    file_size: Mapped[dict | None] = mapped_column(JSON)
    bounds: Mapped[dict | None] = mapped_column(JSON)
    bounds_wgs84: Mapped[dict | None] = mapped_column(JSON)
    resolution: Mapped[dict | None] = mapped_column(JSON)
    bands: Mapped[list | None] = mapped_column(JSON)
    tags: Mapped[dict | None] = mapped_column(JSON)

    storage: Mapped["UserStorage"] = relationship(
        "UserStorage",
        back_populates="raster_metadata_record"
    )

class VectorMetadata(Base):
    __tablename__ = "vector_metadata"

    file_id:Mapped[str]=mapped_column(
        ForeignKey("user_storage.file_id"),
        unique=True,
        nullable=False)
    driver: Mapped[str] = mapped_column(String, nullable=False)
    feature_count: Mapped[int] = mapped_column(Integer, nullable=False)
    geometry_type: Mapped[str] = mapped_column(String, nullable=False)
    crs: Mapped[str] = mapped_column(String, nullable=False)         # WKT / PROJ string
    crs_unit: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[dict | None] = mapped_column(JSON)
    attribute_schema: Mapped[list | None] = mapped_column(JSON)
    storage: Mapped["UserStorage"] = relationship(
        "UserStorage",
        back_populates="vector_metadata_record"
    )

class CeleryTask(Base):
    __tablename__ = "celery_task"
    file_id: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[str] = mapped_column(String, nullable=False)
    task_name: Mapped[str] = mapped_column(String, nullable=False)
    task_status: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=True)
    layer_name: Mapped[str] = mapped_column(String, nullable=True)
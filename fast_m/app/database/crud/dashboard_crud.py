from sqlalchemy.orm import Session
from app.database.models.model_dashboard import (
    DrainWaterQuality,
    StoryMapStation,
    DashboardDepth,
    DashboardRainfall,
    DashboardDistribution,
    DashboardIndustrialPollution,
)


class DashboardCrud:
    def __init__(self, db: Session):
        self.db = db

    def get_drain_water_quality(self):
        return self.db.query(DrainWaterQuality).order_by(DrainWaterQuality.sampling_time.desc()).all()

    def get_depth(self):
        return (
            self.db.query(DashboardDepth)
            .order_by(DashboardDepth.year, DashboardDepth.district, DashboardDepth.season)
            .all()
        )

    def get_rainfall(self):
        return (
            self.db.query(DashboardRainfall)
            .order_by(DashboardRainfall.year, DashboardRainfall.district)
            .all()
        )

    def get_distribution(self):
        return (
            self.db.query(DashboardDistribution)
            .order_by(DashboardDistribution.year, DashboardDistribution.category)
            .all()
        )

    def get_industrial_pollution(self):
        return (
            self.db.query(DashboardIndustrialPollution)
            .order_by(
                DashboardIndustrialPollution.district,
                DashboardIndustrialPollution.category,
                DashboardIndustrialPollution.id,
            )
            .all()
        )

    def get_story_map_stations(self):
        return self.db.query(StoryMapStation).order_by(StoryMapStation.location).all()

    def get_story_map_station(self, station_id: str):
        return self.db.query(StoryMapStation).filter(StoryMapStation.station_id == station_id).first()

    def count_story_map_stations(self) -> int:
        return self.db.query(StoryMapStation).count()

from sqlalchemy.orm import Session
from datetime import datetime
from app.models.crop import Crop

class CropService:

    valid_seasons = ["Kharif", "Rabi", "Zaid"]

    @staticmethod
    def validate_season(season: str):
        """Validate season name."""
        if season not in CropService.valid_seasons:
            return False, f"Season must be one of: {', '.join(CropService.valid_seasons)}"
        return True, None

    @staticmethod
    def get_crops_by_season(db: Session, season: str):
        """Fetch crop list for a given season."""

        # Query database
        crops_query = db.query(Crop).filter(Crop.season.ilike(season))

        if crops_query.count() == 0:
            return {
                "success": True,
                "message": f"No crops found for season: {season}",
                "data": {
                    "season": season,
                    "crops": [],
                    "total_crops": 0,
                    "queried_at": datetime.now().isoformat()
                }
            }

        # Extract unique crop names
        crop_names = [c.crop for c in crops_query.distinct(Crop.crop).all()]

        return {
            "success": True,
            "message": f"Crops retrieved successfully for season: {season}",
            "data": {
                "season": season,
                "crops": crop_names,
                "total_crops": len(crop_names),
                "queried_at": datetime.now().isoformat()
            }
        }

from app.database.models.model_stp import(
    State,
    District,
    SubDistrict,
    STP_villages,
    STP_raster,
    STP_suitability_raster,
    STP_Priority_Visual_raster,
    STP_River,
    STP_Drain,
    STP_Stretches,
    STP_Catchment,
    Towns,
    STP_suitability_visual_raster,
    STP_Drain_suitability,
    Stp_suitability_Area
)
from app.database.models.model_gwz import(
    Groundwater_Zone_raster,
    Groundwater_Zone_Visual_raster,
    Groundwater_Identification,
    Groundwater_Identification_visual_raster,
    MAR_suitability_raster,
    MAR_suitability_visual_raster,
)
from app.database.models.auth_model import User,Report,UserDetails
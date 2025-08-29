from app.database.models.model_stp import(
    State,
    District,
    SubDistrict,
    STP_villages,
    STP_raster,
    STP_sutability_raster,
    STP_Priority_Visual_raster,
    STP_River,
    STP_Drain,
    STP_Stretches,
    STP_Catchment,
    Towns,
    STP_sutability_visual_raster,
    STP_Drain_sutability,
    Stp_sutability_Area
)
from app.database.models.model_gwz import(
    Groundwater_Zone_raster,
    Groundwater_Zone_Visual_raster,
    Groundwater_Identification,
    Groundwater_Identification_visual_raster,
    MAR_sutability_raster,
    MAR_sutability_visual_raster,
)
from app.database.models.auth_model import User,Report,UserDetails
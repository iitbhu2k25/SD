from app.api.service.celery.pdf_generations.stp_priority_admin_document import document_gen
from app.api.service.celery.pdf_generations.stp_priority_drain_document import document_gen1
from app.api.service.celery.pdf_generations.stp_suitability_admin_report import document_gen2
from app.api.service.celery.pdf_generations.stp_suitability_drain_report import document_gen3
from app.api.service.celery.pdf_generations.gwz_admin_document  import document_gen4
from app.api.service.celery.pdf_generations.gwz_drain_document  import document_gen5
from app.api.service.celery.raster_operations.raster_visual_celery import raster_visual
from app.api.service.celery.wqi.water_quality import (
    start_Concentration_Index,
    start_Interpolation,
    celery_concentration_Index,
    celery_start_Interpolation,
    start_rank_raster,
    celery_rank_raster,
    start_weight_raster,
)
from app.api.service.celery.raster_operations.raster_heavy_task import (
    celery_reprojection,    
)
from app.api.service.celery.stp_area.stp_area import (
    find_suitable_area,
)
from app.api.service.celery.stp_area.manual_stp_area import (
    manual_find_suitable_area,
)
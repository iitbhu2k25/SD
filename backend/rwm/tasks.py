from celery import shared_task, group, chord
import logging
import json
import tempfile
import os
import time
import geopandas as gpd

from .views import BACKEND_PARAMETER_DISPLAY_NAMES

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.core.cache import cache
from celery.exceptions import SoftTimeLimitExceeded
from celery.result import GroupResult

logger = logging.getLogger(__name__)


from .views import (
    perform_interpolation,
    generate_map_from_raster,
)

def send_task_update(job_id, data):
    """
    Send WebSocket update with error handling
    Raises exception if WebSocket layer is unavailable
    """
    channel_layer = get_channel_layer()
    
    if not channel_layer:
        # ❌ No channel layer configured
        error_msg = "WebSocket layer not configured - cannot send updates"
        # logger.error(error_msg)
        raise RuntimeError(error_msg)
    
    group_name = f"task_{job_id}"

    # logger.info("🔵 DEBUG: Preparing WebSocket message")
    # logger.info(f"     job_id: {job_id}")
    # logger.info(f"     group: {group_name}")
    # logger.info(f"     data: {data}")
    
    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'task_progress',
                'data': data
            }
        )
        # logger.info(f"✅ Sent WebSocket update for {job_id}: {data.get('status')}")
    except Exception as e:
        # ❌ WebSocket send failed - stop the task
        error_msg = f"WebSocket send failed: {e}"
        # logger.error(error_msg)
        raise RuntimeError(error_msg)




@shared_task(bind=True, max_retries=3,time_limit=120, soft_time_limit=100)
def interpolate_single_parameter(self, 
                                attribute, 
                                river_data, 
                                river_buffer_data, 
                                subdist_data,
                                points_data, 
                                season, 
                                data_type,
                                identifier_codes,
                                job_id):
    """
    Celery task to interpolate a SINGLE parameter with WebSocket updates
    Runs in parallel with other parameters
    
    Args:
        attribute: Parameter name (e.g., 'pH', 'Temperature', 'DO_mg_L_')
        river_data: River GeoJSON
        river_buffer_data: Buffer GeoJSON
        subdist_data: Subdistrict/basin boundary GeoJSON
        points_data: Water quality points GeoJSON
        season: Season (premonsoon, monsoon, postmonsoon)
        data_type: 'subdistbased' or 'stretchbased'
        identifier_codes: Subdistrict codes or stretch IDs
    
    Returns:
        Dictionary with interpolation result and map
    """
    display_name = BACKEND_PARAMETER_DISPLAY_NAMES.get(attribute, attribute)
    task_id = self.request.id
    # logger.info(f"WS_DEBUG → sending update using JOB_ID = {job_id}")
    
    try:
        # 🔹 1) Early abort if user has left (BEFORE heavy work)
        maybe_abort = abort_if_user_left(job_id, display_name, task_id)
        if maybe_abort:
            return maybe_abort
            
            
        # logger.info(f"🔄 [{task_id}] Starting interpolation for: {display_name}")
        
        # ==================== WEBSOCKET UPDATE: STARTED ====================
        send_task_update(job_id, {
            'status': 'processing',
            'attribute': display_name,
            'message': f'Starting interpolation for {display_name}...',
            'progress': 10,
            'stage': 'interpolation_start',
            'task_id': str(task_id)
        })
        
        # Get unique task ID (short version for layer names)
        task_id_short = task_id[:8]
        
        # 🔹 2) Abort again before interpolation (user may leave mid-run)
        maybe_abort = abort_if_user_left(job_id, display_name, task_id)
        if maybe_abort:
            return maybe_abort
        
        # ==================== STEP 1: PERFORM INTERPOLATION ====================
        result = perform_interpolation(
            river_data=river_data,
            river_buffer_data=river_buffer_data,
            points_data=points_data,
            attribute=attribute,
            season=season,
            data_type=data_type,
            resolution=30,
            power=2,
            unique_id=task_id_short
        )
        
        if result['status'] != 'success':
            # logger.error(f"❌ Interpolation failed for {display_name}: {result.get('message')}")
            
            # ==================== WEBSOCKET UPDATE: ERROR ====================
            send_task_update(job_id, {
                'status': 'error',
                'attribute': display_name,
                'message': result.get('message', 'Interpolation failed'),
                'progress': 0,
                'stage': 'interpolation_error',
                'task_id': str(task_id)
            })
            
            return {
                'status': 'error',
                'attribute': display_name,
                'message': result.get('message'),
                'task_id': str(self.request.id)
            }
        
        # 🔹 3) Abort before map generation
        maybe_abort = abort_if_user_left(job_id, display_name, task_id)
        if maybe_abort:
            return maybe_abort
        
        # ==================== WEBSOCKET UPDATE: MAP GENERATION ====================
        send_task_update(job_id, {
            'status': 'processing',
            'attribute': display_name,
            'message': f'Generating map visualization for {display_name}...',
            'progress': 60,
            'stage': 'map_generation',
            'task_id': str(task_id)
        })
        
        # ==================== STEP 2: GENERATE MAP FROM RASTER ====================
        layer_name = f"interp_{attribute}_{season}_{data_type}_{task_id_short}".replace(' ', '_').replace('(', '').replace(')', '').replace('/', '_')
        temp_dir = tempfile.gettempdir()
        tiff_path = os.path.join(temp_dir, f"{layer_name}_clipped.tif")
        
        # Convert GeoJSON to GeoDataFrames for map
        river_gdf = gpd.GeoDataFrame.from_features(river_data['features'], crs='EPSG:4326')
        buffer_gdf = gpd.GeoDataFrame.from_features(river_buffer_data['features'], crs='EPSG:4326')
        
        # Convert subdistrict/basin boundaries
        subdist_gdf = gpd.GeoDataFrame.from_features(subdist_data['features'], crs='EPSG:32644')
        subdist_gdf = subdist_gdf.to_crs('EPSG:4326')
        
        utm_crs = result['processing_info']['utm_crs']
        color_stops = result.get('color_stops', [])
        
        # Generate map
        map_result = generate_map_from_raster(
            tiff_path=tiff_path,
            attribute=attribute,
            river_gdf=river_gdf,
            buffer_gdf=buffer_gdf,
            subdist_gdf=subdist_gdf,
            utm_crs=utm_crs,
            color_stops=color_stops
        )
        
        # ==================== WEBSOCKET UPDATE: COMPLETED ====================
        send_task_update(job_id, {
            'status': 'completed',
            'attribute': display_name,
            'message': f'{display_name} completed successfully',
            'progress': 100,
            'stage': 'completed',
            'has_map': bool(map_result.get('map_image')),
            'statistics': map_result.get('statistics'),
            'task_id': str(task_id)
        })
        
        # logger.info(f"✅ [{job_id}] Completed: {display_name}")
        
        return {
            'status': 'success',
            'attribute': display_name,
            'task_id': str(self.request.id),
            'interpolation': result,
            'map_image': map_result.get('map_image'),
            'legend_image': map_result.get('legend_image'),
            'map_statistics': map_result.get('statistics'),
            'layer_name': layer_name,
            'geoserver_layer': result.get('primary_layer'),
            'color_stops': color_stops
        }
        
    except SoftTimeLimitExceeded:
        send_task_update(job_id, {
            'status': 'error',
            'attribute': display_name,
            'message': 'Task took too long and was forcefully stopped',
            'stage': 'timeout',
            'task_id': str(task_id),
        })
        return {
            'status': 'error',
            'attribute': display_name,
            'task_id': str(task_id),
            'message': 'Timeout',
        }
        
    except Exception as exc:
        # logger.error(f"❌ [{task_id}] Error interpolating {display_name}: {str(exc)}")
        import traceback
        traceback.print_exc()
        
        # ==================== WEBSOCKET UPDATE: EXCEPTION ====================
        send_task_update(job_id, {
            'status': 'error',
            'attribute': display_name,
            'message': str(exc),
            'progress': 0,
            'stage': 'exception',
            'task_id': str(task_id)
        })
        
        # Retry with exponential backoff
        retry_count = self.request.retries
        if retry_count < self.max_retries:
            countdown = 2 ** retry_count  # 2, 4, 8 seconds
            # logger.info(f"🔄 Retrying {display_name} in {countdown}s (attempt {retry_count + 1}/{self.max_retries})")
            raise self.retry(exc=exc, countdown=countdown)
        
        return {
            'status': 'error',
            'attribute': display_name,
            'task_id': str(self.request.id),
            'message': str(exc),
            'retries_exhausted': True
        }





# ==================== BATCH INTERPOLATION JOB ====================
@shared_task(bind=True)
def submit_batch_interpolation_job(self,
                                  attributes,
                                  river_data,
                                  river_buffer_data,
                                  subdist_data,
                                  points_data,
                                  season,
                                  data_type,
                                  identifier_codes):
    """
    Main task that orchestrates parallel interpolation
    Uses Celery GROUP for parallel execution + CHORD for finalization
    
    This replaces the synchronous batch_interpolation_internal()
    """
    
    job_id = str(self.request.id)   # <── This is the MAIN job_id used by frontend WebSocket
    VALID = set(BACKEND_PARAMETER_DISPLAY_NAMES.keys())

    invalid = [a for a in attributes if a not in VALID]

    if invalid:
        return {
            "status": "error",
            "message": f"Invalid parameters: {invalid}"
        }
        
    
    # 🔹 NEW: mark this job as active when it is submitted
    cache.set(f"user_active_{job_id}", True, timeout=3600)
    
    try:
        # logger.info(f"\n{'='*80}")
        # logger.info(f"🚀 BATCH JOB SUBMITTED: {len(attributes)} attributes")
        # logger.info(f"   Job ID: {self.request.id}")
        # logger.info(f"   Attributes: {attributes}")
        # logger.info(f"   Season: {season}")
        # logger.info(f"   Data Type: {data_type}")
        # logger.info(f"{'='*80}\n")
        
        # Create parallel tasks for ALL attributes
        # This runs 17 tasks simultaneously (one per worker)
        parallel_tasks = group([
            interpolate_single_parameter.s(
                attribute=attr,
                river_data=river_data,
                river_buffer_data=river_buffer_data,
                subdist_data=subdist_data,
                points_data=points_data,
                season=season,
                data_type=data_type,
                identifier_codes=identifier_codes,
                job_id=job_id 
            )
            for attr in attributes
        ])
        
        # Use CHORD to run all tasks in parallel, then finalize
        job_chain = chord(parallel_tasks)(finalize_interpolation_job.s(
            attributes=attributes,
            season=season,
            data_type=data_type,
            identifier_codes=identifier_codes,
            job_id=job_id 
        )).on_error(group_error_handler)
        
        # 🔹 NEW: map outer job_id → Celery group_id
        try:
            group_id = job_chain.parent.id  # parent is GroupResult
            cache.set(f"group_for_{job_id}", group_id, timeout=3600)
        except Exception as e:
            pass
            # logger.warning(f"Could not store group_id for job {job_id}: {e}")
        
        # logger.info(f"✅ Batch job orchestrated with JOB_ID (WebSocket ID): {job_id}")
        
        return {
            'status': 'processing',
            'job_id': job_id,
            'submitted_attributes': len(attributes),
            'status_message': f'Processing {len(attributes)} attributes in parallel...'
        }
        
    except Exception as exc:
        # logger.error(f"❌ Failed to submit batch job: {str(exc)}")
        import traceback
        traceback.print_exc()
        
        return {
            'status': 'error',
            'job_id': str(self.request.id),
            'message': str(exc),
            'error_type': 'job_submission_failed'
        }




@shared_task(bind=True)
def finalize_interpolation_job(self,
                              all_results,
                              attributes,
                              season,
                              data_type,
                              identifier_codes,
                              job_id):
    """
    Chord callback - runs AFTER all interpolation tasks complete
    Aggregates results and prepares response for frontend
    """
    task_id = self.request.id
    # logger.info(f"WS_DEBUG → finalize sending using JOB_ID = {job_id}")
    # logger.warning(f"[CELERY BEFORE DELETE] pdf_job_lock = {cache.get('pdf_job_lock')}")

    cache.delete(f"user_active_{job_id}")
    cache.delete(f"group_for_{job_id}")
    
    # logger.warning(f"[CELERY AFTER DELETE] pdf_job_lock = {cache.get('pdf_job_lock')}")
    # logger.info(f"🧹 Cleanup done for job {job_id}")
    # At start of finalize_interpolation_job
    if not cache.get(f"user_active_{job_id}", True):
        # logger.warning(f"🚫 Finalization cancelled for job {job_id}")

        send_task_update(job_id, {
            "status": "cancelled",
            "stage": "finalization_skipped",
            "message": "Finalization skipped because user disconnected"
        })

        return {
            "status": "cancelled",
            "job_id": job_id,
            "message": "Finalization skipped — user left early",
            "results": all_results,
        }

    try:
        # logger.info(f"\n{'='*80}")
        # logger.info(f"🎯 FINALIZATION: Aggregating {len(all_results)} results")
        # logger.info(f"{'='*80}\n")
        
        successful = 0
        failed = 0
        cancelled = 0
        results_list = []
        
        for result in all_results:
            if result['status'] == 'success':
                successful += 1
                results_list.append(result)
                # logger.info(f"✅ {result['attribute']}")
            elif result['status'] == 'cancelled':
                cancelled += 1
                results_list.append(result)
                # logger.warning(f"🚫 CANCELLED {result['attribute']}: {result.get('message')}")
            else:
                failed += 1
                results_list.append(result)
                # logger.warning(f"❌ {result['attribute']}: {result.get('message')}")
        
        total = len(attributes)
        
        if cancelled == total and total > 0:
            send_task_update(job_id, {
                'status': 'cancelled',
                'message': 'All interpolations cancelled (user disconnected)',
                'summary': {
                    'total': total,
                    'successful': successful,
                    'failed': failed,
                    'cancelled': cancelled,
                    'season': season,
                    'data_type': data_type
                },
                'results': results_list,
                'progress': 0,
                'stage': 'all_cancelled',
                'task_id': str(task_id)
            })
            
            return {
                'status': 'cancelled',
                'job_id': job_id,
                'summary': {
                    'total_attributes': total,
                    'successful': successful,
                    'failed': failed,
                    'cancelled': cancelled,
                    'season': season,
                    'data_type': data_type
                },
                'results': results_list,
                'metadata': {
                    'timestamp': time.time(),
                    'identifier_codes': identifier_codes,
                    'processing_complete': False
                }
            }
            
        # ==================== WEBSOCKET UPDATE: FINAL COMPLETION ====================
        send_task_update(job_id, {
            'status': 'completed',
            'message': 'All interpolations completed',
            'summary': {
                'total': len(attributes),
                'successful': successful,
                'failed': failed,
                'season': season,
                'data_type': data_type
            },
            'results': results_list,
            'progress': 100,
            'stage': 'finalization_complete',
            'task_id': str(task_id)
        })
        
        final_response = {
            'status': 'completed' if successful > 0 else 'failed',
            'job_id': job_id,
            'summary': {
                'total_attributes': len(attributes),
                'successful': successful,
                'failed': failed,
                'season': season,
                'data_type': data_type
            },
            'results': results_list,
            'metadata': {
                'timestamp': time.time(),
                'identifier_codes': identifier_codes,
                'processing_complete': True
            }
        }
        
        # logger.info(f"\n{'='*80}")
        # logger.info(f"✅ JOB COMPLETE")
        # logger.info(f"   Successful: {successful}/{len(attributes)}")
        # logger.info(f"   Failed: {failed}/{len(attributes)}")
        # logger.info(f"{'='*80}\n")
        
        return final_response
        
    except Exception as exc:
        # logger.error(f"❌ Finalization failed: {str(exc)}")
        import traceback
        traceback.print_exc()
        
        # ==================== WEBSOCKET UPDATE: FINALIZATION ERROR ====================
        send_task_update(job_id, {
            'status': 'error',
            'message': f'Finalization error: {str(exc)}',
            'progress': 0,
            'stage': 'finalization_error',
            'task_id': str(task_id)
        })
        
        return {
            'status': 'error',
            'job_id': job_id,
            'message': f'Finalization error: {str(exc)}',
            'partial_results': all_results
        }





# ==================== CLEANUP TASK (Optional) ====================
@shared_task
def cleanup_expired_jobs():
    """
    Periodic task to clean up old temporary files
    Runs daily at 2 AM
    """
    try:
        # logger.info("🧹 Starting cleanup of temporary interpolation files...")
        
        from datetime import datetime, timedelta
        import glob
        
        temp_dir = tempfile.gettempdir()
        cutoff_time = time.time() - (7 * 24 * 3600)  # 7 days ago
        
        # Clean old raster files
        pattern = os.path.join(temp_dir, "interp_*.tif")
        cleaned = 0
        
        for file_path in glob.glob(pattern):
            if os.path.getmtime(file_path) < cutoff_time:
                try:
                    os.remove(file_path)
                    cleaned += 1
                    # logger.info(f"  🗑️  Removed: {os.path.basename(file_path)}")
                except Exception as e:
                    pass
                    # logger.warning(f"  ⚠️  Failed to remove {file_path}: {e}")
        
        # logger.info(f"✅ Cleanup complete: {cleaned} files removed")
        return f"Cleaned {cleaned} temporary files"
        
    except Exception as exc:
        
        # logger.error(f"❌ Cleanup failed: {str(exc)}")
        return f"Cleanup error: {str(exc)}"


# ==================== STATUS TRACKING ====================
@shared_task
def get_job_progress(job_id):
    """
    Get current progress of a batch interpolation job
    Using the stored Celery group_id for this job.
    """
    try:
        group_id = cache.get(f"group_for_{job_id}")
        if not group_id:
            return {
                "status": "not_found",
                "job_id": job_id,
                "message": "No group_id mapped for this job"
            }

        result = GroupResult.restore(group_id)
        if result is None:
            return {
                "status": "not_found",
                "job_id": job_id,
                "message": "GroupResult not found"
            }

        completed = sum(1 for r in result.results if r.ready())
        total = len(result.results)

        return {
            "job_id": job_id,
            "status": "processing" if completed < total else "completed",
            "progress": {
                "completed": completed,
                "total": total,
                "percentage": int((completed / total) * 100) if total > 0 else 0
            }
        }

    except Exception as exc:
        # logger.error(f"Error getting job progress for {job_id}: {str(exc)}")
        return {
            "status": "error",
            "job_id": job_id,
            "message": str(exc)
        }




def group_error_handler(request, exc, traceback):
    job_id = request.kwargs.get("job_id") or request.id
    try:
        send_task_update(job_id, {
            "status": "error",
            "stage": "parallel_task_error",
            "message": f"One or more interpolation tasks failed: {str(exc)}",
        })
    except Exception as e:
        pass
        # Avoid raising from error handler
        # logger.error(f"Error in group_error_handler for job {job_id}: {e}")
        
        
        
        
def abort_if_user_left(job_id, display_name, task_id):
    """
    Abort current Celery task if the user has disconnected.
    Returns a dict if aborted, otherwise returns None.
    """
    is_active = cache.get(f"user_active_{job_id}", True)

    if not is_active:
        # logger.warning(f"🚫 User disconnected (job={job_id}) → aborting {display_name}")

        send_task_update(job_id, {
            "status": "cancelled",
            "attribute": display_name,
            "message": "User disconnected, task aborted",
            "stage": "user_disconnected",
            "task_id": str(task_id),
        })

        return {
            "status": "cancelled",
            "attribute": display_name,
            "task_id": str(task_id),
            "message": "User disconnected",
        }

    return None  # Means: continue normal flow



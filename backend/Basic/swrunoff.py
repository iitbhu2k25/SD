from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from sklearn.decomposition import PCA
import math
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Wedge
import io
import base64
from PIL import Image
import os
import gc
import logging
from django.conf import settings
from django.core.files.storage import default_storage
from .models import BasicRunoffCoefficient

# Set up logging
logger = logging.getLogger(__name__)

class swrunoffView(APIView):
    permission_classes = [AllowAny]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Removed MAX_VILLAGES limit - can now process unlimited villages
        self.MAX_VISUALIZATION_GROUPS = 20
        self.BATCH_SIZE = 500  # Process villages in batches for memory efficiency
        self.CONNECTIVITY_BUFFER = 100  # Buffer distance in meters to check connectivity
        
        # Define shapefile path more robustly
        self.shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'Final_Village', 'Edited2.shp')

    def detect_shape_type(self, polygon):
        """Advanced shape detection using geometric analysis"""
        try:
            if not polygon or polygon.is_empty or not polygon.is_valid:
                logger.warning("Invalid polygon detected, using default classification")
                return "Sector", 0.5

            coords = list(polygon.exterior.coords)[:-1]
            coords_array = np.array(coords)

            if len(coords_array) < 3:
                logger.warning(f"Insufficient coordinates ({len(coords_array)}), using default")
                return "Sector", 0.5

            # Calculate geometric properties
            area = polygon.area
            perimeter = polygon.length
            compactness = 4 * math.pi * area / (perimeter ** 2) if perimeter > 0 else 0

            # PCA for aspect ratio
            try:
                pca = PCA(n_components=2)
                pca.fit(coords_array)
                eigenvalues = pca.explained_variance_
                aspect_ratio = eigenvalues[0] / eigenvalues[1] if eigenvalues[1] > 0 else 1.0
            except Exception as e:
                logger.warning(f"PCA calculation failed: {e}")
                aspect_ratio = 1.0

            # Rectangularity measure
            try:
                min_rect = polygon.minimum_rotated_rectangle
                rect_area = min_rect.area
                rectangularity = area / rect_area if rect_area > 0 else 0
            except Exception as e:
                logger.warning(f"Rectangularity calculation failed: {e}")
                rectangularity = 0

            # Convexity measure
            try:
                convex_hull = polygon.convex_hull
                convexity = area / convex_hull.area if convex_hull.area > 0 else 0
            except Exception as e:
                logger.warning(f"Convexity calculation failed: {e}")
                convexity = 1.0

            right_angle_ratio = self._calculate_right_angle_ratio(coords_array)
            radial_variance = self._calculate_radial_variance(polygon, coords_array)

            classification, confidence = self._classify_using_scores({
                'compactness': compactness,
                'aspect_ratio': aspect_ratio,
                'rectangularity': rectangularity,
                'convexity': convexity,
                'right_angle_ratio': right_angle_ratio,
                'radial_variance': radial_variance
            })

            return classification, confidence

        except Exception as e:
            logger.error(f"Shape detection failed: {e}")
            return self._simple_shape_detection(polygon)

    def _calculate_right_angle_ratio(self, coords_array):
        """Calculate the ratio of corners with right angles"""
        try:
            angles = []
            n = len(coords_array)
            
            for i in range(n):
                p1 = coords_array[i-1]
                p2 = coords_array[i]
                p3 = coords_array[(i+1) % n]
                
                v1 = p1 - p2
                v2 = p3 - p2
                
                v1_norm = np.linalg.norm(v1)
                v2_norm = np.linalg.norm(v2)
                
                if v1_norm > 0 and v2_norm > 0:
                    cos_angle = np.dot(v1, v2) / (v1_norm * v2_norm)
                    cos_angle = np.clip(cos_angle, -1, 1)
                    angle = np.degrees(np.arccos(cos_angle))
                    angles.append(angle)

            if len(angles) == 0:
                return 0

            right_angles = sum(1 for angle in angles if 85 <= angle <= 95)
            return right_angles / len(angles)

        except Exception as e:
            logger.warning(f"Right angle calculation failed: {e}")
            return 0

    def _calculate_radial_variance(self, polygon, coords_array):
        """Calculate radial variance from centroid"""
        try:
            centroid = polygon.centroid
            distances = [Point(coord).distance(centroid) for coord in coords_array]
            
            if len(distances) == 0:
                return 0
                
            mean_distance = np.mean(distances)
            if mean_distance == 0:
                return 0
                
            return np.std(distances) / mean_distance

        except Exception as e:
            logger.warning(f"Radial variance calculation failed: {e}")
            return 0

    def _classify_using_scores(self, shape_analysis):
        """Classify shape using weighted scoring system"""
        rectangle_score = 0
        sector_score = 0

        # Rectangle indicators
        if shape_analysis['rectangularity'] > 0.7:
            rectangle_score += 3
        elif shape_analysis['rectangularity'] > 0.5:
            rectangle_score += 1

        if shape_analysis['right_angle_ratio'] > 0.6:
            rectangle_score += 3
        elif shape_analysis['right_angle_ratio'] > 0.4:
            rectangle_score += 1

        if 1.5 < shape_analysis['aspect_ratio'] < 5:
            rectangle_score += 2

        if shape_analysis['compactness'] < 0.5:
            rectangle_score += 1

        # Sector indicators
        if shape_analysis['radial_variance'] > 0.3:
            sector_score += 2

        if shape_analysis['compactness'] > 0.3:
            sector_score += 1

        if shape_analysis['convexity'] > 0.8:
            sector_score += 1

        if shape_analysis['aspect_ratio'] > 3:
            sector_score += 1

        total_score = rectangle_score + sector_score
        if total_score == 0:
            return "Sector", 0.5

        confidence = max(rectangle_score, sector_score) / total_score

        if rectangle_score > sector_score:
            return 'Rectangle', confidence
        else:
            return 'Sector', confidence

    def _simple_shape_detection(self, polygon):
        """Fallback simple detection method"""
        try:
            coords = list(polygon.exterior.coords)
            num_vertices = len(coords) - 1

            if num_vertices == 4:
                angles = []
                for i in range(4):
                    p1 = coords[i]
                    p2 = coords[(i + 1) % 4]
                    p3 = coords[(i + 2) % 4]

                    v1 = (p1[0] - p2[0], p1[1] - p2[1])
                    v2 = (p3[0] - p2[0], p3[1] - p2[1])

                    dot_product = v1[0]*v2[0] + v1[1]*v2[1]
                    mag_v1 = np.sqrt(v1[0]**2 + v1[1]**2)
                    mag_v2 = np.sqrt(v2[0]**2 + v2[1]**2)

                    if mag_v1 > 0 and mag_v2 > 0:
                        cos_angle = dot_product / (mag_v1 * mag_v2)
                        cos_angle = np.clip(cos_angle, -1, 1)
                        angle = np.arccos(cos_angle)
                        angles.append(np.degrees(angle))

                if len(angles) == 4:
                    avg_angle = np.mean(angles)
                    if 85 <= avg_angle <= 95:
                        return "Rectangle", 0.8

            return "Sector", 0.6

        except Exception as e:
            logger.warning(f"Simple shape detection failed: {e}")
            return "Sector", 0.5

    def check_villages_connectivity(self, village_data_list):
        """
        Simplified connectivity check - determines if villages should be treated as one group or separate groups
        Returns: 'continuous' if all villages should be merged, 'discrete' if each should be separate
        """
        try:
            if len(village_data_list) <= 1:
                return 'continuous'  # Single village is always continuous

            # Collect all valid geometries
            geometries = []
            for village in village_data_list:
                geom = village['geometry']
                if geom and not geom.is_empty and geom.is_valid:
                    geometries.append(geom)

            if len(geometries) <= 1:
                return 'continuous'

            # Create buffered versions for proximity checking
            buffered_geometries = []
            for geom in geometries:
                try:
                    buffered = geom.buffer(self.CONNECTIVITY_BUFFER)
                    buffered_geometries.append(buffered)
                except Exception as e:
                    logger.warning(f"Failed to buffer geometry: {e}")
                    buffered_geometries.append(geom)

            # Check if any geometries touch, intersect, or are within buffer distance
            connected_pairs = 0
            total_possible_pairs = len(geometries) * (len(geometries) - 1) // 2

            for i in range(len(geometries)):
                for j in range(i + 1, len(geometries)):
                    try:
                        geom1 = geometries[i]
                        geom2 = geometries[j]
                        buffered1 = buffered_geometries[i]
                        buffered2 = buffered_geometries[j]

                        # Check various connectivity conditions
                        if (geom1.touches(geom2) or 
                            geom1.intersects(geom2) or 
                            buffered1.intersects(geom2) or 
                            buffered2.intersects(geom1) or
                            buffered1.intersects(buffered2)):
                            connected_pairs += 1
                            break  # Found at least one connection for this geometry

                    except Exception as e:
                        logger.warning(f"Connectivity check failed for geometries {i}-{j}: {e}")
                        continue

            # Calculate connectivity ratio
            connectivity_ratio = connected_pairs / total_possible_pairs if total_possible_pairs > 0 else 0

            # Decision logic: if more than 30% of possible connections exist, treat as continuous
            if connectivity_ratio > 0.3 or connected_pairs >= len(geometries) - 1:
                logger.info(f"Villages detected as CONTINUOUS (connectivity ratio: {connectivity_ratio:.2f})")
                return 'continuous'
            else:
                logger.info(f"Villages detected as DISCRETE (connectivity ratio: {connectivity_ratio:.2f})")
                return 'discrete'

        except Exception as e:
            logger.error(f"Connectivity check failed: {e}")
            # Default to continuous if check fails
            return 'continuous'

    def create_village_groups(self, village_data_list):
        """
        Simplified grouping: either one group (continuous) or individual groups (discrete)
        """
        try:
            connectivity_type = self.check_villages_connectivity(village_data_list)
            
            if connectivity_type == 'continuous':
                # All villages in one group
                return [village_data_list]
            else:
                # Each village as separate group
                return [[village] for village in village_data_list]

        except Exception as e:
            logger.error(f"Village grouping failed: {e}")
            # Fallback: each village as separate group
            return [[village] for village in village_data_list]

    def merge_village_geometries(self, village_group):
        """Merge geometries of villages in a group"""
        try:
            geometries = []
            for village in village_group:
                geom = village['geometry']
                if geom and not geom.is_empty and geom.is_valid:
                    geometries.append(geom)

            if not geometries:
                logger.warning("No valid geometries found for merging")
                return None

            if len(geometries) == 1:
                return geometries[0]

            merged_geometry = unary_union(geometries)

            if hasattr(merged_geometry, 'geoms'):
                # If result is a MultiPolygon, take the largest polygon
                largest_polygon = max(merged_geometry.geoms, key=lambda x: x.area)
                return largest_polygon
            else:
                return merged_geometry

        except Exception as e:
            logger.error(f"Geometry merging failed: {e}")
            # Fallback: return first valid geometry
            for village in village_group:
                if village['geometry'] and not village['geometry'].is_empty:
                    return village['geometry']
            return None

    def calculate_group_analysis(self, village_groups, total_area):
        """Analyze village groups and determine overall shape"""
        try:
            group_analyses = []

            for group_idx, village_group in enumerate(village_groups):
                try:
                    if len(village_group) == 1:
                        # Single village group
                        village = village_group[0]
                        geometry = village['geometry']
                        if not geometry or geometry.is_empty:
                            continue

                        detected_shape, confidence = self.detect_shape_type(geometry)
                        group_analysis = {
                            'group_id': group_idx + 1,
                            'village_count': 1,
                            'village_codes': [village['village_code']],
                            'detected_shape': detected_shape,
                            'confidence_score': confidence,
                            'group_type': 'discrete_single'
                        }
                    else:
                        # Multiple villages - merge them
                        merged_geometry = self.merge_village_geometries(village_group)
                        if not merged_geometry or merged_geometry.is_empty:
                            continue

                        detected_shape, confidence = self.detect_shape_type(merged_geometry)
                        group_analysis = {
                            'group_id': group_idx + 1,
                            'village_count': len(village_group),
                            'village_codes': [v['village_code'] for v in village_group],
                            'detected_shape': detected_shape,
                            'confidence_score': confidence,
                            'group_type': 'continuous_merged'
                        }

                    group_analyses.append(group_analysis)

                except Exception as e:
                    logger.warning(f"Group {group_idx + 1} analysis failed: {e}")
                    continue

            if not group_analyses:
                logger.error("No groups could be analyzed successfully")
                return None

            # For simplified logic, use the group with highest confidence
            # If there's only one group (continuous), use that
            # If multiple groups (discrete), use the one with best confidence
            best_group = max(group_analyses, key=lambda x: x['confidence_score'])

            overall_analysis = {
                'overall_shape_type': best_group['detected_shape'],
                'overall_confidence': round(best_group['confidence_score'], 3),
                'total_groups': len(group_analyses),
                'best_group_id': best_group['group_id'],
                'best_group_type': best_group['group_type'],
                'best_group_villages': best_group['village_codes'],
                'total_area_hectares': total_area,
                'group_details': group_analyses,
                'connectivity_type': 'continuous' if len(group_analyses) == 1 else 'discrete'
            }

            return overall_analysis

        except Exception as e:
            logger.error(f"Group analysis calculation failed: {e}")
            return None

    def get_shape_attributes(self, shape_type):
        """Get attribute column names based on shape type"""
        try:
            # Check if model exists and has fields
            if not hasattr(BasicRunoffCoefficient, '_meta'):
                logger.error("BasicRunoffCoefficient model not properly defined")
                return []
                
            all_fields = [field.name for field in BasicRunoffCoefficient._meta.get_fields()
                         if field.concrete and field.name != 'id']

            attribute_names = []
            if shape_type.lower() == 'sector':
                attribute_names = [field for field in all_fields if field.startswith('sector_')]
            else:
                attribute_names = [field for field in all_fields if field.startswith('rectangle_')]

            return attribute_names

        except Exception as e:
            logger.error(f"Failed to get shape attributes: {e}")
            return []

    def get_all_durations(self):
        """Fetch all duration values from database"""
        try:
            # Check if table exists and has data
            if BasicRunoffCoefficient.objects.exists():
                durations = BasicRunoffCoefficient.objects.values_list('duration_t_minutes', flat=True).distinct()
                return sorted(list(durations))
            else:
                logger.warning("BasicRunoffCoefficient table is empty")
                return []

        except Exception as e:
            logger.error(f"Failed to get duration values: {e}")
            return []

    def create_shape_visualization(self, village_groups, overall_analysis, save_to_file=True):
        """Create PNG visualization of detected shapes"""
        try:
            num_groups = min(len(village_groups), self.MAX_VISUALIZATION_GROUPS)
            if num_groups == 0:
                return None

            # Create figure
            if num_groups == 1:
                fig, ax = plt.subplots(1, 1, figsize=(10, 8))
                axes = [ax]
            else:
                cols = min(3, num_groups)
                rows = (num_groups + cols - 1) // cols
                fig, axes = plt.subplots(rows, cols, figsize=(5*cols, 4*rows))
                
                if num_groups == 1:
                    axes = [axes]
                else:
                    axes = axes.flatten() if hasattr(axes, 'flatten') else [axes]

            # Update title to show connectivity type
            connectivity_type = overall_analysis.get('connectivity_type', 'unknown')
            fig.suptitle(f'Village Shape Analysis ({connectivity_type.title()})\nOverall Shape: {overall_analysis["overall_shape_type"]} '
                        f'(Confidence: {overall_analysis["overall_confidence"]})',
                        fontsize=14, fontweight='bold')

            for group_idx in range(num_groups):
                if group_idx >= len(axes):
                    break

                ax = axes[group_idx]
                village_group = village_groups[group_idx]

                try:
                    group_detail = overall_analysis['group_details'][group_idx]
                    shape_type = group_detail['detected_shape']
                    confidence = group_detail['confidence_score']
                    village_codes = group_detail['village_codes']
                except (IndexError, KeyError):
                    shape_type = overall_analysis['overall_shape_type']
                    confidence = overall_analysis['overall_confidence']
                    village_codes = [v['village_code'] for v in village_group]

                all_x_coords = []
                all_y_coords = []

                # Plot individual village boundaries
                for village in village_group:
                    try:
                        geom = village['geometry']
                        if not geom or geom.is_empty:
                            continue

                        if hasattr(geom, 'exterior'):
                            x_coords, y_coords = geom.exterior.xy
                            ax.fill(x_coords, y_coords, 'blue', alpha=0.3, edgecolor='blue', linewidth=1)
                            all_x_coords.extend(x_coords)
                            all_y_coords.extend(y_coords)

                    except Exception as e:
                        logger.warning(f"Failed to plot village {village.get('village_code', 'unknown')}: {e}")
                        continue

                # Draw idealized shape overlay
                if all_x_coords and all_y_coords:
                    try:
                        min_x, max_x = min(all_x_coords), max(all_x_coords)
                        min_y, max_y = min(all_y_coords), max(all_y_coords)
                        width = max_x - min_x
                        height = max_y - min_y
                        center_x = (min_x + max_x) / 2
                        center_y = (min_y + max_y) / 2

                        if shape_type.lower() == 'rectangle':
                            rect = patches.Rectangle((min_x, min_y), width, height,
                                                   linewidth=3, edgecolor='red',
                                                   facecolor='none', linestyle='--',
                                                   label='Rectangle Fit' if group_idx == 0 else "")
                            ax.add_patch(rect)
                        else:
                            radius = max(width, height) / 2
                            circle = patches.Circle((center_x, center_y), radius,
                                                  linewidth=3, edgecolor='green',
                                                  facecolor='none', linestyle='--',
                                                  label='Sector Fit' if group_idx == 0 else "")
                            ax.add_patch(circle)

                    except Exception as e:
                        logger.warning(f"Failed to draw idealized shape: {e}")

                ax.set_aspect('equal')
                ax.grid(True, alpha=0.3)
                ax.set_xticks([])  # Remove x-axis tick marks and values
                ax.set_yticks([])  # Remove y-axis tick marks and values
                
                title_text = f'Group {group_idx + 1}: {shape_type}\nConfidence: {confidence:.3f}'
                if len(village_group) > 1:
                    title_text += f' ({len(village_group)} villages merged)'
                ax.set_title(title_text, fontsize=10)

                if group_idx == 0:
                    ax.legend(loc='upper right', bbox_to_anchor=(1, 1))

            # Hide unused subplots
            for idx in range(num_groups, len(axes)):
                axes[idx].set_visible(False)

            plt.tight_layout()

            if save_to_file:
                temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
                os.makedirs(temp_dir, exist_ok=True)

                village_codes_str = '_'.join(map(str, [v['village_code']
                                                     for group in village_groups[:num_groups]
                                                     for v in group]))
                filename = f'shape_analysis_{village_codes_str[:50]}.png'
                filepath = os.path.join(temp_dir, filename)

                plt.savefig(filepath, dpi=300, bbox_inches='tight',
                           facecolor='white', edgecolor='none')
                plt.close()
                gc.collect()

                return f'temp/{filename}'
            else:
                buffer = io.BytesIO()
                plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight',
                           facecolor='white', edgecolor='none')
                buffer.seek(0)

                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                plt.close()
                gc.collect()

                return f"data:image/png;base64,{image_base64}"

        except Exception as e:
            logger.error(f"Visualization creation failed: {e}")
            plt.close()
            gc.collect()
            return None

    def process_villages_in_batches(self, village_codes, gdf):
        """Process villages in batches for memory efficiency with large datasets"""
        village_data_list = []
        not_found_codes = []
        invalid_geometry_codes = []
        total_area = 0
        
        # Process in batches
        for i in range(0, len(village_codes), self.BATCH_SIZE):
            batch_codes = village_codes[i:i + self.BATCH_SIZE]
            logger.info(f"Processing batch {i//self.BATCH_SIZE + 1}: villages {i+1} to {min(i+self.BATCH_SIZE, len(village_codes))}")
            
            for village_code in batch_codes:
                try:
                    village_polygon = gdf[gdf['village_co'] == village_code]
                    if village_polygon.empty:
                        not_found_codes.append(village_code)
                        logger.warning(f"Village code {village_code} not found in shapefile")
                        continue

                    polygon_geom = village_polygon.geometry.iloc[0]
                    if not polygon_geom or polygon_geom.is_empty or not polygon_geom.is_valid:
                        invalid_geometry_codes.append(village_code)
                        logger.warning(f"Village code {village_code} has invalid geometry")
                        continue

                    try:
                        area = polygon_geom.area / 10000  # Convert to hectares
                        total_area += area
                    except Exception as e:
                        logger.warning(f"Area calculation failed for village {village_code}: {e}")
                        area = 0

                    village_data = {
                        'village_code': village_code,
                        'geometry': polygon_geom,
                        'area_hectares': area
                    }
                    village_data_list.append(village_data)

                except Exception as e:
                    logger.error(f"Failed to process village {village_code}: {e}")
                    invalid_geometry_codes.append(village_code)
                    continue
            
            # Trigger garbage collection after each batch
            if i > 0 and i % (self.BATCH_SIZE * 5) == 0:
                gc.collect()
        
        return village_data_list, not_found_codes, invalid_geometry_codes, total_area

    def post(self, request):
        """Main POST endpoint for village shape analysis - now supports unlimited villages with simplified grouping"""
        try:
            # Step 1: Validate input
            village_codes = request.data.get('village_code') or request.data.get('village_codes')
            if not village_codes:
                return Response(
                    {"error": "village_code or village_codes is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Normalize to list
            if isinstance(village_codes, (int, str)):
                village_codes = [village_codes]
            elif not isinstance(village_codes, list):
                return Response(
                    {"error": "village_codes must be a number, string, or list"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convert to integers
            try:
                village_codes = [int(code) for code in village_codes]
            except (ValueError, TypeError):
                return Response(
                    {"error": "All village codes must be valid integers"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            village_codes = list(dict.fromkeys(village_codes))
            
            # Log the number of villages being processed
            logger.info(f"Processing {len(village_codes)} villages with simplified grouping logic")

            # Step 2: Load shapefile with better error handling
            try:
                if not os.path.exists(self.shapefile_path):
                    logger.error(f"Shapefile not found at: {self.shapefile_path}")
                    return Response(
                        {"error": "Village boundary data file not found"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

                gdf = gpd.read_file(self.shapefile_path)
                logger.info(f"Shapefile loaded successfully with {len(gdf)} villages")

                # Check if required column exists
                if 'village_co' not in gdf.columns:
                    logger.error("Required column 'village_co' not found in shapefile")
                    return Response(
                        {"error": "Invalid shapefile format - missing village_co column"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            except Exception as e:
                logger.error(f"Failed to load shapefile: {e}")
                return Response(
                    {"error": f"Failed to load village boundary data: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Step 3: Process villages (with batching for large datasets)
            if len(village_codes) > self.BATCH_SIZE:
                logger.info(f"Large dataset detected ({len(village_codes)} villages), using batch processing")
                village_data_list, not_found_codes, invalid_geometry_codes, total_area = self.process_villages_in_batches(village_codes, gdf)
            else:
                village_data_list = []
                not_found_codes = []
                invalid_geometry_codes = []
                total_area = 0

                for village_code in village_codes:
                    try:
                        village_polygon = gdf[gdf['village_co'] == village_code]
                        if village_polygon.empty:
                            not_found_codes.append(village_code)
                            logger.warning(f"Village code {village_code} not found in shapefile")
                            continue

                        polygon_geom = village_polygon.geometry.iloc[0]
                        if not polygon_geom or polygon_geom.is_empty or not polygon_geom.is_valid:
                            invalid_geometry_codes.append(village_code)
                            logger.warning(f"Village code {village_code} has invalid geometry")
                            continue

                        try:
                            area = polygon_geom.area / 10000  # Convert to hectares
                            total_area += area
                        except Exception as e:
                            logger.warning(f"Area calculation failed for village {village_code}: {e}")
                            area = 0

                        village_data = {
                            'village_code': village_code,
                            'geometry': polygon_geom,
                            'area_hectares': area
                        }
                        village_data_list.append(village_data)

                    except Exception as e:
                        logger.error(f"Failed to process village {village_code}: {e}")
                        invalid_geometry_codes.append(village_code)
                        continue

            # Check if any valid villages found
            if not village_data_list:
                return Response({
                    "error": "No valid villages found for the provided codes",
                    "total_requested": len(village_codes),
                    "not_found_codes": not_found_codes,
                    "invalid_geometry_codes": invalid_geometry_codes
                }, status=status.HTTP_404_NOT_FOUND)

            logger.info(f"Successfully processed {len(village_data_list)} villages out of {len(village_codes)} requested")

            # Step 4: Simplified grouping analysis
            try:
                village_groups = self.create_village_groups(village_data_list)
                connectivity_type = 'continuous' if len(village_groups) == 1 else 'discrete'
                logger.info(f"Created {len(village_groups)} village groups - detected as {connectivity_type}")
            except Exception as e:
                logger.error(f"Village grouping failed: {e}")
                return Response(
                    {"error": "Failed to perform village grouping analysis"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Step 5: Shape analysis
            try:
                overall_analysis = self.calculate_group_analysis(village_groups, total_area)
                if not overall_analysis:
                    return Response(
                        {"error": "Could not perform shape analysis on village groups"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                logger.info(f"Shape analysis completed: {overall_analysis['overall_shape_type']} "
                          f"with confidence {overall_analysis['overall_confidence']} "
                          f"(connectivity: {overall_analysis.get('connectivity_type', 'unknown')})")
            except Exception as e:
                logger.error(f"Group analysis failed: {e}")
                return Response(
                    {"error": "Failed to perform shape analysis"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Step 6: Get attributes and durations
            try:
                shape_attributes = self.get_shape_attributes(overall_analysis['overall_shape_type'])
                all_durations = self.get_all_durations()
            except Exception as e:
                logger.warning(f"Failed to get shape attributes or durations: {e}")
                shape_attributes = []
                all_durations = []

            # Step 7: Create visualizations (optional)
            detailed_image_path = None
            try:
                detailed_image_path = self.create_shape_visualization(
                    village_groups, overall_analysis, save_to_file=True
                )
                if detailed_image_path:
                    logger.info("Detailed visualization created successfully")
            except Exception as e:
                logger.warning(f"Visualization creation failed: {e}")

            # Step 8: Prepare response
            response_data = {
                'total_area_hectares': round(total_area, 4),
                'overall_shape_type': overall_analysis['overall_shape_type'],
                'overall_confidence': overall_analysis['overall_confidence'],
                'connectivity_type': overall_analysis.get('connectivity_type', 'unknown'),
                'total_villages_analyzed': len(village_data_list),
                'total_villages_requested': len(village_codes),
                'grouping_analysis': {
                    'total_groups_found': overall_analysis['total_groups'],
                    'connectivity_type': overall_analysis.get('connectivity_type', 'unknown'),
                    'connectivity_buffer_meters': self.CONNECTIVITY_BUFFER,
                    'best_confidence_group_id': overall_analysis['best_group_id'],
                    'best_group_type': overall_analysis['best_group_type'],
                    'best_group_villages': overall_analysis['best_group_villages'],
                    'group_details': overall_analysis['group_details']
                },
                'visualizations': {
                    'detailed_analysis_image': f"{request.build_absolute_uri('/')[:-1]}{settings.MEDIA_URL}{detailed_image_path}" if detailed_image_path else None
                },
                'all_duration_values': all_durations,
                'shape_attributes': shape_attributes,
                'processing_stats': {
                    'successful_villages': len(village_data_list),
                    'failed_villages': len(not_found_codes) + len(invalid_geometry_codes),
                    'success_rate': round(len(village_data_list) / len(village_codes) * 100, 2),
                    'used_batch_processing': len(village_codes) > self.BATCH_SIZE,
                    'batch_size': self.BATCH_SIZE if len(village_codes) > self.BATCH_SIZE else None,
                    'grouping_logic': 'simplified - continuous or discrete only'
                }
            }

            # Add error information if any
            if not_found_codes or invalid_geometry_codes:
                response_data['errors'] = {
                    'not_found_codes': not_found_codes,
                    'invalid_geometry_codes': invalid_geometry_codes,
                    'not_found_count': len(not_found_codes),
                    'invalid_geometry_count': len(invalid_geometry_codes)
                }

            # Determine status
            if not_found_codes or invalid_geometry_codes:
                response_status = status.HTTP_206_PARTIAL_CONTENT
            else:
                response_status = status.HTTP_200_OK

            gc.collect()
            return Response(response_data, status=response_status)

        except Exception as e:
            logger.error(f"Unexpected error in village shape analysis: {e}")
            gc.collect()
            return Response({
                "error": "An unexpected error occurred during analysis",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """GET endpoint to fetch duration values"""
        try:
            all_durations = self.get_all_durations()
            return Response({
                'duration_values': all_durations,
                'total_count': len(all_durations),
                'description': 'Available duration values in minutes for runoff analysis'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to fetch duration values: {e}")
            return Response({
                "error": "Failed to retrieve duration values",
                "details": str(e) if settings.DEBUG else "Please contact support"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
"""
WQI Calculator Service
Calculates Water Quality Index using Core (Mandatory) and Supporting (Optional) parameters.

Methodology:
1. Core Parameters (Mandatory): DO, BOD, pH, FC.
   - If any core parameter is missing, WQI cannot be calculated.
2. Supporting Parameters (Optional): Turbidity, TDS, Temperature, EC, TSS, COD, Nitrate.
   - Can be present or absent.
3. Normalization:
   - Total Weight = Sum(Core Weights) + Sum(Present Supporting Weights)
   - Normalized Weight (Wi) = Original Weight / Total Weight
   - WQI = Σ(Qi * Normalized Wi)

Weights:
    Core:
        - DO: 0.30
        - BOD: 0.20
        - pH: 0.15
        - FC: 0.10
    Supporting:
        - Turbidity: 0.040
        - TDS: 0.038
        - Temperature: 0.038
        - EC: 0.038
        - TSS: 0.038
        - COD: 0.029
        - Nitrate: 0.029
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
import numpy as np
import pandas as pd


@dataclass
class WQIResult:
    """Result of WQI calculation for a single point"""
    wqi_score: float
    wqi_class: str
    wqi_color: str
    sub_indices: Dict[str, float] = field(default_factory=dict)
    missing_params: List[str] = field(default_factory=list)
    used_params: List[str] = field(default_factory=list)
    is_valid: bool = True
    error_message: Optional[str] = None


class WQICalculator:
    """
    Calculates Water Quality Index (WQI) using Core/Supporting parameter method.
    """
    
    # Define Parameters and Weights
    CORE_PARAMS = {
        'DO': 0.30,
        'BOD': 0.20,
        'pH': 0.15,
        'FC': 0.10
    }
    
    SUPPORTING_PARAMS = {
        'Turbidity': 0.040,
        'TDS': 0.038,
        'Temperature': 0.038,
        'EC': 0.038,
        'TSS': 0.038,
        'COD': 0.029,
        'Nitrate': 0.029
    }
    
    # Combined for easy lookup
    ALL_PARAMS = {**CORE_PARAMS, **SUPPORTING_PARAMS}
    
    # Standards for sub-index calculation (Qi)
    # Using same standards as before, just updated weights logic
    STANDARDS = {
        'DO': {'ideal': 7.0, 'standard': 5.0, 'type': 'beneficial'},
        'BOD': {'ideal': 0.0, 'standard': 3.0, 'type': 'detrimental', 'log': True},
        'FC': {'ideal': 0.0, 'standard': 500.0, 'type': 'detrimental', 'log': True},
        'pH': {'ideal': 7.0, 'low': 6.5, 'high': 8.5, 'type': 'pH'},
        'Turbidity': {'ideal': 0.0, 'standard': 10.0, 'type': 'detrimental', 'log': False},
        'EC': {'ideal': 0.0, 'standard': 1500.0, 'type': 'detrimental', 'log': True},
        'TDS': {'ideal': 0.0, 'standard': 500.0, 'type': 'detrimental', 'log': True}, # Added TDS based on request
        'TSS': {'ideal': 0.0, 'standard': 500.0, 'type': 'detrimental', 'log': True}, # Added TSS (assuming similar to TDS/TS logic if standard not provided, using 500 placeholder or previous TS standard)
        'TS': {'ideal': 0.0, 'standard': 1500.0, 'type': 'detrimental', 'log': True}, # Kept for backward compatibility if needed, but user asked for TDS/TSS
        'COD': {'ideal': 0.0, 'standard': 30.0, 'type': 'detrimental', 'log': True},
        'Temperature': {'ideal': 25.0, 'standard': 35.0, 'type': 'temperature'},
        'Nitrate': {'ideal': 0.0, 'standard': 45.0, 'type': 'detrimental', 'log': True},
    }
    
    # WQI Classification
    WQI_CLASSES = [
        (0, 50, 'Excellent', '#22c55e'),      # Green
        (51, 100, 'Good', '#3b82f6'),         # Blue
        (101, 200, 'Poor', '#eab308'),        # Yellow
        (201, 300, 'Very Poor', '#f97316'),   # Orange
        (301, float('inf'), 'Unsuitable', '#ef4444'),  # Red
    ]
    
    def __init__(self):
        # Map TS/TSS/TDS to standard keys if needed. 
        # For now, we assume input keys match SUPPORTING_PARAMS keys.
        pass
    
    def calculate(self, data: Dict[str, float]) -> WQIResult:
        """
        Calculate WQI for a single data point.
        """
        sub_indices = {}
        used_params = []
        missing_params = []
        
        # 1. Validate Core Parameters
        missing_core = [param for param in self.CORE_PARAMS if data.get(param) is None]
        if missing_core:
            return WQIResult(
                wqi_score=0,
                wqi_class='Invalid',
                wqi_color='#9ca3af',
                is_valid=False,
                error_message=f"Missing Core Parameters: {', '.join(missing_core)}"
            )
            
        # 2. Calculate Qi for Core Params
        current_weights = {}
        
        for param in self.CORE_PARAMS:
            val = float(data[param])
            qi = self._calculate_sub_index(param, val)
            if qi is not None:
                sub_indices[param] = qi
                current_weights[param] = self.CORE_PARAMS[param]
                used_params.append(param)
            else:
                # This shouldn't happen if validation passed, unless calculation fails (e.g. NaN)
                return WQIResult(0, 'Invalid', '#9ca3af', is_valid=False, error_message=f"Error calculating {param}")

        # 3. Calculate Qi for Supporting Params (if present)
        for param in self.SUPPORTING_PARAMS:
            val = data.get(param)
            if val is not None:
                try:
                    val = float(val)
                    qi = self._calculate_sub_index(param, val)
                    if qi is not None:
                        sub_indices[param] = qi
                        current_weights[param] = self.SUPPORTING_PARAMS[param]
                        used_params.append(param)
                except (ValueError, TypeError):
                    missing_params.append(param)
            else:
                missing_params.append(param)
                
        # 4. Normalize Weights
        total_weight = sum(current_weights.values())
        if total_weight == 0:
             return WQIResult(0, 'Invalid', '#9ca3af', is_valid=False, error_message="Total weight is zero")
             
        # 5. Calculate Final WQI
        wqi_score = 0.0
        for param, qi in sub_indices.items():
            normalized_weight = current_weights[param] / total_weight
            wqi_score += qi * normalized_weight
            
        # Get classification
        wqi_class, wqi_color = self._get_classification(wqi_score)
        
        return WQIResult(
            wqi_score=round(wqi_score, 2),
            wqi_class=wqi_class,
            wqi_color=wqi_color,
            sub_indices=sub_indices,
            missing_params=missing_params,
            used_params=used_params
        )
    
    def calculate_batch(self, data_list: List[Dict[str, float]]) -> List[WQIResult]:
        return [self.calculate(data) for data in data_list]
    
    def _calculate_sub_index(self, param: str, value: float) -> Optional[float]:
        # Reuse existing logic, mapping param names if necessary
        # Handle TDS/TSS vs TS mismatch if any
        if param == 'TSS' and 'TSS' not in self.STANDARDS:
             # Fallback or mapping? Assuming standards updated above.
             pass
             
        if param not in self.STANDARDS:
            return None
        
        st = self.STANDARDS[param]
        param_type = st['type']
        
        # ... (Same logic as before) ...
        if param_type == 'beneficial':
            ideal = st['ideal']
            standard = st['standard']
            qi = 100 * (ideal - value) / (ideal - standard)
            return float(max(0, min(qi, 300)))
        
        elif param_type == 'pH':
            ideal = st['ideal']
            low = st['low']
            high = st['high']
            dev = abs(value - ideal)
            max_dev = max(abs(low - ideal), abs(high - ideal))
            qi = 100 * dev / max_dev
            return float(max(0, min(qi, 300)))
        
        elif param_type == 'temperature':
            ideal = st['ideal']
            standard = st['standard']
            v = max(value - ideal, 0.0)
            qi = 100 * v / (standard - ideal)
            return float(max(0, min(qi, 300)))
        
        elif param_type == 'detrimental':
            ideal = st['ideal']
            standard = st['standard']
            use_log = st.get('log', False)
            
            if use_log:
                qi = 100 * (np.log10(value + 1) - np.log10(ideal + 1)) / \
                     (np.log10(standard + 1) - np.log10(ideal + 1))
            else:
                qi = 100 * (value - ideal) / (standard - ideal)
            
            return float(max(0, min(qi, 300)))
        
        return None
    
    def _get_classification(self, wqi_score: float) -> Tuple[str, str]:
        for min_val, max_val, class_name, color in self.WQI_CLASSES:
            if min_val <= wqi_score <= max_val:
                return class_name, color
        return 'Unsuitable', '#ef4444'
    
    @classmethod
    def get_weights_info(cls) -> Dict[str, Any]:
        return {
            'core': cls.CORE_PARAMS,
            'supporting': cls.SUPPORTING_PARAMS,
            'all_params': cls.ALL_PARAMS
        }


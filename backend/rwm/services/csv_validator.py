"""
CSV Validator Service
Validates water quality CSV files for WQI calculation.

Validates:
- Required columns exist (lat, lon, pH, DO, BOD, FC)
- Numeric data types for all parameters
- Reports optional columns present
"""

import csv
import io
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field


@dataclass
class CSVValidationResult:
    """Result of CSV validation"""
    success: bool
    data: List[Dict[str, Any]] = field(default_factory=list)
    row_count: int = 0
    required_columns: List[str] = field(default_factory=list)
    optional_columns: List[str] = field(default_factory=list)
    missing_columns: List[str] = field(default_factory=list)
    error_message: Optional[str] = None
    row_errors: List[Dict[str, Any]] = field(default_factory=list)


class CSVValidator:
    """
    Validates CSV files for water quality data.
    
    Usage:
        validator = CSVValidator()
        result = validator.validate(csv_file_or_content)
        if result.success:
            # Use result.data
        else:
            # Handle result.error_message
    """
    
    # Required columns (core parameters)
    REQUIRED_COLUMNS = {'lat', 'lon', 'pH', 'DO', 'BOD', 'FC'}
    
    # Optional columns (supporting parameters)
    OPTIONAL_COLUMNS = {'Temperature', 'Turbidity', 'TDS', 'EC', 'TSS', 'COD', 'Nitrate'}
    
    # Column aliases for case-insensitive matching
    COLUMN_ALIASES = {
        'latitude': 'lat',
        'longitude': 'lon',
        'ph': 'pH',
        'do': 'DO',
        'bod': 'BOD',
        'fc': 'FC',
        'fecal_coliform': 'FC',
        'fecalcoliform': 'FC',
        'temp': 'Temperature',
        'temperature': 'Temperature',
        'turbidity': 'Turbidity',
        'tds': 'TDS',
        'ec': 'EC',
        'electrical_conductivity': 'EC',
        'tss': 'TSS',
        'cod': 'COD',
        'nitrate': 'Nitrate',
    }
    
    # Valid ranges for parameters (for basic sanity checks)
    VALID_RANGES = {
        'lat': (-90, 90),
        'lon': (-180, 180),
        'pH': (0, 14),
        'DO': (0, 20),  # mg/L
        'BOD': (0, 500),  # mg/L
        'FC': (0, 1e9),  # MPN/100mL - can be very high
        'Temperature': (-5, 50),  # °C
        'Turbidity': (0, 4000),  # NTU
        'TDS': (0, 50000),  # mg/L
        'EC': (0, 100000),  # µS/cm
        'TSS': (0, 10000),  # mg/L
        'COD': (0, 5000),  # mg/L
        'Nitrate': (0, 1000),  # mg/L
    }
    
    def __init__(self):
        pass
    
    def validate(self, csv_content: str | bytes | io.StringIO) -> CSVValidationResult:
        """
        Validate CSV content for water quality data.
        
        Args:
            csv_content: CSV file content as string, bytes, or StringIO
            
        Returns:
            CSVValidationResult with validation status and parsed data
        """
        try:
            # Convert to StringIO if needed
            if isinstance(csv_content, bytes):
                csv_content = csv_content.decode('utf-8')
            if isinstance(csv_content, str):
                csv_content = io.StringIO(csv_content)
            
            # Read CSV
            reader = csv.DictReader(csv_content)
            
            if not reader.fieldnames:
                return CSVValidationResult(
                    success=False,
                    error_message="CSV file is empty or has no headers"
                )
            
            # Normalize column names
            original_columns = list(reader.fieldnames)
            normalized_map = self._normalize_columns(original_columns)
            
            # Check for required columns
            found_required = set()
            found_optional = set()
            
            for orig, norm in normalized_map.items():
                if norm in self.REQUIRED_COLUMNS:
                    found_required.add(norm)
                elif norm in self.OPTIONAL_COLUMNS:
                    found_optional.add(norm)
            
            missing_required = self.REQUIRED_COLUMNS - found_required
            
            if missing_required:
                return CSVValidationResult(
                    success=False,
                    missing_columns=list(missing_required),
                    error_message=f"Missing required columns: {', '.join(sorted(missing_required))}"
                )
            
            # Parse and validate rows
            data = []
            row_errors = []
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                parsed_row, errors = self._parse_row(row, normalized_map, row_num)
                
                if errors:
                    row_errors.extend(errors)
                else:
                    data.append(parsed_row)
            
            if not data:
                if row_errors:
                    return CSVValidationResult(
                        success=False,
                        row_errors=row_errors,
                        error_message=f"All rows have validation errors. First error: {row_errors[0]['message']}"
                    )
                return CSVValidationResult(
                    success=False,
                    error_message="CSV file contains no valid data rows"
                )
            
            return CSVValidationResult(
                success=True,
                data=data,
                row_count=len(data),
                required_columns=list(found_required),
                optional_columns=list(found_optional),
                row_errors=row_errors
            )
            
        except csv.Error as e:
            return CSVValidationResult(
                success=False,
                error_message=f"CSV parsing error: {str(e)}"
            )
        except Exception as e:
            return CSVValidationResult(
                success=False,
                error_message=f"Validation error: {str(e)}"
            )
    
    def _normalize_columns(self, columns: List[str]) -> Dict[str, str]:
        """
        Normalize column names using aliases.
        
        Returns:
            Dict mapping original column name to normalized name
        """
        normalized = {}
        for col in columns:
            col_lower = col.lower().strip()
            
            # Check exact match first (case-insensitive)
            if col_lower in self.COLUMN_ALIASES:
                normalized[col] = self.COLUMN_ALIASES[col_lower]
            # Check if it's already a valid column name
            elif col in self.REQUIRED_COLUMNS or col in self.OPTIONAL_COLUMNS:
                normalized[col] = col
            # Check case-insensitive match for required/optional
            else:
                for req in self.REQUIRED_COLUMNS:
                    if col_lower == req.lower():
                        normalized[col] = req
                        break
                for opt in self.OPTIONAL_COLUMNS:
                    if col_lower == opt.lower():
                        normalized[col] = opt
                        break
        
        return normalized
    
    def _parse_row(
        self, 
        row: Dict[str, str], 
        normalized_map: Dict[str, str],
        row_num: int
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parse and validate a single row.
        
        Returns:
            Tuple of (parsed_data, errors)
        """
        parsed = {}
        errors = []
        
        for orig_col, norm_col in normalized_map.items():
            value = row.get(orig_col, '').strip()
            
            if not value:
                # Check if it's a required column
                if norm_col in self.REQUIRED_COLUMNS:
                    errors.append({
                        'row': row_num,
                        'column': norm_col,
                        'message': f"Row {row_num}: Missing required value for '{norm_col}'"
                    })
                continue
            
            # Parse numeric value
            try:
                parsed_value = float(value)
                
                # Validate range if defined
                if norm_col in self.VALID_RANGES:
                    min_val, max_val = self.VALID_RANGES[norm_col]
                    if not (min_val <= parsed_value <= max_val):
                        errors.append({
                            'row': row_num,
                            'column': norm_col,
                            'message': f"Row {row_num}: '{norm_col}' value {parsed_value} out of range [{min_val}, {max_val}]"
                        })
                        continue
                
                parsed[norm_col] = parsed_value
                
            except ValueError:
                errors.append({
                    'row': row_num,
                    'column': norm_col,
                    'message': f"Row {row_num}: Invalid numeric value '{value}' for '{norm_col}'"
                })
        
        return parsed, errors
    
    def validate_file(self, file_path: Path) -> CSVValidationResult:
        """
        Validate a CSV file from disk.
        
        Args:
            file_path: Path to CSV file
            
        Returns:
            CSVValidationResult
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return CSVValidationResult(
                success=False,
                error_message=f"File not found: {file_path}"
            )
        
        if not file_path.suffix.lower() == '.csv':
            return CSVValidationResult(
                success=False,
                error_message="File must be a CSV file (.csv extension)"
            )
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return self.validate(f.read())
        except UnicodeDecodeError:
            # Try with latin-1 encoding
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    return self.validate(f.read())
            except Exception as e:
                return CSVValidationResult(
                    success=False,
                    error_message=f"Failed to read file: {str(e)}"
                )

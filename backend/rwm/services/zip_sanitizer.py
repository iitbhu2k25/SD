"""
ZIP Sanitizer Service
Step 1 & 2: Security validation and safe extraction of ZIP files

Security measures:
- File size limit (50MB compressed)
- File count limit (20 files max)
- Encrypted ZIP rejection
- Whitelist: only .shp, .shx, .dbf, .prj, .cpg allowed
- Path traversal protection (no .. paths)
- Zip bomb protection (check uncompressed size)
"""

import os
import zipfile
import tempfile
import uuid
import shutil
from pathlib import Path
from typing import Tuple, List, Optional
from dataclasses import dataclass


@dataclass
class SanitizerResult:
    """Result of ZIP sanitization process"""
    success: bool
    extracted_path: Optional[Path] = None
    error_message: Optional[str] = None
    files_extracted: List[str] = None
    
    def __post_init__(self):
        if self.files_extracted is None:
            self.files_extracted = []


class ZipSanitizer:
    """
    Secure ZIP file handler with aggressive sanitization.
    
    Usage:
        sanitizer = ZipSanitizer()
        result = sanitizer.sanitize(uploaded_file_path)
        if result.success:
            # Use result.extracted_path
        else:
            # Handle result.error_message
    """
    
    # Configuration
    MAX_COMPRESSED_SIZE_MB = 10  # Reduced from 50MB per user requirement
    MAX_UNCOMPRESSED_SIZE_MB = 100  # Zip bomb protection (10x max)
    MAX_FILE_COUNT = 20
    MAX_COMPRESSION_RATIO = 100  # Reject if uncompressed/compressed > 100
    
    # Allowed extensions (whitelist)
    ALLOWED_EXTENSIONS = {'.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx', '.qix', '.fix'}
    
    def __init__(self, temp_base_dir: Optional[Path] = None):
        """
        Initialize sanitizer with optional custom temp directory.
        
        Args:
            temp_base_dir: Base directory for temp extraction. 
                          Defaults to system temp + 'river_uploads'
        """
        if temp_base_dir:
            self.temp_base_dir = Path(temp_base_dir)
        else:
            self.temp_base_dir = Path(tempfile.gettempdir()) / 'river_uploads'
        
        self.temp_base_dir.mkdir(parents=True, exist_ok=True)
    
    def sanitize(self, zip_file_path: Path) -> SanitizerResult:
        """
        Main method: Validate and safely extract a ZIP file.
        
        Args:
            zip_file_path: Path to the uploaded ZIP file
            
        Returns:
            SanitizerResult with success status, extracted path or error
        """
        zip_file_path = Path(zip_file_path)
        
        # Step 1: Basic file checks
        if not zip_file_path.exists():
            return SanitizerResult(
                success=False,
                error_message="File not found"
            )
        
        if not zip_file_path.suffix.lower() == '.zip':
            return SanitizerResult(
                success=False,
                error_message="Only ZIP files are accepted"
            )
        
        # Check compressed size
        file_size_mb = zip_file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.MAX_COMPRESSED_SIZE_MB:
            return SanitizerResult(
                success=False,
                error_message=f"File exceeds {self.MAX_COMPRESSED_SIZE_MB}MB limit"
            )
        
        # Step 2: Open and validate ZIP structure
        try:
            return self._validate_and_extract(zip_file_path)
        except zipfile.BadZipFile:
            return SanitizerResult(
                success=False,
                error_message="Invalid or corrupted ZIP file"
            )
        except Exception as e:
            return SanitizerResult(
                success=False,
                error_message=f"Error processing ZIP: {str(e)}"
            )
    
    def _validate_and_extract(self, zip_file_path: Path) -> SanitizerResult:
        """Validate ZIP contents and extract safely."""
        
        with zipfile.ZipFile(zip_file_path, 'r') as zf:
            # Reject encrypted ZIPs
            for info in zf.infolist():
                if info.flag_bits & 0x1:  # Encrypted flag
                    return SanitizerResult(
                        success=False,
                        error_message="Encrypted ZIP files are not allowed"
                    )
            
            # Check file count
            if len(zf.namelist()) > self.MAX_FILE_COUNT:
                return SanitizerResult(
                    success=False,
                    error_message=f"ZIP contains too many files (max {self.MAX_FILE_COUNT})"
                )
            
            # Check total uncompressed size (zip bomb protection)
            total_uncompressed = sum(info.file_size for info in zf.infolist())
            total_uncompressed_mb = total_uncompressed / (1024 * 1024)
            
            if total_uncompressed_mb > self.MAX_UNCOMPRESSED_SIZE_MB:
                return SanitizerResult(
                    success=False,
                    error_message=f"Uncompressed size exceeds {self.MAX_UNCOMPRESSED_SIZE_MB}MB limit"
                )
            
            # Check compression ratio (another zip bomb indicator)
            compressed_size = zip_file_path.stat().st_size
            if compressed_size > 0:
                ratio = total_uncompressed / compressed_size
                if ratio > self.MAX_COMPRESSION_RATIO:
                    return SanitizerResult(
                        success=False,
                        error_message="Suspicious compression ratio detected"
                    )
            
            # Validate each file in ZIP
            validation_result = self._validate_zip_contents(zf)
            if not validation_result[0]:
                return SanitizerResult(
                    success=False,
                    error_message=validation_result[1]
                )
            
            # All checks passed - extract safely
            return self._safe_extract(zf, zip_file_path)
    
    def _validate_zip_contents(self, zf: zipfile.ZipFile) -> Tuple[bool, str]:
        """
        Validate each file in the ZIP.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        for name in zf.namelist():
            # Skip directories
            if name.endswith('/'):
                continue
            
            # Path traversal check
            if '..' in name or name.startswith('/') or name.startswith('\\'):
                return (False, f"Unsafe path detected: {name}")
            
            # Get the file extension
            ext = Path(name).suffix.lower()
            
            # Whitelist check
            if ext not in self.ALLOWED_EXTENSIONS:
                return (False, f"File type not allowed: {ext}. Only shapefile components are accepted.")
        
        return (True, "")
    
    def _safe_extract(self, zf: zipfile.ZipFile, original_path: Path) -> SanitizerResult:
        """
        Safely extract validated ZIP to isolated temp directory.
        
        Creates a unique directory for each extraction to prevent conflicts.
        """
        # Create unique extraction directory
        extraction_id = uuid.uuid4().hex[:12]
        extract_dir = self.temp_base_dir / extraction_id
        extract_dir.mkdir(parents=True, exist_ok=True)
        
        extracted_files = []
        
        try:
            for name in zf.namelist():
                # Skip directories
                if name.endswith('/'):
                    continue
                
                # Get just the filename (strip any directory structure in ZIP)
                safe_name = Path(name).name
                
                # Double-check extension
                if Path(safe_name).suffix.lower() not in self.ALLOWED_EXTENSIONS:
                    continue
                
                # Extract to flat directory (no subdirs)
                target_path = extract_dir / safe_name
                
                # Verify target is within extract_dir (final safety check)
                try:
                    target_path.resolve().relative_to(extract_dir.resolve())
                except ValueError:
                    # Path escape attempt
                    shutil.rmtree(extract_dir, ignore_errors=True)
                    return SanitizerResult(
                        success=False,
                        error_message="Path escape attempt detected"
                    )
                
                # Extract the file
                with zf.open(name) as source, open(target_path, 'wb') as target:
                    shutil.copyfileobj(source, target)
                
                extracted_files.append(safe_name)
            
            return SanitizerResult(
                success=True,
                extracted_path=extract_dir,
                files_extracted=extracted_files
            )
            
        except Exception as e:
            # Cleanup on failure
            shutil.rmtree(extract_dir, ignore_errors=True)
            return SanitizerResult(
                success=False,
                error_message=f"Extraction failed: {str(e)}"
            )
    
    def cleanup(self, extracted_path: Path) -> None:
        """
        Clean up extracted files after processing.
        
        Call this after successful processing to free disk space.
        """
        if extracted_path and extracted_path.exists():
            shutil.rmtree(extracted_path, ignore_errors=True)

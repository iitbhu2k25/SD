import os
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from app.core.config import settings

router = APIRouter()

@router.post("/upload-csv")
async def upload_csv(csv_file: UploadFile = File(...)):
    try:
        # Check file presence
        if not csv_file:
            return JSONResponse(
                content={
                    'error': 'No CSV file provided',
                    'message': 'Please upload a CSV file with key "csv_file"'
                },
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Validate extension
        if not csv_file.filename.lower().endswith('.csv'):
            return JSONResponse(
                content={
                    'error': 'Invalid file format',
                    'message': 'Only CSV files are allowed'
                },
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Get absolute path to media/temp
        base_dir = getattr(settings, "BASE_DIR", os.getcwd())
        media_dir = os.path.join(base_dir, "media")
        temp_dir = os.path.join(media_dir, "temp")
        os.makedirs(temp_dir, exist_ok=True)

        # Unique file name
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"csv_{timestamp}_{unique_id}.csv"
        file_path = os.path.join(temp_dir, filename)

        # Write file
        content = await csv_file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Check file exists
        if not os.path.exists(file_path):
            raise Exception("File not saved correctly to disk")

        # File size
        file_size = os.path.getsize(file_path)

        return JSONResponse(
            content={
                'success': True,
                'message': 'CSV file uploaded successfully',
                'data': {
                    'filename': filename,
                    'original_name': csv_file.filename,
                    'file_path': file_path,
                    'file_size': f"{file_size} bytes",
                    'uploaded_at': datetime.now().isoformat(),
                    'temp_directory': temp_dir
                }
            },
            status_code=status.HTTP_201_CREATED
        )

    except Exception as e:
        # print full error log
        print(f"[UPLOAD ERROR] {str(e)}")
        return JSONResponse(
            content={
                'error': 'Upload failed',
                'message': str(e)
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

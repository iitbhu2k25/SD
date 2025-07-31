@app.post("/generate_pdf")
async def trigger_pdf_generation(data: PDFRequestModel):
    task = generate_pdf_task.delay(data.dict())
    return {"job_id": task.id}

@app.get("/get_pdf/{job_id}")
async def get_pdf(job_id: str):
    result = AsyncResult(job_id, app=celery_app)
    if result.state == "SUCCESS":
        return FileResponse(result.result, media_type="application/pdf")
    elif result.state == "PENDING":
        return JSONResponse({"status": "Processing"}, status_code=202)
    elif result.state == "FAILURE":
        return JSONResponse({"status": "Failed"}, status_code=500)

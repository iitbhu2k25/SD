import { uploadClient } from "./uploadClient";

const CHUNK_SIZE = 1 * 1024 * 1024; // 5MB

export async function uploadFileInChunks(
  file: File,
  onProgress?: (percent: number) => void,
) {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append("file", chunk);

    await uploadClient.post("http://localhost:7000/api/tools/upload_raster_chunk", formData, {
      headers: {
        "Upload-Id": uploadId,
        "Chunk-Index": i,
        "Total-Chunks": totalChunks,
      },
      onUploadProgress: (event) => {
        if (!event.total) return;

        const chunkPercent =
          (event.loaded / event.total) * 100;

        const overallPercent =
          ((i + chunkPercent / 100) / totalChunks) * 100;

        onProgress?.(overallPercent);
      },
    });
  }

  // Merge chunks
  const resp=await uploadClient.post("http://localhost:7000/api/tools/upload/complete", {
    upload_id: uploadId,
    total_chunks: totalChunks,
    filename: file.name,
  });

  return resp;
}
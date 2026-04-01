import axios from "axios";
import { api, ApiError } from "@/services/api";
import { uploadClient } from "./uploadClient";

const CHUNK_SIZE = 1 * 1024 * 1024; // 5MB

export async function uploadFileInChunks(
  file: File,
  onProgress?: (percent: number) => void,
  onError?: (message: string) => void,
) {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append("file", chunk);

    await uploadClient.post("/tools/upload_data_chunk", formData, {
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
  try {
    const resp = await api.post("/tools/upload/complete", {
      body: {
         upload_id: uploadId,
      total_chunks: totalChunks,
      filename: file.name,
      }
    });
    return resp;
  } catch (err: any) {
    let message = "Upload failed";
    if (err instanceof ApiError) {
      message = err.message;
    }
    onError?.(message);
    throw err;
  }
}
"use client";

import { useState } from "react";
import { uploadFileInChunks } from "@/utils/chunkUpload";

export default function UploadPage() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files) return;

    const file = e.target.files[0];

    setUploading(true);

    try {
      await uploadFileInChunks(file, setProgress);
      alert("Upload successful!");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }

    setUploading(false);
    setProgress(0);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Upload Raster (Large File)</h2>

      <input type="file" onChange={handleUpload} />

      {uploading && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              width: "100%",
              height: 20,
              background: "#ddd",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "green",
              }}
            />
          </div>
          <p>{progress.toFixed(2)}%</p>
        </div>
      )}
    </div>
  );
}
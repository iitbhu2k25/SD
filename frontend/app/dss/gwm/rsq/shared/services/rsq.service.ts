"use client";

import type { GroundWaterGeoJSON, RsqView } from "../types/rsq.types";

export async function fetchRsqQuantification(view: RsqView, year: string, villageCodes: Array<string | number>): Promise<GroundWaterGeoJSON> {
  const baseUrl = view === "admin" ? process.env.NEXT_PUBLIC_FAST_URL : process.env.NEXT_PUBLIC_DJANGO_URL;

  const response = await fetch(`${baseUrl}/rsq/quantification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      year,
      vlcodes: villageCodes,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || "Failed to fetch RSQ data");
  }

  return response.json();
}

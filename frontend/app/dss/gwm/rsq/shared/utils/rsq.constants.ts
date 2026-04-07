"use client";

export const YEAR_OPTIONS = [
  "2016 - 17",
  "2019 - 20",
  "2021 - 22",
  "2022 - 23",
  "2023 - 24",
];

export const EXCLUDED_FIELDS = ["status", "color", "Year", "year"];

export const PRIORITY_FIELDS = ["village", "blockname", "village_co", "block_code"];

export const ADMIN_ALLOWED_DISTRICTS = [179, 152, 120, 174, 187];

export const RSQ_LEGEND = [
  { label: "Safe", color: "#27ae60", range: "<= 70%" },
  { label: "Semi-Critical", color: "#f39c12", range: "70-90%" },
  { label: "Critical", color: "#6006cd", range: "90-100%" },
  { label: "Over-Exploited", color: "#c0392b", range: "> 100%" },
  { label: "No Data", color: "#95a5a6", range: "N/A" },
];

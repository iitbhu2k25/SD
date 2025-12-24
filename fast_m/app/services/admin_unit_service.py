import csv
import os
from typing import List, Dict, Optional

# Mimic Django-style MEDIA_ROOT
BASE_DIR = os.getcwd()  # project root
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

CSV_PATH = os.path.join(
    MEDIA_ROOT,
    "gwa_data",
    "gwa_csv",
    "s_d_subd_v.csv"
)

def fetch_admin_units_from_villages(village_codes: List[int]) -> Dict:
    print("📁 MEDIA_ROOT:", MEDIA_ROOT)
    print("📄 CSV_PATH:", CSV_PATH)
    print("📄 CSV Exists:", os.path.exists(CSV_PATH))

    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"CSV not found at {CSV_PATH}")

    state_code: Optional[int] = None
    district_codes = set()
    subdistrict_codes = set()

    village_code_set = set(map(int, village_codes))
    print("🏘️ Incoming village codes:", village_code_set)

    with open(CSV_PATH, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)

        for row in reader:
            try:
                v_code = int(row["village_code"])
            except Exception:
                continue

            if v_code in village_code_set:
                print("✅ Match found:", v_code)
                state_code = int(row["state_code"])
                district_codes.add(int(row["district_code"]))
                subdistrict_codes.add(int(row["subdistrict_code"]))

    print("📤 RESULT:", state_code, district_codes, subdistrict_codes)

    return {
        "state_code": state_code,
        "district_codes": sorted(district_codes),
        "subdistrict_codes": sorted(subdistrict_codes),
    }

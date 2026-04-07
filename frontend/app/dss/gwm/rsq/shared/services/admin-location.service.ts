"use client";

export async function fetchAdminStates() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/state`);
  if (!response.ok) {
    throw new Error("Failed to fetch states");
  }
  const data = await response.json();
  return data.map((s: any) => ({
    id: String(s.state_code).padStart(2, "0"),
    name: s.state_name,
  }));
}

export async function fetchAdminDistricts(stateCode: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/basic/district/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state_code: stateCode }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch districts");
  }
  const data = await response.json();
  return data.map((d: any) => ({
    id: String(d.district_code).padStart(3, "0"),
    name: d.district_name,
    stateId: stateCode,
  }));
}

export async function fetchAdminBlocks(districtCodes: string[]) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/rsq/getblocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ districtcodes: districtCodes }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch blocks");
  }
  const data = await response.json();
  return data.map((b: any) => ({
    id: String(b.blockcode).padStart(4, "0"),
    name: b.block,
    districtCode: String(b.districtcode).padStart(3, "0"),
  }));
}

export async function fetchAdminVillages(blockCodes: string[]) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/rsq/getvillages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockcodes: blockCodes }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch villages");
  }
  const data = await response.json();
  return data.map((v: any) => ({
    id: String(v.vlcode).padStart(6, "0"),
    name: v.village,
    blockCode: String(v.blockcode).padStart(4, "0"),
  }));
}

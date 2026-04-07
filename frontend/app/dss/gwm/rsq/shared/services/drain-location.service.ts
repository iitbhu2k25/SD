"use client";

const geoServerBase = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/${process.env.NEXT_PUBLIC_FAST_WORKSPACE}/wfs`;

async function fetchGeoServerLayer(layerName: string, cqlFilter?: string) {
  const url = cqlFilter
    ? `${geoServerBase}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(cqlFilter)}`
    : `${geoServerBase}?service=WFS&version=1.0.0&request=GetFeature&typeName=myworkspace:${layerName}&outputFormat=application/json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${layerName}`);
  }
  const data = await response.json();
  return data.features || [];
}

export async function fetchDrainRivers() {
  const features = await fetchGeoServerLayer("Rivers");
  const rivers = features.map((feature: any) => ({
    id: feature.properties.River_Code,
    name: feature.properties.River_Name,
    code: feature.properties.River_Code,
  }));

  return rivers
    .filter((river: any, index: number, self: any[]) => index === self.findIndex((item) => item.code === river.code))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function fetchDrainStretches(riverCode: number) {
  const features = await fetchGeoServerLayer("Stretches", `River_Code=${riverCode}`);
  return features
    .map((feature: any) => ({
      id: feature.properties.Stretch_ID,
      name: `Stretch ${feature.properties.Stretch_ID}`,
      stretchId: feature.properties.Stretch_ID,
      riverCode: feature.properties.River_Code,
      riverName: feature.properties.River_Name,
    }))
    .sort((a: any, b: any) => a.stretchId - b.stretchId);
}

export async function fetchDrainItems(riverCode: number, stretchId: number) {
  const features = await fetchGeoServerLayer("Drain", `Stretch_ID=${stretchId} AND River_Code=${riverCode}`);
  return features
    .map((feature: any) => ({
      id: feature.properties.Drain_No,
      drainNo: feature.properties.Drain_No,
      riverCode: feature.properties.River_Code,
      stretchId: feature.properties.Stretch_ID,
    }))
    .sort((a: any, b: any) => a.drainNo - b.drainNo);
}

export async function fetchDrainCatchments(drainNo: number) {
  const features = await fetchGeoServerLayer("Catchment", `Drain_No=${drainNo}`);
  return features
    .map((feature: any) => ({
      id: feature.properties.OBJECTID,
      name: `Catchment ${feature.properties.GRIDCODE} (Drain ${feature.properties.Drain_No})`,
      objectId: feature.properties.OBJECTID,
      gridCode: feature.properties.GRIDCODE,
      drainNo: feature.properties.Drain_No,
    }))
    .sort((a: any, b: any) => a.gridCode - b.gridCode);
}

export async function fetchDrainVillages(drainNumbers: number[]) {
  const allVillages: any[] = [];

  for (const drainNo of drainNumbers) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_FAST_URL}/gwa/villagescatchment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Drain_No: drainNo }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch villages for drain ${drainNo}`);
    }

    const responseData = await response.json();
    const villages = responseData.villages || [];

    allVillages.push(
      ...villages.map((village: any) => ({
        id: village.village_code,
        name: village.name || `Village ${village.village_code}`,
        code: village.village_code,
        village_code: village.village_code,
        catchment_gridcode: drainNo,
      }))
    );
  }

  return allVillages
    .filter((village, index, self) => index === self.findIndex((item) => item.village_code === village.village_code))
    .sort((a, b) => a.name.localeCompare(b.name));
}

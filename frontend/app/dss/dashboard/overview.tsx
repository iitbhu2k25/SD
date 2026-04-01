// frontend/app/dss/varuna/dashboard/overview.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Droplets, Activity, Factory, MapPin, X, Info } from 'lucide-react';
import MapStory from './mapstory';
import { DashboardInfoContent, DashboardInfoKey, getDashboardInfo, InfoPopup } from './info';
import TrendAnalysis from './trend_analysis';

// --- INTERFACES & TYPES (Should be defined/exported from page.tsx or common file) ---

interface DrainRecord {
  id: number;
  location: string;
  stream?: string;
  ph: number;
  temp: number;
  ec_us_cm: number;
  tds_ppm: number;
  do_mg_l: number;
  turbidity: number;
  tss_mg_l: number;
  cod: number;
  bod_mg_l: number;
  ts_mg_l: number;
  chloride: number;
  nitrate: number;
  faecal_col: string | null;
  total_col: string | null;
  lat: number | null;
  lon: number | null;
  sampling_time?: string;
}

interface SewageStats {
  [key: string]: { feature_count: number } | undefined;
}

interface OverviewProps {
  // Data
  drainData: DrainRecord[];
  sewageStats: SewageStats | null;
  
  // State from page.tsx (Results of useMemo)
  acidicCount: number;
  lowDOCount: number;
  highBODCount: number;
  highCODCount: number;
  worstAcidicSite: DrainRecord | null;
  worstLowDOSite: DrainRecord | null;
  worstHighBODSite: DrainRecord | null;
  worstHighCODSite: DrainRecord | null;

  // Handlers/Helpers
  handleStatClick: (statType: string) => void;
  showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
  AnimatedCounter: React.FC<{ value: number; duration?: number }>;
  
  // NEW HANDLER PROPS for navigation
  setActiveTab: (tabId: string) => void; 
  setSelectedFilter: (filter: string | null) => void; 
}

// --- HELPER FUNCTIONS (Moved from page.tsx) ---

// Helper to extract faecal value (needed for calculateBacterialContamination)
const extractFaecalValue = (val: string | null): number => {
    if (!val || val === 'N/A') return 0;
    const parts = val.replace(/,/g, '').split(/–|-/).map(Number);
    return parts.length === 2 ? (parts[0] + parts[1]) / 2 : Number(parts[0]);
};

// Index Calculation Functions
const calculatePollutionLoadIndex = (data: DrainRecord): { score: number; level: string; location: string } => {
    const oxygenDeficit = Math.max(0, 8 - data.do_mg_l);
    const pollutionScore = (data.bod_mg_l * 0.4) + (data.cod * 0.003) + (oxygenDeficit * 10);
    let level: string;
    if (pollutionScore > 50) level = 'EXTREME';
    else if (pollutionScore > 30) level = 'HIGH';
    else if (pollutionScore > 15) level = 'MODERATE';
    else if (pollutionScore > 5) level = 'LOW';
    else level = 'MINIMAL';
    return { score: Math.round(pollutionScore * 10) / 10, level, location: data.location };
};

const calculateEutrophicationRisk = (data: DrainRecord): { score: number; level: string; location: string } => {
    const nitrateScore = typeof data.nitrate === 'number' ? Math.min(data.nitrate * 2, 10) : 0;
    const turbidityScore = Math.min(data.turbidity / 10, 10);
    const oxygenScore = data.do_mg_l < 4 ? 10 : data.do_mg_l < 6 ? 5 : 0;
    const eutrophicationScore = nitrateScore + turbidityScore + oxygenScore;
    let level: string;
    if (eutrophicationScore > 20) level = 'EXTREME';
    else if (eutrophicationScore > 15) level = 'HIGH';
    else if (eutrophicationScore > 10) level = 'MODERATE';
    else if (eutrophicationScore > 5) level = 'LOW';
    else level = 'MINIMAL';
    return { score: Math.round(eutrophicationScore * 10) / 10, level, location: data.location };
};

const calculateBacterialContamination = (data: DrainRecord): { score: number; level: string; location: string } => {
    let bacterialScore = 0;
    let level = 'UNKNOWN';
    
    // Logic extracted from page.tsx
    if (data.faecal_col && data.faecal_col !== 'N/A' && data.faecal_col.trim() !== '') {
      const maxValue = extractFaecalValue(data.faecal_col);
      bacterialScore = Math.log10(maxValue + 1);
      if (maxValue > 100000) level = 'EXTREME';
      else if (maxValue > 50000) level = 'HIGH';
      else if (maxValue > 10000) level = 'MODERATE';
      else if (maxValue > 1000) level = 'LOW';
      else level = 'MINIMAL';
    } else {
      if (data.bod_mg_l > 30) { bacterialScore = 5; level = 'HIGH (BOD-based)'; }
      else if (data.bod_mg_l > 15) { bacterialScore = 3; level = 'MODERATE (BOD-based)'; }
      else { bacterialScore = 1; level = 'LOW (BOD-based)'; }
    }
    return { score: Math.round(bacterialScore * 10) / 10, level, location: data.location };
};

const getWorstSites = (data: DrainRecord[]) => {
    if (data.length === 0) return null;
    const pollutionResults = data.map(calculatePollutionLoadIndex);
    const eutrophicationResults = data.map(calculateEutrophicationRisk);
    const bacterialResults = data.map(calculateBacterialContamination);
    const worstPollution = pollutionResults.sort((a, b) => b.score - a.score)[0];
    const worstEutrophication = eutrophicationResults.sort((a, b) => b.score - a.score)[0];
    const worstBacterial = bacterialResults.sort((a, b) => b.score - a.score)[0];
    return { pollution: worstPollution, eutrophication: worstEutrophication, bacterial: worstBacterial };
};

const getProcessedData = (data: DrainRecord[]) => data.map((entry, index) => ({
    label: entry.location || `Point-${index + 1}`,
    pH: entry.ph,
    DO: entry.do_mg_l,
    BOD: entry.bod_mg_l,
    COD: entry.cod,
    temp: entry.temp,
}));

// --- MAIN OVERVIEW COMPONENT ---

const Overview: React.FC<OverviewProps> = ({
  drainData,
  sewageStats,
  acidicCount,
  lowDOCount,
  highBODCount,
  highCODCount,
  worstAcidicSite,
  worstLowDOSite,
  worstHighBODSite,
  worstHighCODSite,
  handleStatClick,
  showNotification,
  AnimatedCounter,
  setActiveTab,
  setSelectedFilter,
}) => {
  const [selectedParameter, setSelectedParameter] = useState('DO');
  const [selectedInfo, setSelectedInfo] = useState<DashboardInfoContent | null>(null);
  const [selectedInfoAnchor, setSelectedInfoAnchor] = useState<HTMLElement | null>(null);
  const [selectedPotentialSource, setSelectedPotentialSource] = useState<{
    id: string;
    title: string;
    image: string;
    limit: string;
    observed: string;
    location: string;
    description: string;
    parameterFocus: string[];
    detailedInfo: string;
    bgColor: string;
  } | null>(null);
  
  // Re-calculate the indices used in the Critical Status block
  const worstSites = useMemo(() => getWorstSites(drainData), [drainData]);
  const sitesData = useMemo(() => getProcessedData(drainData), [drainData]);
  const potentialSourceData = useMemo(() => {
    const formatLoc = (d: DrainRecord) => (d.stream ? `${d.location} (${d.stream})` : d.location);

    const bodSorted = [...drainData]
      .filter(site => site.bod_mg_l !== null && site.bod_mg_l !== undefined)
      .sort((a, b) => b.bod_mg_l - a.bod_mg_l);
    const worstBOD = bodSorted.length > 0
      ? { location: formatLoc(bodSorted[0]), value: bodSorted[0].bod_mg_l.toFixed(2) }
      : { location: '—', value: '—' };

    const faecalSites = drainData.filter(d => {
      const val = d.faecal_col;
      if (!val || val === 'N/A') return false;
      const parsed = extractFaecalValue(val);
      return !isNaN(parsed) && parsed > 0;
    });
    const worstFaecal = faecalSites.sort(
      (a, b) => extractFaecalValue(b.faecal_col) - extractFaecalValue(a.faecal_col)
    )[0];
    const worstFaecalColiform = worstFaecal
      ? { location: formatLoc(worstFaecal), value: extractFaecalValue(worstFaecal.faecal_col).toFixed(0) }
      : { location: '—', value: '—' };

    const chemicalRiskCandidates = drainData.filter(d => d.cod !== null && d.tss_mg_l !== null);
    const highestChemicalSite = chemicalRiskCandidates.sort(
      (a, b) => (b.cod + b.tss_mg_l) - (a.cod + a.tss_mg_l)
    )[0];
    const worstChemicalRisk = highestChemicalSite
      ? { location: formatLoc(highestChemicalSite), cod: highestChemicalSite.cod.toFixed(2), tss: highestChemicalSite.tss_mg_l.toFixed(2) }
      : { location: '—', cod: '—', tss: '—' };

    const highTurbiditySite = drainData
      .filter(d => typeof d.turbidity === 'number')
      .sort((a, b) => b.turbidity - a.turbidity)[0];
    const worstTurbidity = highTurbiditySite
      ? { location: formatLoc(highTurbiditySite), value: highTurbiditySite.turbidity.toFixed(2) }
      : { location: '—', value: '—' };

    const salinityCandidates = drainData.filter(d => d.tds_ppm > 0 || d.ec_us_cm > 0);
    const highestSalinitySite = salinityCandidates.sort(
      (a, b) => (b.tds_ppm + b.ec_us_cm) - (a.tds_ppm + a.ec_us_cm)
    )[0];
    const worstSalinity = highestSalinitySite
      ? { location: formatLoc(highestSalinitySite), tds: highestSalinitySite.tds_ppm.toFixed(0), ec: highestSalinitySite.ec_us_cm.toFixed(0) }
      : { location: '—', tds: '—', ec: '—' };

    const nitrateSorted = [...drainData]
      .filter(site => site.nitrate !== null && site.nitrate !== undefined)
      .sort((a, b) => b.nitrate - a.nitrate);
    const worstNitrate = nitrateSorted.length > 0
      ? { location: formatLoc(nitrateSorted[0]), value: nitrateSorted[0].nitrate.toFixed(2) }
      : { location: '—', value: '—' };

    const algaeRiskCandidates = drainData.filter(d => d.nitrate !== null && d.bod_mg_l !== null);
    const highestAlgaeSite = algaeRiskCandidates.sort(
      (a, b) => (b.nitrate + b.bod_mg_l) - (a.nitrate + a.bod_mg_l)
    )[0];
    const worstAlgaeRisk = highestAlgaeSite
      ? { location: formatLoc(highestAlgaeSite), nitrate: highestAlgaeSite.nitrate.toFixed(2), bod: highestAlgaeSite.bod_mg_l.toFixed(2) }
      : { location: '—', nitrate: '—', bod: '—' };

    const industrialCandidates = drainData.filter(d => d.cod && d.tds_ppm);
    const highestIndustrial = industrialCandidates.sort(
      (a, b) => (b.cod + b.tds_ppm) - (a.cod + a.tds_ppm)
    )[0];
    const worstIndustrial = highestIndustrial
      ? { location: formatLoc(highestIndustrial), cod: highestIndustrial.cod.toFixed(1), tds: highestIndustrial.tds_ppm.toFixed(0) }
      : { location: '—', cod: '—', tds: '—' };

    const detergentRiskCandidates = drainData.filter(d => d.bod_mg_l !== null && d.cod !== null);
    const worstDetergentSite = detergentRiskCandidates.sort(
      (a, b) => (b.bod_mg_l + b.cod) - (a.bod_mg_l + a.cod)
    )[0];
    const worstDetergentRisk = worstDetergentSite
      ? { location: formatLoc(worstDetergentSite), bod: worstDetergentSite.bod_mg_l.toFixed(1), cod: worstDetergentSite.cod.toFixed(1) }
      : { location: '—', bod: '—', cod: '—' };

    const landDumpingCandidates = drainData.filter(
      d => d.tss_mg_l > 0 || d.turbidity > 0 || d.ts_mg_l > 0
    );
    const worstDumpingSite = landDumpingCandidates.sort(
      (a, b) => (b.tss_mg_l + b.turbidity + b.ts_mg_l) - (a.tss_mg_l + a.turbidity + a.ts_mg_l)
    )[0];
    const worstLandDumping = worstDumpingSite
      ? { location: formatLoc(worstDumpingSite), tss: worstDumpingSite.tss_mg_l.toFixed(0), turbidity: worstDumpingSite.turbidity.toFixed(0), ts: worstDumpingSite.ts_mg_l.toFixed(0) }
      : { location: '—', tss: '—', turbidity: '—', ts: '—' };

    return {
      worstBOD,
      worstFaecalColiform,
      worstChemicalRisk,
      worstTurbidity,
      worstSalinity,
      worstNitrate,
      worstAlgaeRisk,
      worstIndustrial,
      worstDetergentRisk,
      worstLandDumping,
    };
  }, [drainData]);

  const potentialPollutionCards = [
    {
      id: 'organic-pollution',
      title: 'Organic Pollution',
      image: 'https://dialogue.earth/content/uploads/2015/12/India-Ganga-pollution-scaled.jpg',
      limit: 'BOD ≤ 3.00 mg/L',
      observed: `BOD: ${potentialSourceData.worstBOD.value} mg/L`,
      location: potentialSourceData.worstBOD.location,
      description: 'High organic load from untreated sewage. Promotes microbial growth, reduces dissolved oxygen.',
      parameterFocus: ['Primary Parameter: BOD', 'Supporting Context: DO decline and organic waste inflow'],
      detailedInfo: 'Organic pollution is caused by entry of biodegradable materials such as untreated sewage, food waste, animal excreta, plant residues, and related decomposable matter into river water. Microorganisms consume dissolved oxygen while decomposing this material, causing BOD to rise and oxygen availability for fish and aquatic organisms to decline. In stressed river stretches this may result in foul odor, blackish water, sludge deposition, and ecological deterioration, indicating strong domestic wastewater pressure.',
      bgColor: 'from-green-100 to-white',
    },
    {
      id: 'pathogen-risk',
      title: 'Pathogen Risk',
      image: 'https://t4.ftcdn.net/jpg/08/42/76/07/360_F_842760775_8ccQDE8g6eKeuVy2jHffnZxU13MZrpEG.jpg',
      limit: 'Faecal Coliform ≤ 500 MPN',
      observed: `Faecal Coliform: ${potentialSourceData.worstFaecalColiform.value} MPN`,
      location: potentialSourceData.worstFaecalColiform.location,
      description: 'High faecal contamination from untreated sewage poses serious health hazards.',
      parameterFocus: ['Primary Parameter: Faecal Coliform', 'Supporting Context: sanitation leakage, wastewater intrusion'],
      detailedInfo: 'Pathogen risk reflects contamination by disease-causing microorganisms including bacteria, viruses, protozoa, and parasites. Typical pathways include untreated sewage discharge, open defecation, faecal waste runoff, and poorly managed sanitation systems. High pathogen levels indicate serious public-health concern for bathing, washing, ritual use, and downstream abstraction. Elevated faecal coliform values are a strong signal of sewage and faecal contamination influence.',
      bgColor: 'from-red-100 to-white',
    },
    {
      id: 'chemical-pollution',
      title: 'Chemical Pollution',
      image: 'https://static.vecteezy.com/system/resources/thumbnails/057/512/892/small_2x/close-up-of-a-barrel-with-green-leaking-toxic-waste-standing-in-nature-photo.jpg',
      limit: 'COD ≤ 30 | TSS ≤ 100',
      observed: `COD: ${potentialSourceData.worstChemicalRisk.cod} | TSS: ${potentialSourceData.worstChemicalRisk.tss}`,
      location: potentialSourceData.worstChemicalRisk.location,
      description: 'Chemical residues, fertilizers, oils alter water chemistry and harm aquatic life.',
      parameterFocus: ['Primary Parameter: COD', 'Supporting Parameters: TSS and toxic compound loading'],
      detailedInfo: 'Chemical pollution indicates harmful or undesirable chemicals in river water from industrial effluents, urban runoff, domestic wastewater, and commercial discharge. Pollutants may include acids, alkalis, solvents, detergents, pesticides, heavy metals, and nutrients. These alter water chemistry, increase COD, stress aquatic metabolism, and reduce suitability for domestic or agricultural use. In urban stretches, persistent chemical loading may remain in water, sediments, and food chains for long periods.',
      bgColor: 'from-yellow-100 to-white',
    },
    {
      id: 'turbidity',
      title: 'Turbidity',
      image: 'https://ecoreportcard.org/site/assets/files/2218/chesterville_branch_turbidity.700x0.jpg',
      limit: 'Safe Limit: ≤ 25 NTU',
      observed: `Turbidity: ${potentialSourceData.worstTurbidity.value} NTU`,
      location: potentialSourceData.worstTurbidity.location,
      description: 'Suspended solids reduce light penetration and disrupt photosynthesis.',
      parameterFocus: ['Primary Parameter: Turbidity (NTU)', 'Supporting Context: suspended solids and runoff pulses'],
      detailedInfo: 'Turbidity reflects cloudiness and loss of clarity due to suspended particles such as silt, clay, organic matter, sewage solids, and algae. High turbidity often increases during runoff events, bank erosion, drain discharge, and unmanaged waste inflow. Excess solids reduce light penetration, limit photosynthesis, interfere with fish respiration, and disturb habitat quality. Persistently high turbidity in polluted reaches also indicates poor control of solid or liquid waste entry.',
      bgColor: 'from-gray-100 to-white',
    },
    {
      id: 'salinity',
      title: 'Salinity',
      image: 'https://www.waterquality.gov.au/sites/default/files/images/salt.jpg',
      limit: 'TDS ≤ 1000 | EC ≤ 2250',
      observed: `TDS: ${potentialSourceData.worstSalinity.tds} | EC: ${potentialSourceData.worstSalinity.ec}`,
      location: potentialSourceData.worstSalinity.location,
      description: 'Excess salts from sewage affect water quality and aquatic ecosystems.',
      parameterFocus: ['Primary Parameters: TDS and EC', 'Supporting Context: dilution loss and wastewater accumulation'],
      detailedInfo: 'Salinity indicates concentration of dissolved salts, commonly represented through TDS and electrical conductivity (EC). Salinity may increase due to sewage discharge, industrial effluents, agricultural return flows, detergent-rich wastewater, and low-flow dilution conditions. When salt levels exceed acceptable limits, river water becomes less suitable for irrigation, domestic use, and ecological functioning. In freshwater systems, sustained salinity rise is an indicator of accumulated dissolved pollution load.',
      bgColor: 'from-blue-100 to-white',
    },
    {
      id: 'nitrates',
      title: 'Nitrates',
      image: 'https://nexteel.in/wp-content/uploads/2025/04/Nitrate-Pollution-in-water-1024x576.jpg',
      limit: 'Safe Limit: ≤ 2.00 mg/L',
      observed: `Nitrate: ${potentialSourceData.worstNitrate.value} mg/L`,
      location: potentialSourceData.worstNitrate.location,
      description: 'Nutrient overload from agriculture promotes algal blooms.',
      parameterFocus: ['Primary Parameter: Nitrate (NO3-N)', 'Supporting Context: nutrient enrichment and eutrophication'],
      detailedInfo: 'Nitrates are highly soluble nitrogen compounds entering rivers via fertilizer runoff, sewage leakage, decomposing organic matter, and wastewater discharge. While nitrate is a plant nutrient, excessive concentration indicates nutrient enrichment and declining water quality. High nitrate levels stimulate algae and aquatic weed growth, disrupt nutrient balance, and accelerate eutrophication. In human-use stretches, excess nitrate also raises downstream water-supply and groundwater-related concerns.',
      bgColor: 'from-lime-100 to-white',
    },
    {
      id: 'algae-growth',
      title: 'Algae Growth',
      image: 'https://assets.telegraphindia.com/telegraph/5jamriver2.jpg',
      limit: 'Nitrate ≤ 2 | BOD ≤ 3',
      observed: `Nitrate: ${potentialSourceData.worstAlgaeRisk.nitrate} | BOD: ${potentialSourceData.worstAlgaeRisk.bod}`,
      location: potentialSourceData.worstAlgaeRisk.location,
      description: 'Excess nutrients cause oxygen depletion and aquatic death.',
      parameterFocus: ['Primary Parameters: Nitrate and BOD', 'Supporting Context: nutrient-rich stagnant stretches'],
      detailedInfo: 'Algae growth is a visible response to nutrient stress, especially where nitrates/phosphates, warm temperature, sunlight, and slow-moving water combine. Although some algae is natural, abnormal or dense growth indicates ecological imbalance and often signals sewage discharge, agricultural runoff, or stagnant polluted conditions. Dense blooms reduce aesthetics, may block light transfer, and can lower dissolved oxygen when algae die and decompose, further degrading river health.',
      bgColor: 'from-emerald-100 to-white',
    },
    {
      id: 'industrial-contaminants',
      title: 'Industrial Contaminants',
      image: 'https://images.assettype.com/english-sentinelassam/import/wp-content/uploads/2019/01/industrial-wastewater.jpg',
      limit: 'COD ≤ 250 | TDS ≤ 2100',
      observed: `COD: ${potentialSourceData.worstIndustrial.cod} | TDS: ${potentialSourceData.worstIndustrial.tds}`,
      location: potentialSourceData.worstIndustrial.location,
      description: 'Toxic discharge bioaccumulates in fish, poses long-term health risks.',
      parameterFocus: ['Primary Parameters: COD, TDS, and toxic indicators', 'Supporting Context: manufacturing/service discharge'],
      detailedInfo: 'Industrial contaminants include pollutants released from manufacturing, processing, workshop, and service activities into rivers directly or via connected drains. They may include oils, greases, solvents, metals, dyes, salts, and high-strength wastewater. Compared with typical domestic pollution, these contaminants are often more toxic and persistent, affecting aquatic ecosystems even at lower concentrations. Their presence may indicate inadequate effluent treatment and weak pollution control in the catchment.',
      bgColor: 'from-indigo-100 to-white',
    },
    {
      id: 'detergents',
      title: 'Detergents',
      image: 'https://asset.library.wisc.edu/1711.dl/ER5CSR223WOWA8F/M/h1380-2ce93.jpg',
      limit: 'BOD ≤ 3 | COD ≤ 250',
      observed: `BOD: ${potentialSourceData.worstDetergentRisk.bod} | COD: ${potentialSourceData.worstDetergentRisk.cod}`,
      location: potentialSourceData.worstDetergentRisk.location,
      description: 'Greywater with detergents promotes algal growth and eutrophication.',
      parameterFocus: ['Primary Parameters: COD, BOD, surfactant-related stress', 'Supporting Context: phosphate-bearing greywater'],
      detailedInfo: 'Detergent pollution mainly enters rivers through household greywater, laundry discharge, washing activity near drains, and urban wastewater. Detergents contain surfactants, builders, phosphates, and additives that can disturb natural water properties and oxygen exchange between air and water. Phosphate-bearing detergents also contribute to nutrient enrichment and algae growth. Repeated detergent loading can create chronic chemical stress and reduce river self-cleansing capacity.',
      bgColor: 'from-purple-100 to-white',
    },
    {
      id: 'land-dumping',
      title: 'Land Dumping',
      image: 'https://dialogue.earth/content/uploads/2021/12/2CMW2JH-1-scaled.jpg',
      limit: 'TSS ≤ 100 | Turb ≤ 25 | TS ≤ 2000',
      observed: `TSS: ${potentialSourceData.worstLandDumping.tss} | Turb: ${potentialSourceData.worstLandDumping.turbidity} | TS: ${potentialSourceData.worstLandDumping.ts}`,
      location: potentialSourceData.worstLandDumping.location,
      description: 'Runoff and solid waste degrade river clarity and water quality.',
      parameterFocus: ['Primary Parameters: TSS, Turbidity, TS', 'Supporting Context: leachate, debris, and floodplain dumping'],
      detailedInfo: 'Land dumping refers to disposal of municipal solid waste, construction debris, plastics, and other discarded materials on riverbanks, floodplains, or low-lying connected zones. During rainfall and flooding, dumped material releases fine particles, leachate, and decomposing matter into river systems. This drives multiple pollution pathways including organic loading, turbidity increase, nutrient release, plastic contamination, and chemical leakage. It also degrades corridor quality and creates long-term contamination hotspots.',
      bgColor: 'from-rose-100 to-white',
    },
  ];

  const openInfo = (key: DashboardInfoKey, event?: React.MouseEvent<HTMLElement>) => {
    setSelectedInfoAnchor(event ? event.currentTarget : null);
    setSelectedInfo(getDashboardInfo(key));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
      
      {/* Story Map Section */}
      <div className="col-span-full">
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/20 animate-fadeIn bg-white">
          <MapStory showNotification={showNotification} onInfoClick={(event) => openInfo('story-map', event)} />
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 col-span-full border border-white/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Key Performance Indicators
            </h2>
            <button
              onClick={(event) => openInfo('kpi-overview', event)}
              className="w-7 h-7 rounded-full bg-white border border-gray-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center"
              aria-label="KPI info"
            >
              <Info size={14} />
            </button>
          </div>
          <div className="text-xs text-gray-600 leading-relaxed">
              Click on Cards to see in map
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          
          {/* 1. Acidic pH Site (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('acidic');
            }}
            className="relative group p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-red-600 mb-2"><AnimatedCounter value={acidicCount} /></div>
            <div className="text-sm font-semibold text-red-800 mb-1">Acidic pH Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              pH &lt; 6.0 • Most acidic observed at <strong>{worstAcidicSite?.location || '—'}</strong>, Value: <strong>{worstAcidicSite?.ph.toFixed(1) || '—'}</strong>
            </div>
            <div className="mt-3 w-full bg-red-200 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(acidicCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 2. Low DO Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('lowDO');
            }}
            className="relative group p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-blue-600 mb-2"><AnimatedCounter value={lowDOCount} /></div>
            <div className="text-sm font-semibold text-orange-800 mb-1">Low DO Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              DO &lt; 2 mg/L • Lowest DO observed at <strong>{worstLowDOSite?.location || '—'}</strong>, Value: <strong>{worstLowDOSite?.do_mg_l.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(lowDOCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 3. High BOD Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('highBOD');
            }}
            className="relative group p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-emerald-600 mb-2"><AnimatedCounter value={highBODCount} /></div>
            <div className="text-sm font-semibold text-rose-800 mb-1">High BOD Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              BOD &gt; 30 mg/L • Highest BOD observed at <strong>{worstHighBODSite?.location || '—'}</strong>, Value: <strong>{worstHighBODSite?.bod_mg_l.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-emerald-200 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(highBODCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>

          {/* 4. High COD Sites (Navigation added) */}
          <div 
            onClick={() => {
              setActiveTab('water-quality');
              setSelectedFilter('highCOD');
            }}
            className="relative group p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
          >
            <div className="text-3xl font-bold text-purple-600 mb-2"><AnimatedCounter value={highCODCount} /></div>
            <div className="text-sm font-semibold text-purple-800 mb-1">High COD Sites</div>
            <div className="text-xs text-gray-600 leading-relaxed">
              COD &gt; 100 mg/L • Highest COD observed at <strong>{worstHighCODSite?.location || '—'}</strong>, Value: <strong>{worstHighCODSite?.cod.toFixed(1) || '—'} mg/L</strong>
            </div>
            <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(highCODCount / drainData.length) * 100 || 0}%` }}></div>
            </div>
          </div>
          
          {/* 5. Sewage Infrastructure Section (Navigation added) */}
          <div 
            onClick={() => setActiveTab('sewage-infrastructure')}
            className="relative group col-span-1 lg:col-span-2 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 hover:shadow-xl transition-all duration-300 transform hover:scale-102 flex flex-col justify-center cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <h3 className="text-lg font-bold text-orange-800">Sewage Infrastructure</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/60 p-2 rounded-lg border border-orange-100 text-center">
                <div className="text-xs text-gray-600">Partial Tapped Drain</div>
                <div className="text-xl font-bold text-orange-600">
                  <AnimatedCounter value={sewageStats?.['partial_tapped_drain']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-green-100 text-center">
                <div className="text-xs text-gray-600">Tapped Drain</div>
                <div className="text-xl font-bold text-green-600">
                  <AnimatedCounter value={sewageStats?.['tapped']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-red-100 text-center">
                <div className="text-xs text-gray-600">Untapped Drain</div>
                <div className="text-xl font-bold text-red-600">
                  <AnimatedCounter value={sewageStats?.['untapped_drain']?.feature_count || 0} />
                </div>
              </div>
              <div className="bg-white/60 p-2 rounded-lg border border-blue-100 text-center">
                <div className="text-xs text-gray-600">STP (Sewage Treatment Plant)</div>
                <div className="text-xl font-bold text-blue-600">
                  <AnimatedCounter value={sewageStats?.['STP']?.feature_count || 0} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Status - Calculated Indices (Left Side) */}
      <div className="col-span-1 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20 h-full">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Critical Status - Calculated Indices
          </h3>
          <button
            onClick={(event) => openInfo('critical-indices', event)}
            className="w-7 h-7 rounded-full bg-white border border-gray-200 text-red-700 hover:bg-red-50 flex items-center justify-center"
            aria-label="Critical status info"
          >
            <Info size={14} />
          </button>
        </div>
        <div className="space-y-4">
          {worstSites ? (
            <>
              {/* Pollution Load Index */}
              <div className="relative flex flex-col p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.pollution.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.pollution.level === 'EXTREME' ? 'bg-red-600 pulse-glow' : 'bg-orange-500'
                  }`}>
                    {worstSites.pollution.level}
                  </span>
                </div>
                <span className="text-sm text-red-600 font-medium">
                  Pollution Load Index: {worstSites.pollution.score}
                </span>
              </div>
              {/* Eutrophication Risk */}
              <div className="relative flex flex-col p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.eutrophication.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.eutrophication.level === 'EXTREME' ? 'bg-red-600 pulse-glow' : 'bg-green-500'
                  }`}>
                    {worstSites.eutrophication.level}
                  </span>
                </div>
                <span className="text-sm text-green-600 font-medium">
                  Eutrophication Risk: {worstSites.eutrophication.score}
                </span>
              </div>
              {/* Bacterial Contamination Level */}
              <div className="relative flex flex-col p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm block">{worstSites.bacterial.location}</span>
                  <span className={`text-white px-2 py-1 rounded-full text-xs font-bold ${
                    worstSites.bacterial.level.includes('EXTREME') ? 'bg-red-600 pulse-glow' : 'bg-purple-500'
                  }`}>
                    {worstSites.bacterial.level.split(' ')[0]}
                  </span>
                </div>
                <span className="text-sm text-purple-600 font-medium">
                  Bacterial Level: {worstSites.bacterial.score}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>Loading data...</p>
            </div>
          )}
        </div>
        
        {/* Summary Statistics */}
        <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-red-600">
                {drainData.filter(d => calculatePollutionLoadIndex(d).level === 'HIGH').length}
              </div>
              <div className="text-[10px] text-gray-600">High Pollution</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {drainData.filter(d => calculateEutrophicationRisk(d).level === 'HIGH').length}
              </div>
              <div className="text-[10px] text-gray-600">Eutrophication</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">
                {drainData.filter(d => calculateBacterialContamination(d).level.includes('HIGH')).length}
              </div>
              <div className="text-[10px] text-gray-600">Bacterial</div>
            </div>
          </div>
        </div>
      </div>

      {/* Water Quality Analysis (Right Side - Expanded) */}
      <div className="col-span-1 lg:col-span-2 bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20 h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Water Quality Analysis
            </h2>
            <button
              onClick={(event) => openInfo('water-quality-analysis', event)}
              className="w-7 h-7 rounded-full bg-white border border-gray-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center"
              aria-label="Water quality analysis info"
            >
              <Info size={14} />
            </button>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <select
              value={selectedParameter}
              onChange={(e) => setSelectedParameter(e.target.value)}
              className="w-full sm:w-auto border-2 border-gray-200 rounded-xl px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="BOD">BOD (mg/l)</option>
              <option value="COD">COD (mg/l)</option>
              <option value="DO">DO (mg/l)</option>
              <option value="pH">pH</option>
              <option value="temp">Temperature (°C)</option>
            </select>
          </div>
        </div>

        <div className="mb-8 h-[400px]"> {/* Fixed height to fill space */}
          <h3 className="font-semibold mb-4 text-lg">Temporal Variation - {selectedParameter}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={sitesData}
              margin={{ top: 5, right: 30, left: 20, bottom: 50 }} 
            >
              <defs>
                <linearGradient id="parameterGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={false}
                axisLine={true}
                height={30}
                label={{ 
                  value: 'Monitoring Location (Hover for details)', 
                  position: 'insideBottom', 
                  dy: 10, 
                  fill: '#6B7280', 
                  fontSize: 12 
                }}
              />
              <YAxis 
                dataKey={selectedParameter}
                label={{ value: selectedParameter, angle: -90, position: 'insideLeft', dx: -10, fill: '#4B5563' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey={selectedParameter}
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#parameterGradient)"
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Analysis (Moved from sidebar menu into Overview) */}
      <div className="col-span-full">
        <TrendAnalysis />
      </div>

      {/* Potential Pollution Sources (Moved from Pollution Sources section) */}
      <div className="col-span-full bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 pb-12 border border-white/20">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Potential Pollution Sources
          </h2>
          <button
            onClick={(event) => openInfo('potential-pollution-sources', event)}
            className="w-7 h-7 rounded-full bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center"
            aria-label="Potential pollution sources info"
          >
            <Info size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {potentialPollutionCards.map((item, index) => (
            <div
              key={index}
              className={`relative w-full h-[500px] flex flex-col justify-between rounded-2xl px-5 py-5 bg-gradient-to-br ${item.bgColor} shadow-md border border-gray-200 transform hover:scale-105 hover:shadow-2xl transition-transform duration-300 ease-in-out cursor-pointer`}
              onClick={() => setSelectedPotentialSource(item)}
            >
              <div className="-mx-5 -mt-5 mb-4">
                <img src={item.image} alt={item.title} className="w-full h-[240px] object-cover rounded-t-2xl" />
              </div>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-lg font-bold text-gray-800 mb-3">{item.title}</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Safe Limits</span>
                      <span className="text-xs font-medium text-gray-800 break-words leading-tight">{item.limit}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Highest Observed</span>
                      <span className="text-xs font-bold text-red-600 break-words leading-tight">{item.observed}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Observed At</span>
                      <span className="text-xs font-medium text-gray-700 bg-white/60 p-1.5 rounded border border-gray-200 break-words leading-tight">
                        {item.location || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-4 pt-4 border-t border-gray-200/50 italic">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      

      {selectedPotentialSource && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedPotentialSource(null)}
        >
          <div
            className={`w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-gradient-to-br ${selectedPotentialSource.bgColor} rounded-2xl shadow-2xl border border-white/50`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={selectedPotentialSource.image}
                alt={selectedPotentialSource.title}
                className="w-full h-64 object-cover"
              />
              <button
                className="absolute top-3 right-3 bg-white/90 hover:bg-white text-gray-800 p-2 rounded-full shadow"
                onClick={() => setSelectedPotentialSource(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <h3 className="text-2xl font-bold text-gray-800">{selectedPotentialSource.title}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/80 rounded-lg border border-gray-200 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Safe Limits</div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">{selectedPotentialSource.limit}</div>
                </div>
                <div className="bg-white/80 rounded-lg border border-gray-200 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Highest Observed</div>
                  <div className="text-sm font-bold text-red-600 mt-1">{selectedPotentialSource.observed}</div>
                </div>
              </div>

              <div className="bg-white/80 rounded-lg border border-gray-200 p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">Observed At</div>
                <div className="text-sm font-semibold text-gray-800 mt-1">{selectedPotentialSource.location || 'N/A'}</div>
              </div>

              <div className="bg-white/85 rounded-lg border border-gray-200 p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-2">Parameter Details</div>
                <ul className="space-y-1">
                  {selectedPotentialSource.parameterFocus.map((line, idx) => (
                    <li key={idx} className="text-sm text-gray-700 leading-relaxed">• {line}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/85 rounded-lg border border-gray-200 p-3">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-2">Detailed Interpretation</div>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedPotentialSource.detailedInfo}</p>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed">{selectedPotentialSource.description}</p>
            </div>
          </div>
        </div>
      )}

      <InfoPopup
        content={selectedInfo}
        anchor={selectedInfoAnchor}
        onClose={() => {
          setSelectedInfo(null);
          setSelectedInfoAnchor(null);
        }}
      />
    </div>
  );
};

export default Overview;


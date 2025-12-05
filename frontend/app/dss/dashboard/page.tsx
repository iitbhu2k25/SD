'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { ChevronLeft, ChevronRight, Droplets, Activity, Factory } from 'lucide-react';
import { usePathname } from 'next/navigation'; 
import VarunaMap from './varunamap'; 
import SewageInfrastructure from './sewage';
import MapStory from './mapstory';
import WQIDashboard from './water_quality'; 
import PollutionSources from './pollution_sources';
import VarunaGallery from './gallery';
import SystemDynamics from './SystemDynamics'; 
import Overview from './overview';
// Interfaces
interface Alert {
  type: string;
  severity: 'High' | 'Critical';
  message: string;
  location: string;
  value?: number;
  threshold?: number;
}
interface TabButtonProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: (id: string) => void;
}
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

interface DynamicIntervention {
  id: string;
  location: string;
  stream?: string;
  problem: string;
  action: string;
  cost: number; // in Crores
  impact: number; // 0-100 score
  priority: 'Critical' | 'High' | 'Medium';
  type: 'Aeration' | 'STP' | 'Dredging' | 'Chemical';
}

// Sample Data
const spatialData = [
  { station: 'Mahadev Mandir, Prayagraj', district: 'Prayagraj', DO: 2.8, BOD: 5.16, COD: 31.1, status: 'Moderate' },
  { station: 'Mobi Deenpur Bridge, Bhadohi', district: 'Bhadohi', DO: 5.8, BOD: 5.6, COD: 18.7, status: 'Good' },
  { station: 'Kusha ghat-Godma Bridge', district: 'Bhadohi', DO: 5.6, BOD: 2.87, COD: 19.1, status: 'Good' },
  { station: 'Varuna U/s of Dhaurahra Drain', district: 'Bhadohi', DO: 2.6, BOD: 1.05, COD: 16.58, status: 'Excellent' },
  { station: 'Varuna D/s of Nai Bazar Drain', district: 'Bhadohi', DO: 2.6, BOD: 3.84, COD: 22.14, status: 'Moderate' },
  { station: 'Varuna at Rameswaram Mandir', district: 'Varanasi', DO: 6.0, BOD: 1.23, COD: 14.22, status: 'Good' },
  { station: 'Varuna at Koirajpur Bridge', district: 'Varanasi', DO: 6.2, BOD: 3.62, COD: 13.47, status: 'Good' },
  { station: 'Varuna at Pishaura Bridge', district: 'Varanasi', DO: 7.2, BOD: 1.23, COD: 17.14, status: 'Good' },
  { station: 'Varuna at Kutchehari Bridge', district: 'Varanasi', DO: 4.1, BOD: 6.62, COD: 30.24, status: 'Poor' }
];
const industrialData = [
  { type: 'Textile/Yarn', count: 54, location: 'Bhadohi (50)', status: 'High Impact' },
  { type: 'Saree Printing', count: 33, location: 'Varanasi (33)', status: 'High Impact' },
  { type: 'Metal Surface Treatment', count: 23, location: 'Varanasi (23)', status: 'Medium Impact' },
  { type: 'Small-scale Industries', count: 867, location: 'Varanasi', status: 'Critical Impact', discharge: '9.13 MLD' },
  { type: 'Slaughterhouses', count: 3, location: 'Various', status: 'Low Impact' },
  { type: 'Food & Beverage', count: 3, location: 'Various', status: 'Low Impact' }
];

const statisticsDetailData = {
  riverLength: {
    title: '🌊 River Length Details',
    subtitle: 'Comprehensive river network analysis',
    data: [
      { segment: 'Main River Channel', length: '105 km', condition: 'Moderate', tributaries: 3 },
      { segment: 'Major Tributaries', length: '65 km', condition: 'Variable', tributaries: 8 },
      { segment: 'Minor Tributaries', length: '30 km', condition: 'Poor', tributaries: 15 },
      { segment: 'Seasonal Streams', length: '20 km', condition: 'Intermittent', tributaries: 12 }
    ],
    summary: {
      total: '220 km total network',
      monitored: '200 km actively monitored',
      critical: '45 km critically polluted'
    }
  },
  districts: {
    title: '📍 District Coverage Details',
    subtitle: 'Administrative and jurisdictional information',
    data: [
      { district: 'Prayagraj', population: '6.1 million', riverLength: '25 km', stations: 1, industries: 15, status: 'Moderate Impact', keyIssues: 'Urban runoff, religious activities' },
      { district: 'Bhadohi', population: '1.7 million', riverLength: '85 km', stations: 4, industries: 54, status: 'High Impact', keyIssues: 'Textile industries, carpet weaving' },
      { district: 'Varanasi', population: '4.2 million', riverLength: '90 km', stations: 7, industries: 923, status: 'Critical Impact', keyIssues: 'Dense industrial zones, urban sewage' }
    ],
    summary: {
      totalPopulation: '12 million people',
      totalIndustries: '992 industries',
      adminComplexity: '3-tier governance system'
    }
  },
  monitoringStations: {
    title: '🔬 Monitoring Stations Network',
    subtitle: 'Real-time water quality monitoring infrastructure',
    data: [
      { id: 'VS-01', name: 'Mahadev Mandir', district: 'Prayagraj', status: 'Active', parameters: 8, condition: 'Moderate' },
      { id: 'VS-02', name: 'Mobi Deenpur Bridge', district: 'Bhadohi', status: 'Active', parameters: 8, condition: 'Good' },
      { id: 'VS-03', name: 'Kusha Ghat-Godma Bridge', district: 'Bhadohi', status: 'Active', parameters: 8, condition: 'Good' },
      { id: 'VS-04', name: 'Varuna U/s Dhaurahra', district: 'Bhadohi', status: 'Active', parameters: 8, condition: 'Excellent' },
      { id: 'VS-05', name: 'Varuna D/s Nai Bazar', district: 'Bhadohi', status: 'Active', parameters: 8, condition: 'Moderate' },
      { id: 'VS-06', name: 'Rameswaram Mandir', district: 'Varanasi', status: 'Active', parameters: 8, condition: 'Good' },
      { id: 'VS-07', name: 'Koirajpur Bridge', district: 'Varanasi', status: 'Active', parameters: 8, condition: 'Good' },
      { id: 'VS-08', name: 'Pishaura Bridge', district: 'Varanasi', status: 'Active', parameters: 8, condition: 'Good' },
      { id: 'VS-09', name: 'Kutchehari Bridge', district: 'Varanasi', status: 'Alert', parameters: 8, condition: 'Poor' },
      { id: 'VS-10', name: 'Downstream Confluence', district: 'Varanasi', status: 'Active', parameters: 6, condition: 'Moderate' },
      { id: 'VS-11', name: 'Midstream Monitoring', district: 'Bhadohi', status: 'Maintenance', parameters: 8, condition: 'Unknown' },
      { id: 'VS-12', name: 'Upstream Source', district: 'Prayagraj', status: 'Active', parameters: 8, condition: 'Good' }
    ],
    summary: {
      operational: '11 stations operational',
      maintenance: '1 station under maintenance',
      coverage: '95% network coverage'
    }
  },
  basinArea: {
    title: '🏞️ Basin Area Analysis',
    subtitle: 'Comprehensive watershed characteristics',
    data: [
      { category: 'Urban Area', area: '425 km²', percentage: '13.5%', impact: 'High pollution load', population: '8.2 million' },
      { category: 'Agricultural Land', area: '1,890 km²', percentage: '60.2%', impact: 'Fertilizer runoff', population: '2.8 million' },
      { category: 'Industrial Zones', area: '185 km²', percentage: '5.9%', impact: 'Toxic discharge', population: '0.3 million' },
      { category: 'Forest Cover', area: '315 km²', percentage: '10.0%', impact: 'Natural filtration', population: '0.1 million' },
      { category: 'Water Bodies', area: '95 km²', percentage: '3.0%', impact: 'Flood regulation', population: '-' },
      { category: 'Barren/Others', area: '231 km²', percentage: '7.4%', impact: 'Erosion source', population: '0.6 million' }
    ],
    summary: {
      totalArea: '3,141 km² watershed',
      rainfallPattern: '850-1200mm annual',
      landUseChange: '2.5% urban expansion annually'
    }
  }
};
const WATER_QUALITY_STANDARDS = {
  BOD: { excellent: 3, good: 6, poor: 10 },
  DO: { excellent: 6, good: 4, poor: 2 },
  pH: { min: 6.5, max: 8.5 }
};

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 2000 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime = 0;
    const animate = (currentTime: number) => {
      if (startTime === 0) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  return <span>{count}</span>;
};


const extractFaecalValue = (val: string | null): number => {
    if (!val || val === 'N/A') return 0;
    const parts = val.replace(/,/g, '').split(/–|-/).map(Number);
    return parts.length === 2 ? (parts[0] + parts[1]) / 2 : Number(parts[0]);
  };

// Main Dashboard Component
export default function VarunaRiverDashboard() {
  const [codChartIndex, setCodChartIndex] = useState(0);
  const [worstNitrate, setWorstNitrate] = useState({ location: '—', value: '—' });
  const [worstBOD, setWorstBOD] = useState({ location: '—', value: '—' });
  const [worstFaecalColiform, setWorstFaecalColiform] = useState({ location: '—', value: '—' });
  const [worstAlgaeRisk, setWorstAlgaeRisk] = useState({ location: '—', nitrate: '—', bod: '—' });
  const [worstChemicalRisk, setWorstChemicalRisk] = useState({ location: '—', cod: '—', tss: '—' });
  const [worstTurbidity, setWorstTurbidity] = useState({ location: '—', value: '—' });
  const [worstSalinity, setWorstSalinity] = useState({ location: '—', tds: '—', ec: '—' });
  const [worstIndustrial, setWorstIndustrial] = useState({ location: '—', cod: '—', tds: '—' });
  const [worstLandDumping, setWorstLandDumping] = useState({ location: '—', tss: '—', turbidity: '—', ts: '—' });
  const [worstDetergentRisk, setWorstDetergentRisk] = useState({ location: '—', bod: '—', cod: '—' });
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedParameter, setSelectedParameter] = useState('BOD');
  const [alertsCount, setAlertsCount] = useState(0);
  const [alertDetails, setAlertDetails] = useState<Alert[]>([]);
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  const [showStatDetails, setShowStatDetails] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); 
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [drainData, setDrainData] = useState<DrainRecord[]>([]);
  const [sortKey, setSortKey] = useState<keyof DrainRecord | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [interventionBudget, setInterventionBudget] = useState<number>(25);
  const [generatedInterventions, setGeneratedInterventions] = useState<DynamicIntervention[]>([]);
  
  // Added for Sewage Statistics in Overview
  const [sewageStats, setSewageStats] = useState<{ [key: string]: { feature_count: number } } | null>(null);

  // Fetch Sewage Statistics
  useEffect(() => {
    fetch('/django/drain-water-quality/sewage-infrastructure/statistics')
      .then(res => res.json())
      .then(data => {
        if (data && data.statistics) {
          setSewageStats(data.statistics);
        }
      })
      .catch(err => console.log("Failed to fetch sewage stats", err));
  }, []);

  // 1. Generate Interventions based on Real Data
  useEffect(() => {
    if (drainData.length === 0) return;

    const latestRecordsMap = new Map<string, DrainRecord>();
    
    drainData.forEach(record => {
      const uniqueKey = `${record.location}_${record.stream || 'N/A'}`;
      const existing = latestRecordsMap.get(uniqueKey);
      
      if (!existing || (record.sampling_time && existing.sampling_time && new Date(record.sampling_time) > new Date(existing.sampling_time))) {
        latestRecordsMap.set(uniqueKey, record);
      } else if (!existing) {
        latestRecordsMap.set(uniqueKey, record);
      }
    });

    const uniqueLatestData = Array.from(latestRecordsMap.values());
    const newInterventions: DynamicIntervention[] = [];

    uniqueLatestData.forEach((site, idx) => {
      if (site.do_mg_l < 2.0) {
        newInterventions.push({
          id: `INT-AER-${idx}`,
          location: site.location,
          stream: site.stream,
          problem: `Severe Hypoxia (DO: ${site.do_mg_l} mg/L)`,
          action: "Deploy Surface Jet Aerators",
          cost: 0.15,
          impact: 95,
          priority: 'Critical',
          type: 'Aeration'
        });
      }

      if (site.bod_mg_l > 30.0) {
        newInterventions.push({
          id: `INT-STP-${idx}`,
          location: site.location,
          stream: site.stream,
          problem: `Heavy Sewage Load (BOD: ${site.bod_mg_l} mg/L)`,
          action: "Construct Decentralized STP (2 MLD)",
          cost: 4.5,
          impact: 90,
          priority: 'Critical',
          type: 'STP'
        });
      } else if (site.bod_mg_l > 10.0) {
        newInterventions.push({
          id: `INT-BIO-${idx}`,
          location: site.location,
          stream: site.stream,
          problem: `Moderate Pollution (BOD: ${site.bod_mg_l} mg/L)`,
          action: "In-situ Bioremediation (Phytorid)",
          cost: 0.8,
          impact: 65,
          priority: 'High',
          type: 'STP'
        });
      }

      if (site.cod > 100) {
         newInterventions.push({
          id: `INT-IND-${idx}`,
          location: site.location,
          stream: site.stream,
          problem: `Industrial Effluent (COD: ${site.cod} mg/L)`,
          action: "Industrial Discharge Audit & CETP Link",
          cost: 0.25,
          impact: 70,
          priority: 'High',
          type: 'Chemical'
        });
      }
      
      if (site.tss_mg_l > 100 || site.turbidity > 50) {
        newInterventions.push({
          id: `INT-DRG-${idx}`,
          location: site.location,
          stream: site.stream,
          problem: `Siltation & Solids (TSS: ${site.tss_mg_l} mg/L)`,
          action: "Dredging & Desilting",
          cost: 1.2,
          impact: 40,
          priority: 'Medium',
          type: 'Dredging'
        });
      }
    });

    const priorityMap = { 'Critical': 3, 'High': 2, 'Medium': 1 };
    newInterventions.sort((a, b) => {
      const pDiff = priorityMap[b.priority] - priorityMap[a.priority];
      return pDiff !== 0 ? pDiff : b.impact - a.impact;
    });

    setGeneratedInterventions(newInterventions);
  }, [drainData]);

  // 2. Filter based on Budget Slider
  const { affordableInterventions, totalCost, impactScore } = useMemo(() => {
    let currentCost = 0;
    let impactAccumulator = 0;
    const selected = [];

    for (const item of generatedInterventions) {
      if (currentCost + item.cost <= interventionBudget) {
        selected.push(item);
        currentCost += item.cost;
        impactAccumulator += item.impact;
      }
    }

    return { 
      affordableInterventions: selected, 
      totalCost: currentCost.toFixed(2),
      impactScore: selected.length > 0 ? Math.round(impactAccumulator / selected.length) : 0
    };
  }, [generatedInterventions, interventionBudget]);

  // 3. Group Actions by Location
  const { groupedInterventions, totalUniqueLocations } = useMemo(() => {
    const groups: { [key: string]: { 
      location: string; 
      stream?: string;
      problems: string[]; 
      actions: string[]; 
      totalCost: number; 
      maxPriority: string;
      impact: number;
      count: number;
    } } = {};

    const allUniqueKeys = new Set(generatedInterventions.map(i => `${i.location}_${i.stream || 'NA'}`));
    const totalUnique = allUniqueKeys.size;

    affordableInterventions.forEach(item => {
      const compositeKey = `${item.location}_${item.stream || 'NA'}`;
      
      if (!groups[compositeKey]) {
        groups[compositeKey] = {
          location: item.location,
          stream: item.stream,
          problems: [],
          actions: [],
          totalCost: 0,
          maxPriority: 'Medium',
          impact: 0,
          count: 0
        };
      }

      const g = groups[compositeKey];
      g.problems.push(item.problem);
      g.actions.push(item.action);
      g.totalCost += item.cost;
      g.count += 1;
      g.impact = Math.max(g.impact, item.impact);

      if (item.priority === 'Critical') g.maxPriority = 'Critical';
      else if (item.priority === 'High' && g.maxPriority !== 'Critical') g.maxPriority = 'High';
    });

    const sortedGroups = Object.values(groups).sort((a, b) => {
      const pMap = { 'Critical': 3, 'High': 2, 'Medium': 1 };
      return (pMap[b.maxPriority as keyof typeof pMap] - pMap[a.maxPriority as keyof typeof pMap]) || (b.impact - a.impact);
    });

    return { groupedInterventions: sortedGroups, totalUniqueLocations: totalUnique };
  }, [affordableInterventions, generatedInterventions]);

  const alertRef = useRef<HTMLDivElement>(null);
  const statRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
   
  };
 
  // Fetch drain data
  useEffect(() => {
    fetch('/django/drain-water-quality/main/')
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(data => {
        setDrainData(data);
        const alerts: Alert[] = [];

        // 1. TOP 3 WORST BOD (Highest is bad)
        const topBOD = [...data].sort((a, b) => b.bod_mg_l - a.bod_mg_l).slice(0, 3);
        topBOD.forEach((site, i) => {
            alerts.push({
              type: ` Critical BOD`,
              severity: 'Critical',
              location: `${site.location} (${site.stream || 'N/A'})`,
              message: `Extreme Organic Load detected`,
              value: site.bod_mg_l,
              threshold: 30
            });
        });

        // 2. TOP 3 WORST COD (Highest is bad)
        const topCOD = [...data].sort((a, b) => b.cod - a.cod).slice(0, 3);
        topCOD.forEach((site, i) => {
            alerts.push({
              type: ` Critical COD`,
              severity: 'Critical',
              location: `${site.location} (${site.stream || 'N/A'})`,
              message: `Severe Chemical Pollution`,
              value: site.cod,
              threshold: 200
            });
        });

        // 3. TOP 3 WORST DO (Lowest is bad)
        const topDO = [...data].sort((a, b) => a.do_mg_l - b.do_mg_l).slice(0, 3);
        topDO.forEach((site, i) => {
            alerts.push({
              type: ` Critical DO`,
              severity: 'Critical',
              location: `${site.location} (${site.stream || 'N/A'})`,
              message: `Hypoxic (Low Oxygen)`,
              value: site.do_mg_l,
              threshold: 3
            });
        });

        // 4. TOP 3 WORST pH (Lowest/Acidic is considered critical)
        const topPH = [...data].sort((a, b) => a.ph - b.ph).slice(0, 3);
        topPH.forEach((site, i) => {
            alerts.push({
              type: ` Critical pH`,
              severity: 'Critical',
              location: `${site.location} (${site.stream || 'N/A'})`,
              message: `Highly Acidic Water`,
              value: site.ph,
              threshold: 6.5
            });
        });

        setAlertDetails(alerts);
        setAlertsCount(alerts.length);
        const nitrateSorted = [...data].filter(site => site.nitrate !== null && site.nitrate !== undefined).sort((a, b) => b.nitrate - a.nitrate);
        if (nitrateSorted.length > 0) setWorstNitrate({ location: nitrateSorted[0].location, value: nitrateSorted[0].nitrate.toFixed(2) });
        const bodSorted = [...data].filter(site => site.bod_mg_l !== null && site.bod_mg_l !== undefined).sort((a, b) => b.bod_mg_l - a.bod_mg_l);
        if (bodSorted.length > 0) setWorstBOD({ location: bodSorted[0].location, value: bodSorted[0].bod_mg_l.toFixed(2) });
        const faecalSites = data.filter((d: DrainRecord) => {
          const val = d.faecal_col;
          if (!val || val === 'N/A') return false;
          const parsed = extractFaecalValue(val);
          return !isNaN(parsed) && parsed > 0;
        });
        const worstFaecal = faecalSites.sort((a: DrainRecord, b: DrainRecord) => extractFaecalValue(b.faecal_col) - extractFaecalValue(a.faecal_col))[0];
        if (worstFaecal) setWorstFaecalColiform({ location: worstFaecal.location, value: extractFaecalValue(worstFaecal.faecal_col).toFixed(0) });
        const algaeRiskCandidates = data.filter((d: DrainRecord) => d.nitrate !== null && d.bod_mg_l !== null);
        const highestAlgaeSite = algaeRiskCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.nitrate + b.bod_mg_l) - (a.nitrate + a.bod_mg_l))[0];
        if (highestAlgaeSite) setWorstAlgaeRisk({ location: highestAlgaeSite.location, nitrate: highestAlgaeSite.nitrate.toFixed(2), bod: highestAlgaeSite.bod_mg_l.toFixed(2) });
        const chemicalRiskCandidates = data.filter((d: DrainRecord) => d.cod !== null && d.tss_mg_l !== null);
        const highestChemicalSite = chemicalRiskCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.cod + b.tss_mg_l) - (a.cod + a.tss_mg_l))[0];
        if (highestChemicalSite) setWorstChemicalRisk({ location: highestChemicalSite.location, cod: highestChemicalSite.cod.toFixed(2), tss: highestChemicalSite.tss_mg_l.toFixed(2) });
        const highTurbiditySite = data.filter((d: DrainRecord) => typeof d.turbidity === 'number').sort((a: DrainRecord, b: DrainRecord) => b.turbidity - a.turbidity)[0];
        if (highTurbiditySite) setWorstTurbidity({ location: highTurbiditySite.location, value: highTurbiditySite.turbidity.toFixed(2) });
        const salinityCandidates = data.filter((d: DrainRecord) => d.tds_ppm > 500 || d.ec_us_cm > 1000);
        const highestSalinitySite = salinityCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.tds_ppm + b.ec_us_cm) - (a.tds_ppm + a.ec_us_cm))[0];
        if (highestSalinitySite) setWorstSalinity({ location: highestSalinitySite.location, tds: highestSalinitySite.tds_ppm.toFixed(2), ec: highestSalinitySite.ec_us_cm.toFixed(2) });
        const industrialCandidates = data.filter((d: DrainRecord) => d.cod && d.tds_ppm);
        const highestIndustrial = industrialCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.cod + b.tds_ppm) - (a.cod + a.tds_ppm))[0];
        if (highestIndustrial) setWorstIndustrial({ location: highestIndustrial.location, cod: highestIndustrial.cod.toFixed(2), tds: highestIndustrial.tds_ppm.toFixed(2) });
        const landDumpingCandidates = data.filter((d: DrainRecord) => d.tss_mg_l > 100 || d.turbidity > 25 || d.ts_mg_l > 500);
        const worstDumpingSite = landDumpingCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.tss_mg_l + b.turbidity + b.ts_mg_l) - (a.tss_mg_l + a.turbidity + a.ts_mg_l))[0];
        if (worstDumpingSite) setWorstLandDumping({ location: worstDumpingSite.location, tss: worstDumpingSite.tss_mg_l.toFixed(1), turbidity: worstDumpingSite.turbidity.toFixed(1), ts: worstDumpingSite.ts_mg_l.toFixed(1) });
        const detergentRiskCandidates = data.filter((d: DrainRecord) => d.bod_mg_l !== null && d.cod !== null);
        const worstDetergentSite = detergentRiskCandidates.sort((a: DrainRecord, b: DrainRecord) => (b.bod_mg_l + b.cod) - (a.bod_mg_l + a.cod))[0];
        if (worstDetergentSite) setWorstDetergentRisk({ location: worstDetergentSite.location, bod: worstDetergentSite.bod_mg_l.toFixed(2), cod: worstDetergentSite.cod.toFixed(2) });
      })
      .catch(error => console.log('Error fetching drain data:', error));
  }, []);
  
  useEffect(() => {
    // Check if the mapRef is mounted and the current tab is 'water-quality'
    if (activeTab === 'water-quality' && mapRef.current) {
        // Use smooth scrolling to bring the map element into view
        mapRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
}, [activeTab]);
  
  const { 
    acidicCount, 
    lowDOCount, 
    highBODCount, 
    highCODCount, 
    worstAcidicSite,
    worstLowDOSite,
    worstHighBODSite,
    worstHighCODSite
  } = useMemo(() => {
    
    const acidicSites = drainData.filter(d => d.ph < 6.0);
    const lowDOSites = drainData.filter(d => d.do_mg_l < 2);
    const highBODSites = drainData.filter(d => d.bod_mg_l > 30);
    const highCODSites = drainData.filter(d => d.cod > 100);

    const worstAcidicSite = acidicSites.length > 0
      ? acidicSites.sort((a, b) => a.ph - b.ph)[0] 
      : null;
      
    const worstLowDOSite = lowDOSites.length > 0
      ? lowDOSites.sort((a, b) => a.do_mg_l - b.do_mg_l)[0] 
      : null;
      
    const worstHighBODSite = highBODSites.length > 0
      ? highBODSites.sort((a, b) => b.bod_mg_l - a.bod_mg_l)[0] 
      : null;

    const worstHighCODSite = highCODSites.length > 0
      ? highCODSites.sort((a, b) => b.cod - a.cod)[0] 
      : null;

    return {
      acidicCount: acidicSites.length,
      lowDOCount: lowDOSites.length,
      highBODCount: highBODSites.length,
      highCODCount: highCODSites.length,
      worstAcidicSite,
      worstLowDOSite,
      worstHighBODSite,
      worstHighCODSite
    };
  }, [drainData]);

  const filteredDrainData = useMemo(() => {
    switch (selectedFilter) {
      case 'acidic': return drainData.filter(d => d.ph < 6.0);
      case 'lowDO': return drainData.filter(d => d.do_mg_l < 2);
      case 'highBOD': return drainData.filter(d => d.bod_mg_l > 30);
      case 'highCOD': return drainData.filter(d => d.cod > 100);
      case 'coliform': return drainData.filter(d => (d.faecal_col && d.faecal_col !== 'N/A') || (d.total_col && d.total_col !== 'N/A'));
      default: return drainData;
    }
  }, [drainData, selectedFilter]);

  const sortedAndFilteredData = useMemo(() => {
    if (!sortKey) {
      return filteredDrainData; 
    }

    return [...filteredDrainData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      const isANil = aVal == null || aVal === 'N/A';
      const isBNil = bVal == null || bVal === 'N/A';
      if (isANil && isBNil) return 0;
      if (isANil) return 1; 
      if (isBNil) return -1; 

      if (sortKey === 'faecal_col' || sortKey === 'total_col') {
        const aNum = extractFaecalValue(aVal as string | null);
        const bNum = extractFaecalValue(bVal as string | null);
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return 0;
    });
  }, [filteredDrainData, sortKey, sortOrder]);

  const processedData = drainData.map((entry, index) => ({
    label: entry.location || `Point-${index + 1}`,
    pH: entry.ph,
    DO: entry.do_mg_l,
    BOD: entry.bod_mg_l,
    COD: entry.cod,
    temp: entry.temp,
  }));

  const calculateRealAlerts = () => {
    const alerts: Alert[] = [];
    spatialData.forEach(station => {
      if (station.BOD > WATER_QUALITY_STANDARDS.BOD.poor) {
        alerts.push({
          type: 'BOD Critical',
          severity: 'Critical',
          message: `BOD level critically high - Immediate action required`,
          location: station.station,
          value: station.BOD,
          threshold: WATER_QUALITY_STANDARDS.BOD.poor
        });
      } else if (station.BOD > WATER_QUALITY_STANDARDS.BOD.good) {
        alerts.push({
          type: 'BOD High',
          severity: 'High',
          message: `BOD level above acceptable limit - Action needed`,
          location: station.station,
          value: station.BOD,
          threshold: WATER_QUALITY_STANDARDS.BOD.good
        });
      }
      if (station.DO < WATER_QUALITY_STANDARDS.DO.poor) {
        alerts.push({
          type: 'DO Critical',
          severity: 'Critical',
          message: `Dissolved Oxygen critically low - Emergency intervention needed`,
          location: station.station,
          value: station.DO,
          threshold: WATER_QUALITY_STANDARDS.DO.poor
        });
      } else if (station.DO < WATER_QUALITY_STANDARDS.DO.good) {
        alerts.push({
          type: 'DO Low',
          severity: 'High',
          message: `Dissolved Oxygen below acceptable level - Urgent attention required`,
          location: station.station,
          value: station.DO,
          threshold: WATER_QUALITY_STANDARDS.DO.good
        });
      }
    });
    const criticalIndustries = industrialData.filter(industry => industry.status.includes('Critical') || industry.count > 500);
    if (criticalIndustries.length > 0) {
      alerts.push({
        type: 'Industrial Pollution',
        severity: 'High',
        message: `${criticalIndustries[0]?.count || 0} small-scale industries without proper treatment - High pollution risk`,
        location: 'Varanasi District'
      });
    }
    return alerts.filter(alert => alert.severity === 'Critical' || alert.severity === 'High');
  };
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1000);
    const alerts = calculateRealAlerts();
    setAlertDetails(alerts);
    setAlertsCount(alerts.length);
  }, []);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(event.target as Node)) setShowAlertDetails(false);
      if (statRef.current && !statRef.current.contains(event.target as Node)) {
        setShowStatDetails(false);
        setSelectedStat(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    setSelectedFilter(null); 
  }, [pathname]);

const handleSort = (key: keyof DrainRecord) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleStatClick = (statType: string) => {
    setSelectedStat(statType);
    setShowStatDetails(true);
    setShowAlertDetails(false);
  };
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-800 bg-red-100 border-red-200';
      case 'high': return 'text-orange-800 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-800 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-800 bg-blue-100 border-blue-200';
      default: return 'text-gray-800 bg-gray-100 border-gray-200';
    }
  };
  const TabButton = ({ id, label, isActive, onClick }: TabButtonProps) => (
    <button
      onClick={() => onClick(id)}
      className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 transform ${
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105'
          : 'bg-white text-gray-700 hover:bg-gray-50 hover:scale-102 shadow-sm border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-cyan-50 p-6">
      <style jsx global>{`
        .varuna-map-controls {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .leaflet-control-zoom,
        .leaflet-control-attribution {
          display: none !important;
        }
      `}</style>
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.6); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .float { animation: float 3s ease-in-out infinite; }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
      {/* Header Section */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white rounded-2xl p-8 shadow-2xl border border-blue-500/20">
          <div className="flex justify-between items-center">
            
            <div>
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                 Varuna River Management Dashboard
              </h1>
              <p className="text-blue-100 text-lg mb-4">Comprehensive Water Quality Monitoring & Decision Support System</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <span
                  onClick={() => handleStatClick('riverLength')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                  
                >
                  224.4 km River Length
                </span>
                <span
                  onClick={() => handleStatClick('districts')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                 
                >
                  5 Districts Covered
                </span>
                <span
                  onClick={() => handleStatClick('monitoringStations')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                 
                >
                  6.2 million Population
                </span>
                <span
                  onClick={() => handleStatClick('basinArea')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                 
                >
                  3664.6 km² Basin Area
                </span>
              </div>
            </div>
            <div className="text-right relative" ref={alertRef}>
              <div
                className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white px-4 py-3 rounded-xl cursor-pointer hover:from-red-600 hover:via-red-700 hover:to-red-800 transition-all duration-300 transform hover:scale-110 shadow-xl pulse-glow border border-red-400 mb-3"
                onClick={() => setShowAlertDetails(!showAlertDetails)}
                title="Click to view high priority alert details"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col">
                    {/* <div className="text-2xl font-bold leading-none">{alertsCount}</div> */}
                    <div className="text-xs font-semibold opacity-90">CRITICAL ALERTS</div>
                  </div>
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              {showAlertDetails && (
                <div
                  className="fixed top-4 right-4 w-70 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 max-h-[80vh] overflow-y-auto flex flex-col"
                  style={{ zIndex: 99999 }}
                >
                  <div className="popup flex flex-col" style={{ maxHeight: '80vh' }}>
                    <div className="p-4 border-b bg-gradient-to-r from-red-50 via-pink-50 to-red-50 rounded-t-2xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-red-600">High priority water quality issues</p>
                        </div>
                        <button
                          onClick={() => setShowAlertDetails(false)}
                          className="text-red-500 hover:text-red-700 text-2xl font-bold transition-colors hover:bg-red-100 rounded-full w-8 h-8 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 150px)' }}>
                      {alertDetails.length > 0 ? (
                        alertDetails.map((alert, index) => (
                          <div key={index} className={`p-4 rounded-xl border-2 ${getSeverityColor(alert.severity)} hover:shadow-lg transition-all duration-300 transform hover:scale-102`}>
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-sm">{alert.type}</span>
                              <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                                alert.severity === 'Critical' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                                alert.severity === 'High' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' :
                                'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                              }`}>
                                {alert.severity}
                              </span>
                            </div>
                            <p className="text-sm mb-2 font-medium">{alert.message}</p>
                            {alert.location && <p className="text-xs text-gray-600 mb-1">📍 {alert.location}</p>}
                            {alert.value && alert.threshold && (
                              <div className="text-xs bg-gray-100 rounded-lg p-2 mt-2">
                                <span className="font-semibold">Current: {alert.value}</span> | <span className="font-semibold"></span>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                          <div className="text-4xl mb-2">✅</div>
                          <p className="font-semibold">No Critical Alerts</p>
                          <p className="text-sm">All parameters within acceptable limits</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* <div className="text-blue-100 text-sm">Last Updated: {new Date().toLocaleString()}</div> */}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-xl border border-white/20 mb-6">
            <div className="flex flex-wrap justify-center gap-4">
              <TabButton id="overview" label=" Overview" isActive={activeTab === 'overview'} onClick={setActiveTab} />
              <TabButton id="water-quality" label=" Water Quality" isActive={activeTab === 'water-quality'} onClick={setActiveTab} />
              <TabButton id="pollution-sources" label=" Pollution Sources" isActive={activeTab === 'pollution-sources'} onClick={setActiveTab} />
              <TabButton 
                id="sewage-infrastructure" 
                label=" Sewage Infrastructure" 
                isActive={activeTab === 'sewage-infrastructure'} 
                onClick={setActiveTab} 
              />
              {/* REMOVED: TabButton id="predictions" label=" Water Quality Analysis" isActive={activeTab === 'predictions'} onClick={setActiveTab} */}
              <TabButton id="interventions" label=" Interventions" isActive={activeTab === 'interventions'} onClick={setActiveTab} />
              <TabButton id="system-dynamics" label=" System Dynamics" isActive={activeTab === 'system-dynamics'} onClick={setActiveTab} />
              <TabButton 
                id="gallery" 
                label=" Varuna Gallery" 
                isActive={activeTab === 'gallery'} 
                onClick={setActiveTab} 
                />
              {/* Story Map tab removed as requested */}
            </div>
          </div>
      
      {/* Tab Content */}
      {/* Tab Content */}
      {activeTab === 'gallery' && (
      <VarunaGallery />
       )}
      
      {activeTab === 'overview' && (
    <Overview
      drainData={drainData}
      sewageStats={sewageStats}
      acidicCount={acidicCount}
      lowDOCount={lowDOCount}
      highBODCount={highBODCount}
      highCODCount={highCODCount}
      worstAcidicSite={worstAcidicSite}
      worstLowDOSite={worstLowDOSite}
      worstHighBODSite={worstHighBODSite}
      worstHighCODSite={worstHighCODSite}
      handleStatClick={handleStatClick}
      showNotification={showNotification}
      AnimatedCounter={AnimatedCounter} // Pass the component itself
      setActiveTab={setActiveTab}         
      setSelectedFilter={setSelectedFilter}
    />
)}

      {activeTab === 'water-quality' && (
        <div className="space-y-8">
          {/* Varuna River Network Map (Moved Here) */}
          <div ref={mapRef} className="w-full animate-fadeIn" id="map-container">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 flex justify-between items-center varuna-map-controls">
                  <div>
                    <h2 className="text-xl font-bold"> Varuna River Network Map</h2>
                  </div>
                </div>
                <div className="h-[600px] relative overflow-hidden">
                  <VarunaMap
                    sidebarCollapsed={sidebarCollapsed}
                    showNotification={showNotification}
                    selectedFilter={selectedFilter} 
                  />
                </div>
                <div className="p-3 bg-gray-50 border-t text-center">
                  <p className="text-xs text-gray-600">
                    🗺️ Use controls to explore rivers and water quality data
                  </p>
                </div>
              </div>
            </div>
         
          {/* ---------------------------------------------------- */}
          {/* MOVED: Water Quality Analysis (WQIDashboard) */}
          {/* ---------------------------------------------------- */}
          <div className="space-y-8">
            <WQIDashboard showNotification={showNotification} />
          </div>
          {/* ---------------------------------------------------- */}

          {/* NEW: Drain Water Quality Stations */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
               RIVER WATER QUALITY OBSERVATIONS
            </h3>
             {/* Dropdown Filter */}
            <div className="text-sm">
             
              <select
                value={selectedFilter || ''}
                onChange={(e) =>
                  setSelectedFilter(e.target.value !== '' ? e.target.value : null)
                }
                className="appearance-none border border-blue-300 rounded-md px-3 py-2 bg-white hover:shadow-md hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 pr-8 transition-all duration-200"
              >
                <option value="">All Sites</option>
                <option value="acidic"> Acidic pH Sites</option>
                <option value="lowDO"> Low DO Sites</option>
                <option value="highBOD"> High BOD Sites</option>
                <option value="highCOD"> High COD Sites</option>
                <option value="coliform"> Coliform Positive</option>
              </select>
            </div>
          </div>
            {/* Water Quality summary for Drains */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-16">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainData.filter(d => d.ph < 6.0).length}
                </div>
                <div className="text-sm font-semibold text-red-800">Acidic pH Sites</div>
                <div className="text-xs text-red-600">pH &lt; 6.0</div>
              </div>
             
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-orange-600">
                  {drainData.filter(d => d.do_mg_l < 2).length}
                </div>
                <div className="text-sm font-semibold text-orange-800">Low DO Sites</div>
                <div className="text-xs text-orange-600">DO &lt; 2 mg/L</div>
              </div>
             
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainData.filter(d => d.bod_mg_l > 30).length}
                </div>
                <div className="text-sm font-semibold text-red-800">High BOD Sites</div>
                <div className="text-xs text-red-600">BOD &gt; 30 mg/L</div>
              </div>
             
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-purple-600">
                  {drainData.filter(d => d.cod > 100).length}
                </div>
                <div className="text-sm font-semibold text-purple-800">High COD Sites</div>
                <div className="text-xs text-purple-600">COD &gt; 100 mg/L</div>
              </div>
             
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainData.filter(d => d.faecal_col && d.faecal_col !== 'N/A' && d.faecal_col.trim() !== '').length}
                </div>
                <div className="text-sm font-semibold text-red-800">Coliform Positive</div>
                <div className="text-xs text-red-600">Bacterial Contamination</div>
              </div>
            </div>


           
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                    {/* ✨ MODIFIED: Added onClick, cursor-pointer, and sort indicator logic */}
                    {[
                      { label: 'Location', key: 'location', minWidth: '200px' },
                      { label: 'Stream', key: 'stream' },
                      { label: 'pH', key: 'ph' },
                      { label: 'Temp', key: 'temp' },
                      { label: 'EC (μS/cm)', key: 'ec_us_cm' },
                      { label: 'TDS (ppm)', key: 'tds_ppm' },
                      { label: 'DO (mg/L)', key: 'do_mg_l' },
                      { label: 'Turbidity', key: 'turbidity' },
                      { label: 'TSS (mg/L)', key: 'tss_mg_l' },
                      { label: 'COD', key: 'cod' },
                      { label: 'BOD (mg/L)', key: 'bod_mg_l' },
                      { label: 'TS (mg/L)', key: 'ts_mg_l' },
                      { label: 'Chloride', key: 'chloride' },
                      { label: 'Nitrate', key: 'nitrate' },
                      { label: 'Faecal Col', key: 'faecal_col' },
                      { label: 'Total Col', key: 'total_col' },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="text-left p-3 font-semibold cursor-pointer select-none"
                        style={{ minWidth: col.minWidth || 'auto' }}
                        onClick={() => handleSort(col.key as keyof DrainRecord)}
                      >
                        {col.label}
                        {sortKey === col.key && (
                          <span className="ml-1">{sortOrder === 'asc' ? '🔼' : '🔽'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredData.map((drain, index) => (
  <tr
    key={index}
    className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-300"
  >
    {/* 1 ─ Location */}
    <td className="p-3 font-medium text-gray-800">{drain.location}</td>
    <td className="p-3 font-medium text-gray-800">{drain.stream}</td>
    {/* 2 ─ pH */}
    <td className="p-3">
      <span
        className={`font-semibold ${
          drain.ph < 6.5 ? 'text-red-600'
          : drain.ph > 8.5 ? 'text-red-600'
          : 'text-green-600'
        }`}
      >
        {drain.ph}
      </span>
    </td>
    {/* 3 ─ Temperature */}
    <td className="p-3 font-semibold text-blue-600">
      {drain.temp}°C
    </td>
    {/* 4 ─ EC, TDS */}
    <td className="p-3">{drain.ec_us_cm}</td>
    <td className="p-3">{drain.tds_ppm}</td>
    {/* 5 ─ DO */}
    <td className="p-3">
      <span
        className={`font-semibold ${
          drain.do_mg_l < 4 ? 'text-red-600'
          : drain.do_mg_l < 6 ? 'text-yellow-600'
          : 'text-green-600'
        }`}
      >
        {drain.do_mg_l}
      </span>
    </td>
    {/* 6 ─ Turbidity, TSS */}
    <td className="p-3">{drain.turbidity}</td>
    <td className="p-3">{drain.tss_mg_l}</td>
    {/* 7 ─ COD */}
    <td className="p-3">
      <span
        className={`font-semibold ${
          drain.cod > 100 ? 'text-red-600'
          : drain.cod > 50 ? 'text-yellow-600'
          : 'text-green-600'
        }`}
      >
        {drain.cod}
      </span>
    </td>
    {/* 8 ─ BOD */}
    <td className="p-3">
      <span
        className={`font-semibold ${
          drain.bod_mg_l > 10 ? 'text-red-600'
          : drain.bod_mg_l > 6 ? 'text-yellow-600'
          : 'text-green-600'
        }`}
      >
        {drain.bod_mg_l}
      </span>
    </td>
    {/* 9 ─ TS, Chloride, Nitrate */}
    <td className="p-3">{drain.ts_mg_l}</td>
    <td className="p-3">{drain.chloride}</td>
    <td className="p-3">
      {typeof drain.nitrate === 'number' ? drain.nitrate : 'N/A'}
    </td>
    {/* 10 ─ Faecal / Total Coliform */}
    <td className="p-3">
      <span
        className={`text-xs ${
          drain.faecal_col && drain.faecal_col !== 'N/A'
            ? 'text-red-600 font-semibold bg-red-50 px-2 py-1 rounded'
            : 'text-gray-500'
        }`}
      >
        {drain.faecal_col ?? 'N/A'}
      </span>
    </td>
    <td className="p-3">
      <span
        className={`text-xs ${
          drain.total_col && drain.total_col !== 'N/A'
            ? 'text-red-600 font-semibold bg-red-50 px-2 py-1 rounded'
            : 'text-gray-500'
        }`}
      >
        {drain.total_col ?? 'N/A'}
      </span>
    </td>
  </tr>
))}
                </tbody>
              </table>
            </div>
           
            
          </div>
        </div>
      )}
       
      {activeTab === 'pollution-sources' && (
  <PollutionSources drainData={drainData} />
)}
      

      {/* REMOVED: activeTab === 'predictions' */}
     
      {activeTab === 'interventions' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Budget Simulator Header */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl p-8 text-white border border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                   Prescriptive Intervention Engine
                </h2>
                <p className="text-slate-400 mt-2 max-w-4xl">
                  Recommendations based on real-time water quality data. Adjust the budget to see which projects can be executed.
                </p>
              </div>
              
              {/* Budget Slider Control */}
              <div className="bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/10 w-full md:w-96">
                <div className="flex justify-between mb-4">
                  <span className="font-bold text-blue-300">Available Budget</span>
                  <span className="font-mono text-2xl font-bold">₹{interventionBudget} Cr</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="200"
                  step="1"
                  value={interventionBudget}
                  onChange={(e) => setInterventionBudget(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>₹1 Cr</span>
                  <span>₹200 Cr</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Action List */}
            {/* LEFT: Action List */}
            <div className="lg:col-span-2 space-y-6 h-full flex flex-col">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">
                  ✅ Recommended Actions ({groupedInterventions.length}/{totalUniqueLocations})
                </h3>
                <span className="text-sm text-gray-500">
                  Sorted by Urgency & Impact
                </span>
              </div>

              {/* ✨ FIX: Added fixed height (h-[600px]) and flex column to contain the scrollbar */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                
                {/* ✨ FIX: Added overflow-y-auto to this container only */}
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left border-collapse relative">
                    
                    {/* ✨ FIX: Made header sticky so it stays at the top while scrolling */}
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                        <th className="p-4 bg-gray-50">Priority</th>
                        <th className="p-4 bg-gray-50">Location & Problem</th>
                        <th className="p-4 bg-gray-50">Recommended Action</th>
                        <th className="p-4 text-right bg-gray-50">Cost (Cr)</th>
                        <th className="p-4 text-center bg-gray-50">Impact</th>
                      </tr>
                    </thead>
                    
                    <tbody className="divide-y divide-gray-100">
                      {groupedInterventions.map((group, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                          {/* Priority Column */}
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                group.maxPriority === 'Critical' ? 'bg-red-100 text-red-800' :
                                group.maxPriority === 'High' ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {group.maxPriority === 'Critical' && <span className="mr-1 animate-pulse">●</span>}
                                {group.maxPriority}
                              </span>
                              {group.count > 1 && (
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit">
                                  {group.count} ISSUES
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Location & Problems Column */}
                          <td className="p-4 align-top">
                            <div className="font-bold text-gray-800 text-sm">{group.location}</div>
                            <div className="mt-1 space-y-1">
                              {group.problems.map((prob, i) => (
                                <div key={i} className="text-xs text-red-600 flex items-start gap-1">
                                  <span>•</span> {prob}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="p-4 align-top">
                            <div className="space-y-1">
                              {group.actions.map((act, i) => (
                                <div key={i} className="text-sm text-gray-700 font-medium flex items-start gap-1">
                                  <span className="text-blue-500">✓</span> {act}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Cost Column */}
                          <td className="p-4 text-right font-mono font-bold text-gray-700 align-top">
                            ₹{group.totalCost.toFixed(2)}
                          </td>

                          {/* Impact Column */}
                          <td className="p-4 text-center align-top">
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-500 h-1.5 rounded-full" 
                                  style={{ width: `${group.impact}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-green-700">{group.impact}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      
                      {groupedInterventions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">
                            Increase budget to see actionable interventions.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Items that didn't fit budget */}
              {generatedInterventions.length > affordableInterventions.length && (
                <div className="p-4 bg-gray-100 rounded-lg border border-gray-300 border-dashed text-center text-gray-500 text-sm">
                  {generatedInterventions.length - affordableInterventions.length} more critical interventions pending. Increase budget by 
                  <span className="font-bold text-gray-700 ml-1">
                    ₹{(generatedInterventions.reduce((sum, i) => sum + i.cost, 0) - parseFloat(totalCost)).toFixed(2)} Cr
                  </span> to execute all.
                </div>
              )}
            </div>

            {/* RIGHT: Impact Summary */}
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100">
                  <h3 className="font-bold text-gray-800 mb-6">Projected Outcome</h3>
                  
                  <div className="space-y-6">
                    <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                      <div className="text-sm text-green-800 font-medium mb-1">Total Investment</div>
                      <div className="text-4xl font-bold text-green-600">₹{totalCost} <span className="text-lg text-green-700/70">Cr</span></div>
                    </div>

                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                       <div className="text-sm text-blue-800 font-medium mb-1">Locations Covered</div>
                       <div className="text-4xl font-bold text-blue-600">{affordableInterventions.length}</div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-600">Avg. Impact Score</span>
                          <span className="text-sm font-bold text-blue-600">{impactScore}/100</span>
                       </div>
                       <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${impactScore}%` }}
                          ></div>
                       </div>
                       <p className="text-xs text-gray-500 mt-2 leading-snug">
                         *Impact Score calculated based on potential BOD reduction and DO improvement across selected sites.
                       </p>
                    </div>
                  </div>

                  {/* Infrastructure Chart */}
                  <div className="mt-8 h-64">
                    <h4 className="text-sm font-bold text-gray-700 mb-4">Intervention Mix</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Aeration', value: affordableInterventions.filter(i => i.type === 'Aeration').length },
                            { name: 'STP', value: affordableInterventions.filter(i => i.type === 'STP').length },
                            { name: 'Dredging', value: affordableInterventions.filter(i => i.type === 'Dredging').length },
                            { name: 'Chemical', value: affordableInterventions.filter(i => i.type === 'Chemical').length },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#3b82f6" /> {/* Aeration */}
                          <Cell fill="#10b981" /> {/* STP */}
                          <Cell fill="#f59e0b" /> {/* Dredging */}
                          <Cell fill="#6366f1" /> {/* Chemical */}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}


      {activeTab === 'system-dynamics' && (
  <div className="space-y-8">
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
         Interactive System Dynamics Simulator
      </h2>
      <p className="text-gray-600 mb-6">
        Use the controls below to simulate the impact of sewage interception and treatment efficiency on the river's water quality. 
        This model uses <strong>real-time data</strong> from {drainData.length} monitoring stations.
      </p>

      {/* Pass the real drainData to the simulator */}
      <SystemDynamics drainData={drainData} />
    </div>
  </div>
)}


       {/* ✨ ADD THIS ENTIRE NEW SECTION */}
      {activeTab === 'sewage-infrastructure' && (
        <div className="space-y-8">
          <SewageInfrastructure 
            showNotification={showNotification}
          />
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-12 text-center bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <p className="text-gray-600 font-medium">Varuna River Management System | IIT (BHU) Varanasi | Smart Laboratory on Clean River</p>
      </div>
    </div>
  );
}
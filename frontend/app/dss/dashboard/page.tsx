'use client';
import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

interface Alert {
  type: string;
  severity: 'High' | 'Critical';
  message: string;
  location: string;
  value?: number;      // 👈 optional value (for BOD/DO/COD/etc.)
  threshold?: number;  // 👈 optional threshold
}

interface TabButtonProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: (id: string) => void;  // ✅ This tells TypeScript that `id` is a string
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, isActive, onClick }) => {
  return (
    <button
      className={`px-4 py-2 rounded-md transition ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}
      onClick={() => onClick(id)}  // ✅ Here you're passing id back
    >
      {label}
    </button>
  );
};



// ✅ Dynamically import the Map component
const Map = dynamic(
  () => import('@/app/dss/visualizations/vector_visual/components/map'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-96 bg-gray-100 flex items-center justify-center rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading Map...</p>
        </div>
      </div>
    )
  }
);

// Sample data based on your document
const temporalData = [
  { month: 'Jul-09', temp: 34.1, pH: 8.0, DO: 1.8, BOD: 88, COD: 150, alkalinity: 300 },
  { month: 'Aug-09', temp: 33.0, pH: 7.6, DO: 2.0, BOD: 80, COD: 112, alkalinity: 220 },
  { month: 'Sep-09', temp: 30.2, pH: 7.1, DO: 2.2, BOD: 35, COD: 98, alkalinity: 205 },
  { month: 'Oct-09', temp: 28.2, pH: 7.0, DO: 2.5, BOD: 48, COD: 100, alkalinity: 200 },
  { month: 'Nov-09', temp: 22.2, pH: 7.0, DO: 2.5, BOD: 55, COD: 89, alkalinity: 230 },
  { month: 'Dec-09', temp: 21.3, pH: 6.9, DO: 2.8, BOD: 52, COD: 78, alkalinity: 296 },
  { month: 'Jan-10', temp: 19.5, pH: 7.0, DO: 3.0, BOD: 40, COD: 75, alkalinity: 288 },
  { month: 'Feb-10', temp: 20.8, pH: 7.1, DO: 3.2, BOD: 42, COD: 78, alkalinity: 281 },
  { month: 'Mar-10', temp: 21.2, pH: 7.3, DO: 3.5, BOD: 40, COD: 79, alkalinity: 295 },
  { month: 'Apr-10', temp: 26.8, pH: 7.3, DO: 2.4, BOD: 48, COD: 82, alkalinity: 325 },
  { month: 'May-10', temp: 34.8, pH: 8.1, DO: 1.8, BOD: 70, COD: 101, alkalinity: 379 },
  { month: 'Jun-10', temp: 35.5, pH: 8.5, DO: 1.0, BOD: 78, COD: 135, alkalinity: 395 }
];

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

// Drain Water Quality Data (ALL 68 records with temperature measurements)
const drainWaterQualityData = [
  { Location: "Varuna Pul (Kuchehri road)", pH: 5.38, Temperatur: "25.89°C", EC__S_cm_: 1282, TDS_ppm_: 641, DO_mg_L_: 41.35, Turbidity_: 69.8, TSS_mg_l_: 86, COD: 67.2, BOD_mg_l_: 26.4, TS_mg_l_: 727, Chloride_m: 42.96, Nitrate: 0.773, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Bheem Nagar", pH: 5.38, Temperatur: "25.10°C", EC__S_cm_: 1209, TDS_ppm_: 605, DO_mg_L_: 43.3, Turbidity_: 60.1, TSS_mg_l_: 162, COD: 70.4, BOD_mg_l_: 27.5, TS_mg_l_: 767, Chloride_m: 47.96, Nitrate: 1.564, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Varuna Pul (Kuchehri road)", pH: 5.4, Temperatur: "26.52°C", EC__S_cm_: 1293, TDS_ppm_: 647, DO_mg_L_: 39.55, Turbidity_: 73.4, TSS_mg_l_: 66, COD: 64, BOD_mg_l_: 25.65, TS_mg_l_: 713, Chloride_m: 48.96, Nitrate: 0.767, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Bheem Nagar", pH: 5.4, Temperatur: "25.88°C", EC__S_cm_: 1248, TDS_ppm_: 624, DO_mg_L_: 43.3, Turbidity_: 59.1, TSS_mg_l_: 0, COD: 0, BOD_mg_l_: 29.2, TS_mg_l_: 624, Chloride_m: 0, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Dhelwariyan", pH: 5.41, Temperatur: "28.99°C", EC__S_cm_: 1338, TDS_ppm_: 669, DO_mg_L_: 36, Turbidity_: 74, TSS_mg_l_: 72, COD: 92.8, BOD_mg_l_: 23.05, TS_mg_l_: 741, Chloride_m: 44.96, Nitrate: 2.008, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Nakki Ghat", pH: 5.42, Temperatur: "30.05°C", EC__S_cm_: 1308, TDS_ppm_: 654, DO_mg_L_: 30.55, Turbidity_: 69.8, TSS_mg_l_: 208, COD: 64, BOD_mg_l_: 20.05, TS_mg_l_: 862, Chloride_m: 47.96, Nitrate: 1.111, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Bagwanaara (Halmauja)", pH: 5.42, Temperatur: "26.24°C", EC__S_cm_: 1300, TDS_ppm_: 650, DO_mg_L_: 32.45, Turbidity_: 87.2, TSS_mg_l_: 188, COD: 70.4, BOD_mg_l_: 21.35, TS_mg_l_: 838, Chloride_m: 48.96, Nitrate: 2.053, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "BagwanaaLa (Halmauja)", pH: 5.42, Temperatur: "27.24°C", EC__S_cm_: 1311, TDS_ppm_: 655, DO_mg_L_: 34.25, Turbidity_: 53.7, TSS_mg_l_: 78, COD: 64, BOD_mg_l_: 22.15, TS_mg_l_: 733, Chloride_m: 48.96, Nitrate: 1.658, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Dhelwariyan", pH: 5.42, Temperatur: "28.76°C", EC__S_cm_: 1315, TDS_ppm_: 657, DO_mg_L_: 37.8, Turbidity_: 59.7, TSS_mg_l_: 230, COD: 72.8, BOD_mg_l_: 24.55, TS_mg_l_: 887, Chloride_m: 48.96, Nitrate: 1.792, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Koniya (Sitla Mata Mandir)", pH: 5.43, Temperatur: "24.40°C", EC__S_cm_: 1268, TDS_ppm_: 634, DO_mg_L_: 24.75, Turbidity_: 112, TSS_mg_l_: 220, COD: 86.4, BOD_mg_l_: 15.6, TS_mg_l_: 854, Chloride_m: 46.96, Nitrate: 2.023, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Nakki Ghat", pH: 5.44, Temperatur: "29.05°C", EC__S_cm_: 1331, TDS_ppm_: 666, DO_mg_L_: 28.55, Turbidity_: 70.2, TSS_mg_l_: 234, COD: 86.4, BOD_mg_l_: 18.65, TS_mg_l_: 900, Chloride_m: 49.96, Nitrate: 2.653, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Koniya (Sitla Mata Mandir)", pH: 5.45, Temperatur: "24.46°C", EC__S_cm_: 1271, TDS_ppm_: 635, DO_mg_L_: 26.6, Turbidity_: 112, TSS_mg_l_: 194, COD: 102.4, BOD_mg_l_: 17.1, TS_mg_l_: 829, Chloride_m: 49.96, Nitrate: 1.061, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Sail putri (Puranapul)", pH: 5.46, Temperatur: "28.32°C", EC__S_cm_: 1314, TDS_ppm_: 657, DO_mg_L_: 21.1, Turbidity_: 77.6, TSS_mg_l_: 12, COD: 64, BOD_mg_l_: 13.95, TS_mg_l_: 669, Chloride_m: 46.96, Nitrate: 1893, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Sail putri (Puranapul)", pH: 5.46, Temperatur: "28.32°C", EC__S_cm_: 1312, TDS_ppm_: 656, DO_mg_L_: 22.9, Turbidity_: 144, TSS_mg_l_: 32, COD: 86.4, BOD_mg_l_: 14.7, TS_mg_l_: 688, Chloride_m: 50.96, Nitrate: 1.923, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Paraspur Bhejwariya", pH: 5.7, Temperatur: "27.93°C", EC__S_cm_: 1334, TDS_ppm_: 667, DO_mg_L_: 0.18, Turbidity_: 77, TSS_mg_l_: 0.39, COD: 205.1, BOD_mg_l_: 20.75, TS_mg_l_: 667.39, Chloride_m: 44.66, Nitrate: "N/A", Faecal_Col: "81,000-100,000", Total_Coli: "150,000-180,000" },
  { Location: "Imiliya ghaat", pH: 5.89, Temperatur: "25.19°C", EC__S_cm_: 1362, TDS_ppm_: 681, DO_mg_L_: 19.25, Turbidity_: 141, TSS_mg_l_: 174, COD: 76.8, BOD_mg_l_: 12.75, TS_mg_l_: 855, Chloride_m: 50.96, Nitrate: 1.117, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Imiliya ghaat", pH: 5.9, Temperatur: "25.22°C", EC__S_cm_: 1363, TDS_ppm_: 682, DO_mg_L_: 17.7, Turbidity_: 63, TSS_mg_l_: 24, COD: 96, BOD_mg_l_: 11.35, TS_mg_l_: 706, Chloride_m: 58.95, Nitrate: 1.541, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Kotawaan 2,(Tadiya)", pH: 5.92, Temperatur: "26.31°C", EC__S_cm_: 1216, TDS_ppm_: 608, DO_mg_L_: 11.05, Turbidity_: 51.8, TSS_mg_l_: 250, COD: 86.4, BOD_mg_l_: 8.2, TS_mg_l_: 858, Chloride_m: 44.96, Nitrate: 2.058, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Kotawaan 1, (chittauni)", pH: 5.92, Temperatur: "26.69°C", EC__S_cm_: 868, TDS_ppm_: 434, DO_mg_L_: 5.05, Turbidity_: 34.2, TSS_mg_l_: 228, COD: 80, BOD_mg_l_: 5.7, TS_mg_l_: 662, Chloride_m: 49.96, Nitrate: 2.122, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Kotawaan 2,(Tadiya)", pH: 5.93, Temperatur: "26.30°C", EC__S_cm_: 1215, TDS_ppm_: 608, DO_mg_L_: 9.15, Turbidity_: 47, TSS_mg_l_: 188, COD: 76.8, BOD_mg_l_: 7.65, TS_mg_l_: 796, Chloride_m: 34.97, Nitrate: 1.671, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Gate No. 5, Phulwariya", pH: 5.95, Temperatur: "26.20°C", EC__S_cm_: 1171, TDS_ppm_: 586, DO_mg_L_: 13, Turbidity_: 53.8, TSS_mg_l_: 18, COD: 76.8, BOD_mg_l_: 9.3, TS_mg_l_: 604, Chloride_m: 49.96, Nitrate: 2.058, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Gate No. 5, Phulwariya", pH: 5.96, Temperatur: "26.72°C", EC__S_cm_: 1401, TDS_ppm_: 701, DO_mg_L_: 15.15, Turbidity_: 75.7, TSS_mg_l_: 94, COD: 76.8, BOD_mg_l_: 10.3, TS_mg_l_: 795, Chloride_m: 59.95, Nitrate: 1.886, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Kotawaan 1, (chittauni)", pH: 5.98, Temperatur: "26.61°C", EC__S_cm_: 1188, TDS_ppm_: 594, DO_mg_L_: 7.15, Turbidity_: 66.9, TSS_mg_l_: 392, COD: 64, BOD_mg_l_: 6.95, TS_mg_l_: 986, Chloride_m: 19.98, Nitrate: 1.204, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Rameshwaram Temple", pH: 5.98, Temperatur: "27.90°C", EC__S_cm_: 775, TDS_ppm_: 387, DO_mg_L_: 2.95, Turbidity_: 4.8, TSS_mg_l_: 22, COD: 60.8, BOD_mg_l_: 2.6, TS_mg_l_: 409, Chloride_m: 29.98, Nitrate: 1.623, Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Dharaura pul", pH: 6.95, Temperatur: "27.90°C", EC__S_cm_: 1490, TDS_ppm_: 714, DO_mg_L_: 0.23, Turbidity_: 148, TSS_mg_l_: 0.55, COD: 253.3, BOD_mg_l_: 18.1, TS_mg_l_: 714.55, Chloride_m: 60.54, Nitrate: "N/A", Faecal_Col: "26,000-34,000", Total_Coli: "55,000-65,000" },
  { Location: "Dhraura", pH: 7.25, Temperatur: "30.70°C", EC__S_cm_: 1441, TDS_ppm_: 720, DO_mg_L_: 1.6, Turbidity_: 68.7, TSS_mg_l_: 0.456, COD: 190.4, BOD_mg_l_: 19.05, TS_mg_l_: 720.456, Chloride_m: 56.75, Nitrate: "N/A", Faecal_Col: "11,000-16,000", Total_Coli: "21,000-33,000" },
  { Location: "Dhraura", pH: 7.28, Temperatur: "30.50°C", EC__S_cm_: 1515, TDS_ppm_: 758, DO_mg_L_: 0.82, Turbidity_: 55.9, TSS_mg_l_: 0.32, COD: 61.1, BOD_mg_l_: 17.25, TS_mg_l_: 758.32, Chloride_m: 59.41, Nitrate: "N/A", Faecal_Col: "21,000-27,000", Total_Coli: "41,000-55,000" },
  { Location: "Mai Bridge", pH: 7.32, Temperatur: "27.70°C", EC__S_cm_: 674, TDS_ppm_: 337, DO_mg_L_: 5.3, Turbidity_: 8.5, TSS_mg_l_: 0.33, COD: 107.1, BOD_mg_l_: 16.5, TS_mg_l_: 337.33, Chloride_m: 33.75, Nitrate: "N/A", Faecal_Col: "11,000-17,000", Total_Coli: "24,000-32,000" },
  { Location: "Morwa", pH: 7.32, Temperatur: "26.30°C", EC__S_cm_: 543, TDS_ppm_: 209, DO_mg_L_: 3.41, Turbidity_: 14.6, TSS_mg_l_: 0.643, COD: 40, BOD_mg_l_: 6.49, TS_mg_l_: 209.643, Chloride_m: 41.97, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Dhraura", pH: 7.49, Temperatur: "28.80°C", EC__S_cm_: 1520, TDS_ppm_: 760, DO_mg_L_: 0.51, Turbidity_: 129, TSS_mg_l_: 0.194, COD: 211.2, BOD_mg_l_: 24.25, TS_mg_l_: 760.194, Chloride_m: 63.51, Nitrate: "N/A", Faecal_Col: "93,000-110,000", Total_Coli: "180,000-220,000" },
  { Location: "Rameshwaram Temple", pH: 7.54, Temperatur: "30.80°C", EC__S_cm_: 650, TDS_ppm_: 325, DO_mg_L_: 5.43, Turbidity_: 5, TSS_mg_l_: 0.374, COD: 141.5, BOD_mg_l_: 20.5, TS_mg_l_: 325.374, Chloride_m: 40.54, Nitrate: "N/A", Faecal_Col: "18,000-25,000", Total_Coli: "35,000-45,000" },
  { Location: "Lashkar Bhemnagar", pH: 7.6, Temperatur: "30.81°C", EC__S_cm_: 1044, TDS_ppm_: 522, DO_mg_L_: 0.5, Turbidity_: 499, TSS_mg_l_: 0.362, COD: 94.1, BOD_mg_l_: 17.64, TS_mg_l_: 522.362, Chloride_m: 49.63, Nitrate: "N/A", Faecal_Col: "15,000-22,000", Total_Coli: "30,000-40,000" },
  { Location: "Lashkar Bhemnagar", pH: 7.64, Temperatur: "30.67°C", EC__S_cm_: 997, TDS_ppm_: 498, DO_mg_L_: 2.01, Turbidity_: 59.3, TSS_mg_l_: 0.456, COD: 105.2, BOD_mg_l_: 15.84, TS_mg_l_: 498.456, Chloride_m: 50.64, Nitrate: "N/A", Faecal_Col: "17,000-19,000", Total_Coli: "50,000-64,000" },
  { Location: "Dharaura pul", pH: 7.67, Temperatur: "28.50°C", EC__S_cm_: 1245, TDS_ppm_: 567, DO_mg_L_: 1.54, Turbidity_: 76.8, TSS_mg_l_: 0.308, COD: 136.8, BOD_mg_l_: 21.6, TS_mg_l_: 567.308, Chloride_m: 48.63, Nitrate: "N/A", Faecal_Col: "16,000-23,000", Total_Coli: "31,000-45,000" },
  { Location: "Varuna (US) Before morwa", pH: 7.73, Temperatur: "25.50°C", EC__S_cm_: 560, TDS_ppm_: 205, DO_mg_L_: 3.32, Turbidity_: 15.5, TSS_mg_l_: 0.523, COD: 237.4, BOD_mg_l_: 3.79, TS_mg_l_: 205.523, Chloride_m: 28.98, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Purapul (Vatsalya Bridge)(US)", pH: 7.75, Temperatur: "27.63°C", EC__S_cm_: 1174, TDS_ppm_: 587, DO_mg_L_: 4.74, Turbidity_: 150, TSS_mg_l_: 0.48, COD: 28, BOD_mg_l_: 0.6, TS_mg_l_: 587.48, Chloride_m: 55.95, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Lashkar Bhemnagar", pH: 7.75, Temperatur: "29.43°C", EC__S_cm_: 1263, TDS_ppm_: 631, DO_mg_L_: 0.62, Turbidity_: 59.3, TSS_mg_l_: 0.846, COD: 221.1, BOD_mg_l_: 21.7, TS_mg_l_: 631.846, Chloride_m: 50.62, Nitrate: "N/A", Faecal_Col: "60,000-100,000", Total_Coli: "130,000-120,000" },
  { Location: "Koirajpur Drain(US)", pH: 7.75, Temperatur: "31.65°C", EC__S_cm_: 795, TDS_ppm_: 398, DO_mg_L_: 6.14, Turbidity_: 46.7, TSS_mg_l_: 0.466, COD: 80.6, BOD_mg_l_: 6.8, TS_mg_l_: 398.466, Chloride_m: 55.9, Nitrate: "N/A", Faecal_Col: "15,000-17,000", Total_Coli: "40,000-49,000" },
  { Location: "Kuri Drain(US)", pH: 7.79, Temperatur: "34.41°C", EC__S_cm_: 664, TDS_ppm_: 332, DO_mg_L_: 4.17, Turbidity_: 16.8, TSS_mg_l_: 0.187, COD: 100.6, BOD_mg_l_: 9.5, TS_mg_l_: 332.187, Chloride_m: 54.8, Nitrate: "N/A", Faecal_Col: "17,000-20,000", Total_Coli: "46,000-50,000" },
  { Location: "Koirajpur Drain", pH: 7.8, Temperatur: "27.88°C", EC__S_cm_: 1058, TDS_ppm_: 52.9, DO_mg_L_: 1.76, Turbidity_: 72.8, TSS_mg_l_: 0.496, COD: 450.5, BOD_mg_l_: 21.87, TS_mg_l_: 53.396, Chloride_m: 69, Nitrate: "N/A", Faecal_Col: "50,000-55,000", Total_Coli: "164,000-170,000" },
  { Location: "Ojhapur Jamalapur US", pH: 7.82, Temperatur: "35.14°C", EC__S_cm_: 428, TDS_ppm_: 214, DO_mg_L_: 22.5, Turbidity_: 2.31, TSS_mg_l_: 0.452, COD: 71.6, BOD_mg_l_: 28.9, TS_mg_l_: 214.452, Chloride_m: 292, Nitrate: "N/A", Faecal_Col: "52,000-55,000", Total_Coli: "100,000-150,000" },
  { Location: "Purapul (Vatsalya Bridge)(DS)", pH: 7.84, Temperatur: "28.30°C", EC__S_cm_: 1185, TDS_ppm_: 577, DO_mg_L_: 4.54, Turbidity_: 190, TSS_mg_l_: 0.44, COD: 88, BOD_mg_l_: 2.85, TS_mg_l_: 577.44, Chloride_m: 48.96, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Ojhapur Jamalapur Drain", pH: 7.87, Temperatur: "30.87°C", EC__S_cm_: 2134, TDS_ppm_: 1067, DO_mg_L_: 0.76, Turbidity_: 113, TSS_mg_l_: 0.614, COD: 170.6, BOD_mg_l_: 51.3, TS_mg_l_: 1067.614, Chloride_m: 348, Nitrate: "N/A", Faecal_Col: "200,000-210,000", Total_Coli: "350,000-500,000" },
  { Location: "Masjidiya ghat Drain(DS)", pH: 7.89, Temperatur: "33.07°C", EC__S_cm_: 911, TDS_ppm_: 456, DO_mg_L_: 7.27, Turbidity_: 23.9, TSS_mg_l_: 0.346, COD: 150.4, BOD_mg_l_: 15.6, TS_mg_l_: 456.346, Chloride_m: 59, Nitrate: "N/A", Faecal_Col: "21,000-23,000", Total_Coli: "42,000-45,000" },
  { Location: "Koirajpur Drain(DS)", pH: 7.89, Temperatur: "30.61°C", EC__S_cm_: 845, TDS_ppm_: 422, DO_mg_L_: 5.06, Turbidity_: 68.1, TSS_mg_l_: 0.522, COD: 160.6, BOD_mg_l_: 20.9, TS_mg_l_: 422.522, Chloride_m: 54.7, Nitrate: "N/A", Faecal_Col: "47,000-48,000", Total_Coli: "60,000-65,000" },
  { Location: "Bikapur Drain", pH: 7.9, Temperatur: "25.88°C", EC__S_cm_: 691, TDS_ppm_: 345, DO_mg_L_: 1.01, Turbidity_: 33.5, TSS_mg_l_: 0.678, COD: 50.9, BOD_mg_l_: 45.8, TS_mg_l_: 345.678, Chloride_m: 432, Nitrate: "N/A", Faecal_Col: "250,000-260,000", Total_Coli: "450,000-600,000" },
  { Location: "Masjidiya ghat Drain", pH: 7.94, Temperatur: "29.35°C", EC__S_cm_: 1358, TDS_ppm_: 679, DO_mg_L_: 1.11, Turbidity_: 169, TSS_mg_l_: 0.604, COD: 300.6, BOD_mg_l_: 60.7, TS_mg_l_: 679.604, Chloride_m: 76.9, Nitrate: "N/A", Faecal_Col: "40,000-45,000", Total_Coli: "230,000-240,000" },
  { Location: "Kuri Drain", pH: 7.94, Temperatur: "31.78°C", EC__S_cm_: 1291, TDS_ppm_: 645, DO_mg_L_: 0.83, Turbidity_: 646, TSS_mg_l_: 0.32, COD: 289.6, BOD_mg_l_: 50.7, TS_mg_l_: 645.32, Chloride_m: 71.9, Nitrate: "N/A", Faecal_Col: "30,000-45,000", Total_Coli: "175,000-179,000" },
  { Location: "Ojhapur Jamalapur DS", pH: 7.94, Temperatur: "33.72°C", EC__S_cm_: 471, TDS_ppm_: 236, DO_mg_L_: 2.35, Turbidity_: 14, TSS_mg_l_: 0.412, COD: 165.8, BOD_mg_l_: 40.7, TS_mg_l_: 236.412, Chloride_m: 344, Nitrate: "N/A", Faecal_Col: "23,000-26,000", Total_Coli: "45,000-70,000" },
  { Location: "Jogipur Drain", pH: 7.96, Temperatur: "29.96°C", EC__S_cm_: 747, TDS_ppm_: 373, DO_mg_L_: 0.67, Turbidity_: 113, TSS_mg_l_: 0.641, COD: 36.7, BOD_mg_l_: 39.6, TS_mg_l_: 373.641, Chloride_m: 227, Nitrate: "N/A", Faecal_Col: "38,000-40,000", Total_Coli: "75,000-100,000" },
  { Location: "Bikapur US", pH: 7.98, Temperatur: "26.56°C", EC__S_cm_: 423, TDS_ppm_: 218, DO_mg_L_: 1.51, Turbidity_: 423, TSS_mg_l_: 0.431, COD: 96.6, BOD_mg_l_: 30.8, TS_mg_l_: 218.431, Chloride_m: 356, Nitrate: "N/A", Faecal_Col: "32,000-40,000", Total_Coli: "60,000-100,000" },
  { Location: "Kalikadham Drain(DS)", pH: 7.99, Temperatur: "35.26°C", EC__S_cm_: 687, TDS_ppm_: 344, DO_mg_L_: 5.17, Turbidity_: 4.2, TSS_mg_l_: 0.506, COD: 180.6, BOD_mg_l_: 18.98, TS_mg_l_: 344.506, Chloride_m: 54.9, Nitrate: "N/A", Faecal_Col: "25,000-26,000", Total_Coli: "93,000-95,000" },
  { Location: "Bikapur DS", pH: 7.99, Temperatur: "24.64°C", EC__S_cm_: 928, TDS_ppm_: 464, DO_mg_L_: 1.56, Turbidity_: 90.9, TSS_mg_l_: 0.467, COD: 102.8, BOD_mg_l_: 32.5, TS_mg_l_: 464.467, Chloride_m: 323, Nitrate: "N/A", Faecal_Col: "65,000-70,000", Total_Coli: "120,000-180,000" },
  { Location: "Jogipur US", pH: 7.99, Temperatur: "28.13°C", EC__S_cm_: 2348, TDS_ppm_: 1174, DO_mg_L_: 0.8, Turbidity_: 17.6, TSS_mg_l_: 0.321, COD: 39.1, BOD_mg_l_: 20.9, TS_mg_l_: 1174.321, Chloride_m: 181, Nitrate: "N/A", Faecal_Col: "13,000-15,000", Total_Coli: "25,000-40,000" },
  { Location: "Siriuili DS", pH: 8.01, Temperatur: "33.68°C", EC__S_cm_: 364, TDS_ppm_: 182, DO_mg_L_: 1.6, Turbidity_: 11.2, TSS_mg_l_: 0.543, COD: 116.1, BOD_mg_l_: 18.9, TS_mg_l_: 182.543, Chloride_m: 264, Nitrate: "N/A", Faecal_Col: "20,000-25,000", Total_Coli: "40,000-60,000" },
  { Location: "Siriuili US", pH: 8.02, Temperatur: "33.44°C", EC__S_cm_: 532, TDS_ppm_: 265, DO_mg_L_: 1.27, Turbidity_: 1.6, TSS_mg_l_: 0.431, COD: 36.7, BOD_mg_l_: 17.6, TS_mg_l_: 265.431, Chloride_m: 143, Nitrate: "N/A", Faecal_Col: "12,000-16,000", Total_Coli: "25,000-35,000" },
  { Location: "Masjidiya ghat Drain(US)", pH: 8.04, Temperatur: "32.02°C", EC__S_cm_: 916, TDS_ppm_: 458, DO_mg_L_: 6.45, Turbidity_: 32.4, TSS_mg_l_: 0.53, COD: 70.4, BOD_mg_l_: 5.7, TS_mg_l_: 458.53, Chloride_m: 64, Nitrate: "N/A", Faecal_Col: "30,000-32,000", Total_Coli: "102,000-120,000" },
  { Location: "Deeh Koiran DS", pH: 8.04, Temperatur: "31.56°C", EC__S_cm_: 1371, TDS_ppm_: 685, DO_mg_L_: 0.87, Turbidity_: 17.5, TSS_mg_l_: 0.342, COD: 48.5, BOD_mg_l_: 38.4, TS_mg_l_: 685.342, Chloride_m: 123, Nitrate: "N/A", Faecal_Col: "10,000-20,000", Total_Coli: "25,000-50,000" },
  { Location: "Kalikadham Drain", pH: 8.07, Temperatur: "33.77°C", EC__S_cm_: 1362, TDS_ppm_: 682, DO_mg_L_: 1.11, Turbidity_: 98.6, TSS_mg_l_: 0.542, COD: 350.8, BOD_mg_l_: 70.6, TS_mg_l_: 682.542, Chloride_m: 65.9, Nitrate: "N/A", Faecal_Col: "45,000-50,000", Total_Coli: "120,000-124,000" },
  { Location: "Kalikadham Drain(US)", pH: 8.09, Temperatur: "35.75°C", EC__S_cm_: 619, TDS_ppm_: 305, DO_mg_L_: 5.11, Turbidity_: 14.2, TSS_mg_l_: 0.458, COD: 90.66, BOD_mg_l_: 6.9, TS_mg_l_: 305.458, Chloride_m: 56, Nitrate: "N/A", Faecal_Col: "12,000-14,000", Total_Coli: "25,000-28,000" },
  { Location: "Anangpur (Beda Factory)", pH: 8.1, Temperatur: "31.88°C", EC__S_cm_: 1932, TDS_ppm_: 966, DO_mg_L_: 0.12, Turbidity_: 47.4, TSS_mg_l_: 0.524, COD: 160.6, BOD_mg_l_: 50.1, TS_mg_l_: 966.524, Chloride_m: 40, Nitrate: "N/A", Faecal_Col: "89,000-95,000", Total_Coli: "150,000-250,000" },
  { Location: "Jogipur DS", pH: 8.1, Temperatur: "33.34°C", EC__S_cm_: 2293, TDS_ppm_: 1147, DO_mg_L_: 2.02, Turbidity_: 12, TSS_mg_l_: 0.354, COD: 34.5, BOD_mg_l_: 36.3, TS_mg_l_: 1147.354, Chloride_m: 203, Nitrate: "N/A", Faecal_Col: "33,000-35,000", Total_Coli: "65,000-90,000" },
  { Location: "Deeh Koiran Drain", pH: 8.15, Temperatur: "29.43°C", EC__S_cm_: 1828, TDS_ppm_: 914, DO_mg_L_: 0.33, Turbidity_: 61.6, TSS_mg_l_: 0.613, COD: 61.6, BOD_mg_l_: 24.1, TS_mg_l_: 914.613, Chloride_m: 151, Nitrate: "N/A", Faecal_Col: "32,000-40,000", Total_Coli: "60,000-100,000" },
  { Location: "Morwa+Varuna (DS)", pH: 8.17, Temperatur: "25.30°C", EC__S_cm_: 559, TDS_ppm_: 210, DO_mg_L_: 3.21, Turbidity_: 15.2, TSS_mg_l_: 0.441, COD: 98, BOD_mg_l_: 8.21, TS_mg_l_: 210.441, Chloride_m: 38.97, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Siriuili Drain", pH: 8.19, Temperatur: "34.12°C", EC__S_cm_: 5356, TDS_ppm_: 2678, DO_mg_L_: 0.97, Turbidity_: 393, TSS_mg_l_: 0.59, COD: 190.9, BOD_mg_l_: 40.4, TS_mg_l_: 2678.59, Chloride_m: 270, Nitrate: "N/A", Faecal_Col: "45,000-50,000", Total_Coli: "80,000-95,000" },
  { Location: "Deeh Koiran US", pH: 8.24, Temperatur: "31.82°C", EC__S_cm_: 1334, TDS_ppm_: 667, DO_mg_L_: 0.85, Turbidity_: 32.4, TSS_mg_l_: 0.592, COD: 51.1, BOD_mg_l_: 34.9, TS_mg_l_: 667.592, Chloride_m: 92, Nitrate: "N/A", Faecal_Col: "20,000-30,000", Total_Coli: "40,000-75,000" },
  { Location: "Basuhi Varuna Sangam (Jadupur Z.Bhari)", pH: 8.36, Temperatur: "27.84°C", EC__S_cm_: 624, TDS_ppm_: 312, DO_mg_L_: 7.23, Turbidity_: 24.3, TSS_mg_l_: 0.186, COD: 118.8, BOD_mg_l_: 3.04, TS_mg_l_: 312.186, Chloride_m: 38.97, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" },
  { Location: "Jaruna Bridge", pH: 8.5, Temperatur: "32.77°C", EC__S_cm_: 344, TDS_ppm_: 172, DO_mg_L_: 9.05, Turbidity_: 128, TSS_mg_l_: 0.253, COD: 194.2, BOD_mg_l_: 4.32, TS_mg_l_: 172.253, Chloride_m: 13.99, Nitrate: "N/A", Faecal_Col: "N/A", Total_Coli: "N/A" }
];

const industrialData = [
  { type: 'Textile/Yarn', count: 54, location: 'Bhadohi (50)', status: 'High Impact' },
  { type: 'Saree Printing', count: 33, location: 'Varanasi (33)', status: 'High Impact' },
  { type: 'Metal Surface Treatment', count: 23, location: 'Varanasi (23)', status: 'Medium Impact' },
  { type: 'Small-scale Industries', count: 867, location: 'Varanasi', status: 'Critical Impact', discharge: '9.13 MLD' },
  { type: 'Slaughterhouses', count: 3, location: 'Various', status: 'Low Impact' },
  { type: 'Food & Beverage', count: 3, location: 'Various', status: 'Low Impact' }
];

const drainData = [
  { name: 'Kutchehari Bridge Drain', status: 'Untapped', pollution: 'Critical', BOD_contribution: 22, priority: 1 },
  { name: 'Daniyalpur Drain', status: 'Untapped', pollution: 'High', BOD_contribution: 12, priority: 2 },
  { name: 'Nai Bazar Drain', status: 'Untapped', pollution: 'Medium', BOD_contribution: 8, priority: 3 },
  { name: 'Koirajpur Bridge Drain', status: 'Untapped', pollution: 'Medium', BOD_contribution: 6, priority: 4 },
  { name: 'Connected Drains (7)', status: 'Tapped', pollution: 'Controlled', BOD_contribution: 15, priority: 'N/A' }
];

const predictionData = [
  { timeframe: 'Next 7 days', BOD_forecast: 65, confidence: 85, trend: 'Increasing' },
  { timeframe: 'Next 30 days', BOD_forecast: 72, confidence: 75, trend: 'Increasing' },
  { timeframe: 'Next 90 days', BOD_forecast: 58, confidence: 65, trend: 'Monsoon Dilution' },
  { timeframe: 'Next 180 days', BOD_forecast: 45, confidence: 55, trend: 'Seasonal Variation' }
];

const interventionData = [
  { intervention: 'Connect Kutchehari Drain', cost: 8, impact: 22, timeline: 60, roi: 2.75 },
  { intervention: 'Shutdown 15 Worst Industries', cost: 2, impact: 28, timeline: 30, roi: 14.0 },
  { intervention: 'Connect Daniyalpur Drain', cost: 5, impact: 12, timeline: 45, roi: 2.4 },
  { intervention: 'Install Emergency Oxygenation', cost: 1.5, impact: 8, timeline: 15, roi: 5.33 },
  { intervention: 'Build CETP for Bhadohi', cost: 45, impact: 15, timeline: 365, roi: 0.33 }
];

// Enhanced detailed data for statistics
const statisticsDetailData = {
  riverLength: {
    title: "🌊 River Length Details",
    subtitle: "Comprehensive river network analysis",
    data: [
      { segment: "Main River Channel", length: "105 km", condition: "Moderate", tributaries: 3 },
      { segment: "Major Tributaries", length: "65 km", condition: "Variable", tributaries: 8 },
      { segment: "Minor Tributaries", length: "30 km", condition: "Poor", tributaries: 15 },
      { segment: "Seasonal Streams", length: "20 km", condition: "Intermittent", tributaries: 12 }
    ],
    summary: {
      total: "220 km total network",
      monitored: "200 km actively monitored",
      critical: "45 km critically polluted"
    }
  },
  districts: {
    title: "📍 District Coverage Details",
    subtitle: "Administrative and jurisdictional information",
    data: [
      { 
        district: "Prayagraj", 
        population: "6.1 million", 
        riverLength: "25 km", 
        stations: 1, 
        industries: 15,
        status: "Moderate Impact",
        keyIssues: "Urban runoff, religious activities"
      },
      { 
        district: "Bhadohi", 
        population: "1.7 million", 
        riverLength: "85 km", 
        stations: 4, 
        industries: 54,
        status: "High Impact",
        keyIssues: "Textile industries, carpet weaving"
      },
      { 
        district: "Varanasi", 
        population: "4.2 million", 
        riverLength: "90 km", 
        stations: 7, 
        industries: 923,
        status: "Critical Impact",
        keyIssues: "Dense industrial zones, urban sewage"
      }
    ],
    summary: {
      totalPopulation: "12 million people",
      totalIndustries: "992 industries",
      adminComplexity: "3-tier governance system"
    }
  },
  monitoringStations: {
    title: "🔬 Monitoring Stations Network",
    subtitle: "Real-time water quality monitoring infrastructure",
    data: [
      { id: "VS-01", name: "Mahadev Mandir", district: "Prayagraj", status: "Active", parameters: 8, condition: "Moderate" },
      { id: "VS-02", name: "Mobi Deenpur Bridge", district: "Bhadohi", status: "Active", parameters: 8, condition: "Good" },
      { id: "VS-03", name: "Kusha Ghat-Godma Bridge", district: "Bhadohi", status: "Active", parameters: 8, condition: "Good" },
      { id: "VS-04", name: "Varuna U/s Dhaurahra", district: "Bhadohi", status: "Active", parameters: 8, condition: "Excellent" },
      { id: "VS-05", name: "Varuna D/s Nai Bazar", district: "Bhadohi", status: "Active", parameters: 8, condition: "Moderate" },
      { id: "VS-06", name: "Rameswaram Mandir", district: "Varanasi", status: "Active", parameters: 8, condition: "Good" },
      { id: "VS-07", name: "Koirajpur Bridge", district: "Varanasi", status: "Active", parameters: 8, condition: "Good" },
      { id: "VS-08", name: "Pishaura Bridge", district: "Varanasi", status: "Active", parameters: 8, condition: "Good" },
      { id: "VS-09", name: "Kutchehari Bridge", district: "Varanasi", status: "Alert", parameters: 8, condition: "Poor" },
      { id: "VS-10", name: "Downstream Confluence", district: "Varanasi", status: "Active", parameters: 6, condition: "Moderate" },
      { id: "VS-11", name: "Midstream Monitoring", district: "Bhadohi", status: "Maintenance", parameters: 8, condition: "Unknown" },
      { id: "VS-12", name: "Upstream Source", district: "Prayagraj", status: "Active", parameters: 8, condition: "Good" }
    ],
    summary: {
      operational: "11 stations operational",
      maintenance: "1 station under maintenance",
      coverage: "95% network coverage"
    }
  },
  basinArea: {
    title: "🏞️ Basin Area Analysis",
    subtitle: "Comprehensive watershed characteristics",
    data: [
      { category: "Urban Area", area: "425 km²", percentage: "13.5%", impact: "High pollution load", population: "8.2 million" },
      { category: "Agricultural Land", area: "1,890 km²", percentage: "60.2%", impact: "Fertilizer runoff", population: "2.8 million" },
      { category: "Industrial Zones", area: "185 km²", percentage: "5.9%", impact: "Toxic discharge", population: "0.3 million" },
      { category: "Forest Cover", area: "315 km²", percentage: "10.0%", impact: "Natural filtration", population: "0.1 million" },
      { category: "Water Bodies", area: "95 km²", percentage: "3.0%", impact: "Flood regulation", population: "- " },
      { category: "Barren/Others", area: "231 km²", percentage: "7.4%", impact: "Erosion source", population: "0.6 million" }
    ],
    summary: {
      totalArea: "3,141 km² watershed",
      rainfalPattern: "850-1200mm annual",
      landUseChange: "2.5% urban expansion annually"
    }
  }
};

// Water Quality Standards (CPCB)
const WATER_QUALITY_STANDARDS = {
  BOD: { excellent: 3, good: 6, poor: 10 },
  DO: { excellent: 6, good: 4, poor: 2 },
  pH: { min: 6.5, max: 8.5 }
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 2000 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = 0;
    const animate = (currentTime: number) => {
      if (startTime === 0) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{count}</span>;
};

// Enhanced Loading Skeleton
const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4"></div>
    <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2"></div>
  </div>
);

export default function VarunaRiverDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedParameter, setSelectedParameter] = useState('BOD');
  const [timeRange, setTimeRange] = useState('12months');
  const [alertsCount, setAlertsCount] = useState(0);
  const [alertDetails, setAlertDetails] = useState<Array<{
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    message: string;
    location?: string;
    value?: number;
    threshold?: number;
  }>>([]);
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  
  // New state for statistics details
  const [showStatDetails, setShowStatDetails] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  
  // ✅ NEW: Map functionality state
  const [showMap, setShowMap] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const alertRef = useRef<HTMLDivElement>(null);
  const statRef = useRef<HTMLDivElement>(null);
  
  // ✅ NEW: Map ref
  const mapRef = useRef<HTMLDivElement>(null);

  // ✅ NEW: Map handlers
  const handleMapNotification = (title: string, message: string, type = 'info') => {
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
  };

  const handleMapFeatureClick = (feature: any, layer: any) => {
    console.log('Map feature clicked:', feature);
  };

  // ✅ NEW: Filter data of Drain Water Quality Stations
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    setSelectedFilter(null); 
  }, [pathname]);


  const filteredDrainData = (() => {
    switch (selectedFilter) {
      case 'acidic':
        return drainWaterQualityData.filter(d => d.pH < 6.5);
      case 'lowDO':
        return drainWaterQualityData.filter(d => d.DO_mg_L_ < 4);
      case 'highBOD':
        return drainWaterQualityData.filter(d => d.BOD_mg_l_ > 10);
      case 'highCOD':
        return drainWaterQualityData.filter(d => d.COD > 100);
      case 'coliform':
        return drainWaterQualityData.filter(
          d =>
            (d.Faecal_Col && d.Faecal_Col !== 'N/A') ||
            (d.Total_Coli && d.Total_Coli !== 'N/A')
        );
      default:
        return drainWaterQualityData;
      }
    })();


  // ✅ NEW: Auto-load river data when map is shown
  useEffect(() => {
    if (showMap) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && window.loadGeoJSON) {
          window.loadGeoJSON('rivers', 'varuna');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showMap]);

  // ✅ NEW: AGGRESSIVELY hide map elements
  useEffect(() => {
    if (showMap) {
      const hideMapElements = () => {
        // Remove ALL unwanted elements
        const selectorsToHide = [
          // Download/Export buttons
          'button:contains("Download")',
          'button:contains("Export")', 
          'button:contains("Buffer")',
          '[title*="Download"]',
          '[title*="Export"]',
          
          // Specific positioned elements from your map component
          '.absolute.top-2.left-12',
          '.absolute.top-2.left-72', 
          '.absolute.right-2.top-140',
          '.absolute.right-2',
          '.absolute.top-44.right-10',
          '.absolute.top-213.left-30',
          
          // Compass and grid
          '#compass',
          '.leaflet-control-zoom',
          '.leaflet-control-attribution',
          
          // Any div that contains tools/controls on the right
          'div[class*="right-2"]',
          'div[class*="top-140"]',
          'div[class*="top-44"]'
        ];

        selectorsToHide.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el instanceof HTMLElement) {
                el.remove(); // Completely remove from DOM
              }
            });
          } catch (e) {
            // Ignore selector errors
          }
        });

        // Also find and remove by text content
        const allButtons = document.querySelectorAll('button');
        allButtons.forEach(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('download') || text.includes('export') || text.includes('buffer') || text.includes('zoom') || text.includes('home') || text.includes('locate') || text.includes('fullscreen')) {
            btn.remove();
          }
        });

        // Remove any div containing map controls (right side)
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
          const classes = div.className || '';
          if (classes.includes('absolute') && (classes.includes('right-2') || classes.includes('top-140') || classes.includes('top-44'))) {
            div.remove();
          }
        });
      };

      // Run multiple times with increasing delays
      const delays = [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
      const timers = delays.map(delay => setTimeout(hideMapElements, delay));

      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [showMap]);

  // Calculate real alerts based on water quality standards (HIGH PRIORITY ONLY)
  const calculateRealAlerts = () => {
    const alerts: Alert[] = [];

    // Check BOD violations (CRITICAL & HIGH ONLY)
    spatialData.forEach(station => {
      

      if (station.BOD > WATER_QUALITY_STANDARDS.BOD.poor) {
        alerts.push({
          type: 'BOD Critical',
          severity: 'Critical' as const,
          message: `BOD level critically high - Immediate action required`,
          location: station.station,
          value: station.BOD,
          threshold: WATER_QUALITY_STANDARDS.BOD.poor
        });
      } else if (station.BOD > WATER_QUALITY_STANDARDS.BOD.good) {
        alerts.push({
          type: 'BOD High',
          severity: 'High' as const,
          message: `BOD level above acceptable limit - Action needed`,
          location: station.station,
          value: station.BOD,
          threshold: WATER_QUALITY_STANDARDS.BOD.good
        });
      }

      // Check DO violations (CRITICAL & HIGH ONLY)
      if (station.DO < WATER_QUALITY_STANDARDS.DO.poor) {
        alerts.push({
          type: 'DO Critical',
          severity: 'Critical' as const,
          message: `Dissolved Oxygen critically low - Emergency intervention needed`,
          location: station.station,
          value: station.DO,
          threshold: WATER_QUALITY_STANDARDS.DO.poor
        });
      } else if (station.DO < WATER_QUALITY_STANDARDS.DO.good) {
        alerts.push({
          type: 'DO Low',
          severity: 'High' as const,
          message: `Dissolved Oxygen below acceptable level - Urgent attention required`,
          location: station.station,
          value: station.DO,
          threshold: WATER_QUALITY_STANDARDS.DO.good
        });
      }
    });
     // 🚨 Drain Water Alerts (NEW)
    drainWaterQualityData.forEach(site => {
      if (site.COD > 200) {
        alerts.push({
          type: 'Drain COD Critical',
          severity: 'Critical' as const,
          message: 'Drain COD above 200 - Extreme organic pollution',
          location: site.Location,
          value: site.COD,
          threshold: 200
        });
      }

      if (site.BOD_mg_l_ > 30) {
        alerts.push({
          type: 'Drain BOD Critical',
          severity: 'Critical' as const,
          message: 'Drain BOD extremely high - Hazardous condition',
          location: site.Location,
          value: site.BOD_mg_l_,
          threshold: 30
        });
      }

      if (site.DO_mg_L_ < 3) {
        alerts.push({
          type: 'Drain DO Critical',
          severity: 'Critical' as const,
          message: 'Drain DO extremely low - Dangerously low oxygen levels',
          location: site.Location,
          value: site.DO_mg_L_,
          threshold: 3
        });
      }
  });


    // Check industrial pollution (HIGH PRIORITY ONLY)
    const criticalIndustries = industrialData.filter(industry => 
      industry.status.includes('Critical') || industry.count > 500
    );
    if (criticalIndustries.length > 0) {
      alerts.push({
        type: 'Industrial Pollution',
        severity: 'High' as const,
        message: `${criticalIndustries[0]?.count || 0} small-scale industries without proper treatment - High pollution risk`,
        location: 'Varanasi District'
      });
    }

    // Only return HIGH and CRITICAL priority alerts
    return alerts.filter(alert => alert.severity === 'Critical' || alert.severity === 'High');
  };

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    // Calculate and set real alerts (fixed - no simulation)
    const alerts = calculateRealAlerts();
    setAlertDetails(alerts);
    setAlertsCount(alerts.length);
  }, []);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertRef.current && !alertRef.current.contains(event.target as Node)) {
        setShowAlertDetails(false);
      }
      if (statRef.current && !statRef.current.contains(event.target as Node)) {
        setShowStatDetails(false);
        setSelectedStat(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle statistic click
  const handleStatClick = (statType: string) => {
    setSelectedStat(statType);
    setShowStatDetails(true);
    setShowAlertDetails(false); // Close alerts if open
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'excellent': return 'text-emerald-700 bg-emerald-100 border-emerald-200';
      case 'good': return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'moderate': return 'text-amber-700 bg-amber-100 border-amber-200';
      case 'poor': return 'text-red-700 bg-red-100 border-red-200';
      case 'critical': return 'text-red-800 bg-red-200 border-red-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
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

  const TabButton = ({ id, label, isActive, onClick }: any) => (
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
      
      {/* ✅ NEW: GLOBAL STYLES TO COMPLETELY REMOVE MAP ELEMENTS */}
      <style jsx global>{`
        /* Completely hide and remove unwanted map elements */
        .absolute.top-2.left-12,
        .absolute.top-2.left-72,
        .absolute.right-2.top-140,
        .absolute.right-2,
        .absolute.top-44.right-10,
        .absolute.top-213.left-30,
        #compass,
        .leaflet-control-zoom,
        .leaflet-control-attribution {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
        }
        
        /* Hide any element containing these words */
        button[title*="Download"],
        button[title*="Export"],
        button[title*="Buffer"],
        *[class*="download"],
        *[class*="export"],
        *[class*="buffer"] {
          display: none !important;
          visibility: hidden !important;
        }
        
        /* Force hide any right-side positioned elements */
        div[class*="absolute"][class*="right-"],
        div[class*="right-2"],
        div[class*="top-140"],
        div[class*="top-44"] {
          display: none !important;
          visibility: hidden !important;
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

      {/* Enhanced Header Section */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-800 text-white rounded-2xl p-8 shadow-2xl border border-blue-500/20">
          <div className="flex justify-between items-center">
            <button
               onClick={() => window.location.href = '/'}
               className="bg-orange-500 text-blue-700 font-bold px-4 py-2 rounded-lg shadow hover:bg-blue-100"  >
                ⬅️ Back
              </button>
            <div>
             
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                🌊 Varuna River Management Dashboard
              </h1>
              <p className="text-blue-100 text-lg mb-4">Comprehensive Water Quality Monitoring & Decision Support System</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <span 
                  onClick={() => handleStatClick('riverLength')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                  title="Click for detailed river network information"
                >
                  200km River Length
                </span>
                <span 
                  onClick={() => handleStatClick('districts')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                  title="Click for district-wise coverage details"
                >
                  3 Districts Covered
                </span>
                <span 
                  onClick={() => handleStatClick('monitoringStations')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                  title="Click for monitoring station network details"
                >
                  12 Monitoring Stations
                </span>
                <span 
                  onClick={() => handleStatClick('basinArea')}
                  className="bg-blue-700/50 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium border border-blue-500/30 cursor-pointer hover:bg-blue-600/60 hover:scale-105 transition-all duration-300 hover:shadow-lg"
                  title="Click for watershed and basin area analysis"
                >
                  3141 km² Basin Area
                </span>
                {/* ✅ NEW: SHOW ON MAP BUTTON - Added here after Basin Area */}
                
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
                    <div className="text-2xl font-bold leading-none">{alertsCount}</div>
                    <div className="text-xs font-semibold opacity-90">CRITICAL ALERTS</div>
                  </div>
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
              
              {/* Super High Z-Index Alert Details Popup */}
              {showAlertDetails && (
                <div 
                  className="fixed top-4 right-4 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 max-h-[80vh] overflow-y-auto flex flex-col"
                  style={{ zIndex: 99999 }}
                >
                  <div className="popup flex flex-col" style={{ maxHeight: '80vh' }}>
                  {/* Header */}
                  <div className="p-4 border-b bg-gradient-to-r from-red-50 via-pink-50 to-red-50 rounded-t-2xl">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-bold text-red-800">🚨 Critical Alerts ({alertsCount})</h3>
                        <p className="text-sm text-red-600">High priority water quality issues</p>
                      </div>
                      <button 
                        onClick={() => setShowAlertDetails(false)}
                        className="text-red-500 hover:text-red-700 text-2xl font-bold transition-colors hover:bg-red-100 rounded-full w-8 h-8 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 150px)' }}>
                    {alertDetails.length > 0 ? (
                      alertDetails.map((alert, index) => (
                        <div key={index} className={`p-4 rounded-xl border-2 ${getSeverityColor(alert.severity)} hover:shadow-lg transition-all duration-300 transform hover:scale-102`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm">{alert.type}</span>
                            <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                              alert.severity === 'Critical' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
                              alert.severity === 'High' ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' :
                              alert.severity === 'Medium' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white' :
                              'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm mb-2 font-medium">{alert.message}</p>
                          {alert.location && (
                            <p className="text-xs text-gray-600 mb-1">📍 {alert.location}</p>
                          )}
                          {alert.value && alert.threshold && (
                            <div className="text-xs bg-gray-100 rounded-lg p-2 mt-2">
                              <span className="font-semibold">Current: {alert.value}</span> | 
                              <span className="font-semibold"> Threshold: {alert.threshold}</span>
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
                  
                  {/* Footer */}
                  <div className="p-3 border-t bg-gradient-to-r from-gray-50 to-blue-50 text-center rounded-b-2xl">
                    <p className="text-xs text-gray-600 font-medium">
                      Last updated: {new Date().toLocaleTimeString()} | Based on CPCB standards
                    </p>
                  </div>
                </div>
               </div> 
              )}
              
              <div className="text-blue-100 text-sm">
                Last Updated: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Details Popup */}
      {showStatDetails && selectedStat && (
        <div 
          ref={statRef}
          className="fixed top-4 left-4 right-4 max-w-4xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 max-h-[85vh] overflow-hidden"
          style={{ zIndex: 99998 }}
        >
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-blue-800">
                  {statisticsDetailData[selectedStat as keyof typeof statisticsDetailData]?.title}
                </h3>
                <p className="text-blue-600 mt-1">
                  {statisticsDetailData[selectedStat as keyof typeof statisticsDetailData]?.subtitle}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowStatDetails(false);
                  setSelectedStat(null);
                }}
                className="text-blue-500 hover:text-blue-700 text-3xl font-bold transition-colors hover:bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {statisticsDetailData[selectedStat as keyof typeof statisticsDetailData]?.data.map((item: any, index: number) => (
                <div key={index} className="p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 transform hover:scale-102 bg-gradient-to-br from-white to-blue-50">
                  {selectedStat === 'riverLength' && (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-gray-800">{item.segment}</h4>
                        <span className="text-lg font-bold text-blue-600">{item.length}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Condition:</span>
                          <span className={`font-semibold ${
                            item.condition === 'Good' ? 'text-green-600' :
                            item.condition === 'Moderate' ? 'text-yellow-600' :
                            item.condition === 'Poor' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>{item.condition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tributaries:</span>
                          <span className="font-semibold text-gray-700">{item.tributaries}</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {selectedStat === 'districts' && (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-gray-800">{item.district}</h4>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                          item.status.includes('Critical') ? 'bg-red-100 text-red-800' :
                          item.status.includes('High') ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{item.status}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Population:</span>
                          <span className="font-semibold text-gray-700">{item.population}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>River Length:</span>
                          <span className="font-semibold text-blue-600">{item.riverLength}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monitoring Stations:</span>
                          <span className="font-semibold text-green-600">{item.stations}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Industries:</span>
                          <span className="font-semibold text-red-600">{item.industries}</span>
                        </div>
                        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
                          <strong>Key Issues:</strong> {item.keyIssues}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {selectedStat === 'monitoringStations' && (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-600">{item.id} • {item.district}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                          item.status === 'Active' ? 'bg-green-100 text-green-800' :
                          item.status === 'Alert' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{item.status}</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span>Parameters:</span>
                          <span className="font-semibold text-blue-600">{item.parameters}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Water Quality:</span>
                          <span className={`font-semibold ${
                            item.condition === 'Excellent' ? 'text-emerald-600' :
                            item.condition === 'Good' ? 'text-green-600' :
                            item.condition === 'Moderate' ? 'text-yellow-600' :
                            item.condition === 'Poor' ? 'text-red-600' :
                            'text-gray-600'
                          }`}>{item.condition}</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {selectedStat === 'basinArea' && (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-gray-800">{item.category}</h4>
                        <span className="text-lg font-bold text-blue-600">{item.percentage}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Area:</span>
                          <span className="font-semibold text-gray-700">{item.area}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Population:</span>
                          <span className="font-semibold text-gray-700">{item.population}</span>
                        </div>
                        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
                          <strong>Impact:</strong> {item.impact}
                        </div>
                      </div>
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-1000" 
                          style={{ width: item.percentage }}
                        ></div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Summary Footer */}
          <div className="p-4 border-t bg-gradient-to-r from-gray-50 to-blue-50 rounded-b-2xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {Object.entries(statisticsDetailData[selectedStat as keyof typeof statisticsDetailData]?.summary || {}).map(([key, value]) => (
                <div key={key} className="text-center p-3 bg-white/70 rounded-lg">
                  <div className="font-bold text-gray-800 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                  <div className="text-blue-600 font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Map Section with VISIBLE Header */}
      {showMap && (
        <div className="flex flex-col lg:flex-row gap-6 mb-8 items-stretch">
          {/* 🔹 Left Side - Navigation Buttons */}
        <div className="w-full lg:w-1/2 flex">
         <div className="grid grid-cols-2 gap-y-15 gap-x-4 bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-xl border border-white/20 w-full h-full content-center">
          <TabButton id="overview" label="📊 Overview" isActive={activeTab === 'overview'} onClick={setActiveTab}  />
          <TabButton id="water-quality" label="💧 Water Quality" isActive={activeTab === 'water-quality'} onClick={setActiveTab}  />
          <TabButton id="pollution-sources" label="🏭 Pollution Sources" isActive={activeTab === 'pollution-sources'} onClick={setActiveTab}  />
          <TabButton id="predictions" label="🔮 Predictions" isActive={activeTab === 'predictions'} onClick={setActiveTab} />
          <TabButton id="interventions" label="⚡ Interventions" isActive={activeTab === 'interventions'} onClick={setActiveTab}  />
          <TabButton id="system-dynamics" label="🔄 System Dynamics" isActive={activeTab === 'system-dynamics'} onClick={setActiveTab}  />
           <TabButton id="change-detection" label="🛰️ Change Detection" isActive={activeTab === 'change-detection'} onClick={(id:string) => {
            if (id === 'change-detection') {
              window.open('https://dssiitbhu.users.earthengine.app/view/changedetection', '_blank');
              setActiveTab(id);
            } else {
              setActiveTab(id);
            }
          }} />
        </div>
      </div>
        {/*right column:map section */}
        <div ref={mapRef} className="w-full lg:w-1/2 animate-fadeIn"
        
        >
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            
            {/* ✅ DEFINITELY VISIBLE Map Header */}
            <div 
              className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 flex justify-between items-center"
              style={{ 
                position: 'relative',
                zIndex: 10,
                display: 'flex !important',
                visibility: 'visible',
                opacity: 1
              }}
            >
              <div>
                <h2 className="text-xl font-bold">🌊 Varuna River Network Map</h2>
                {/* <p className="text-blue-100 text-sm">Interactive visualization of 200km river network</p> */}
              </div>
              <div className="flex items-center space-x-3">
                {/* Data Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.loadGeoJSON) {
                        window.loadGeoJSON('rivers', 'varuna');
                      }
                    }}
                    className="bg-blue-700/50 hover:bg-blue-600 px-3 py-1 rounded text-sm transition-colors border border-blue-500/30"
                  >
                    🌊 River
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.loadGeoJSON) {
                        window.loadGeoJSON('watershed', 'varuna');
                      }
                    }}
                    className="bg-green-700/50 hover:bg-green-600 px-3 py-1 rounded text-sm transition-colors border border-green-500/30"
                  >
                    🏞️ Watershed
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.loadGeoJSON) {
                        window.loadGeoJSON('drains', 'varuna');
                      }
                    }}
                    className="bg-cyan-700/50 hover:bg-cyan-600 px-3 py-1 rounded text-sm transition-colors border border-cyan-500/30"
                  >
                    🚰 Drains
                  </button>
                </div>
              </div>
            </div>
            
            {/* Clean Map Container */}
            <div className="h-96 relative overflow-hidden">
              <Map
                sidebarCollapsed={true}
                onFeatureClick={handleMapFeatureClick}
                currentLayer={null}
                activeFeature={null}
                compassVisible={false}
                gridVisible={false}
                showNotification={handleMapNotification}
              />
            </div>
            
            {/* Info Footer */}
            <div className="p-3 bg-gray-50 border-t text-center">
              <p className="text-xs text-gray-600">
                🗺️ Use buttons above to load data layers • Mouse to zoom/pan
              </p>
            </div>
          </div>
        </div>
       </div> 
      )}

      {/* Enhanced Navigation Tabs */}
      {/* ✅ Two-column layout: Buttons left, Map right */}
      

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Enhanced Key Metrics */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 col-span-full border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                🎯 Key Performance Indicators
              </h2>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                <span className="text-sm font-medium text-gray-600">Live Data</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <div className="group p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  <AnimatedCounter value={6.62} />
                </div>
                <div className="text-sm font-semibold text-red-800 mb-1">Worst BOD (mg/l)</div>
                <div className="text-xs text-gray-600">Kutchehari Bridge</div>
                <div className="mt-3 w-full bg-red-200 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full w-4/5"></div>
                </div>
              </div>

              <div className="group p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  <AnimatedCounter value={4.1} />
                </div>
                <div className="text-sm font-semibold text-blue-800 mb-1">Lowest DO (mg/l)</div>
                <div className="text-xs text-gray-600">Kutchehari Bridge</div>
                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full w-3/5"></div>
                </div>
              </div>

              <div className="group p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  <AnimatedCounter value={867} />
                </div>
                <div className="text-sm font-semibold text-orange-800 mb-1">Small Industries</div>
                <div className="text-xs text-gray-600">Varanasi District</div>
                <div className="mt-3 w-full bg-orange-200 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full w-full"></div>
                </div>
              </div>

              <div className="group p-6 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-yellow-600 mb-2">
                  <AnimatedCounter value={11} />
                </div>
                <div className="text-sm font-semibold text-yellow-800 mb-1">Untapped Drains</div>
                <div className="text-xs text-gray-600">Need Connection</div>
                <div className="mt-3 w-full bg-yellow-200 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full w-2/3"></div>
                </div>
              </div>

              <div className="group p-6 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-emerald-600 mb-2">
                  <AnimatedCounter value={9.13} />
                </div>
                <div className="text-sm font-semibold text-emerald-800 mb-1">MLD Discharge</div>
                <div className="text-xs text-gray-600">Small Industries</div>
                <div className="mt-3 w-full bg-emerald-200 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full w-4/5"></div>
                </div>
              </div>

              <div className="group p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  ₹<AnimatedCounter value={22} />
                </div>
                <div className="text-sm font-semibold text-purple-800 mb-1">Cr Investment</div>
                <div className="text-xs text-gray-600">Drain Connections</div>
                <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full w-3/4"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Quick Status */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              🚨 Critical Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200 hover:shadow-lg transition-all duration-300">
                <span className="font-semibold text-gray-800">Kutchehari Bridge</span>
                <span className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-sm font-bold pulse-glow">
                  CRITICAL
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 hover:shadow-lg transition-all duration-300">
                <span className="font-semibold text-gray-800">Industrial Discharge</span>
                <span className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  HIGH
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200 hover:shadow-lg transition-all duration-300">
                <span className="font-semibold text-gray-800">Seasonal Variation</span>
                <span className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                  MEDIUM
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced District Comparison */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              📍 District-wise Impact
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { district: 'Prayagraj', pollution: 25, industries: 5 },
                { district: 'Bhadohi', pollution: 40, industries: 52 },
                { district: 'Varanasi', pollution: 85, industries: 923 }
              ]}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="district" />
                <YAxis />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="pollution" fill="url(#colorGradient)" name="Pollution Level" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Enhanced Temporal Trend */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              📈 BOD Trend (12 Months)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={temporalData}>
                <defs>
                  <linearGradient id="bodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="BOD" stroke="#ef4444" strokeWidth={3} fill="url(#bodGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'water-quality' && (
        <div className="space-y-8">
          {/* Enhanced Parameter Selection */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                💧 Water Quality Analysis
              </h2>
              <div className="flex gap-4">
                <select 
                  value={selectedParameter} 
                  onChange={(e) => setSelectedParameter(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="BOD">BOD (mg/l)</option>
                  <option value="COD">COD (mg/l)</option>
                  <option value="DO">DO (mg/l)</option>
                  <option value="pH">pH</option>
                  <option value="temp">Temperature (°C)</option>
                </select>
                <select 
                  value={timeRange} 
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="border-2 border-gray-200 rounded-xl px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="12months">Last 12 Months</option>
                  <option value="6months">Last 6 Months</option>
                  <option value="3months">Last 3 Months</option>
                </select>
              </div>
            </div>

            {/* Enhanced Temporal Chart */}
            <div className="mb-8">
              <h3 className="font-semibold mb-4 text-lg">Temporal Variation - {selectedParameter}</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={temporalData}>
                  <defs>
                    <linearGradient id="parameterGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis />
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
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Enhanced Station-wise Comparison */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              📍 Station-wise Water Quality Status
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left p-4 font-semibold">Station</th>
                    <th className="text-left p-4 font-semibold">District</th>
                    <th className="text-left p-4 font-semibold">DO (mg/l)</th>
                    <th className="text-left p-4 font-semibold">BOD (mg/l)</th>
                    <th className="text-left p-4 font-semibold">COD (mg/l)</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {spatialData.map((station, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition-all duration-300">
                      <td className="p-4 font-medium">{station.station}</td>
                      <td className="p-4">{station.district}</td>
                      <td className="p-4 font-semibold">{station.DO}</td>
                      <td className="p-4 font-semibold">{station.BOD}</td>
                      <td className="p-4 font-semibold">{station.COD}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(station.status)}`}>
                          {station.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* NEW: Drain Water Quality Stations */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">

            <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🚰 DRAIN WATER QUALITY STATIONS
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
                <option value="acidic">24 Acidic pH Sites</option>
                <option value="lowDO">32 Low DO Sites</option>
                <option value="highBOD">51 High BOD Sites</option>
                <option value="highCOD">27 High COD Sites</option>
                <option value="coliform">38 Coliform Positive</option>
              </select>
            </div>
          </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">
                📊 Showing {filteredDrainData.length} drain monitoring locations
                <span className="ml-2 text-xs bg-blue-100 px-2 py-1 rounded-full">
                  Temp Range: 24.4°C - 35.8°C
                </span>
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                    <th className="text-left p-3 font-semibold min-w-[200px]">Location</th>
                    <th className="text-left p-3 font-semibold">pH</th>
                    <th className="text-left p-3 font-semibold">Temp</th>
                    <th className="text-left p-3 font-semibold">EC (μS/cm)</th>
                    <th className="text-left p-3 font-semibold">TDS (ppm)</th>
                    <th className="text-left p-3 font-semibold">DO (mg/L)</th>
                    <th className="text-left p-3 font-semibold">Turbidity</th>
                    <th className="text-left p-3 font-semibold">TSS (mg/L)</th>
                    <th className="text-left p-3 font-semibold">COD</th>
                    <th className="text-left p-3 font-semibold">BOD (mg/L)</th>
                    <th className="text-left p-3 font-semibold">TS (mg/L)</th>
                    <th className="text-left p-3 font-semibold">Chloride</th>
                    <th className="text-left p-3 font-semibold">Nitrate</th>
                    <th className="text-left p-3 font-semibold">Faecal Col</th>
                    <th className="text-left p-3 font-semibold">Total Col</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrainData.map((drain, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-300">
                      <td className="p-3 font-medium text-gray-800">{drain.Location}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          drain.pH < 6.5 ? 'text-red-600' : 
                          drain.pH > 8.5 ? 'text-red-600' : 
                          'text-green-600'
                        }`}>
                          {drain.pH}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-blue-600">{drain.Temperatur}</td>
                      <td className="p-3">{drain.EC__S_cm_}</td>
                      <td className="p-3">{drain.TDS_ppm_}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          drain.DO_mg_L_ < 4 ? 'text-red-600' : 
                          drain.DO_mg_L_ < 6 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {drain.DO_mg_L_}
                        </span>
                      </td>
                      <td className="p-3">{drain.Turbidity_}</td>
                      <td className="p-3">{drain.TSS_mg_l_}</td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          drain.COD > 100 ? 'text-red-600' : 
                          drain.COD > 50 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {drain.COD}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-semibold ${
                          drain.BOD_mg_l_ > 10 ? 'text-red-600' : 
                          drain.BOD_mg_l_ > 6 ? 'text-yellow-600' : 
                          'text-green-600'
                        }`}>
                          {drain.BOD_mg_l_}
                        </span>
                      </td>
                      <td className="p-3">{drain.TS_mg_l_}</td>
                      <td className="p-3">{drain.Chloride_m}</td>
                      <td className="p-3">{typeof drain.Nitrate === 'number' ? drain.Nitrate : 'N/A'}</td>
                      <td className="p-3">
                        <span className={`text-xs ${
                          drain.Faecal_Col !== 'N/A' ? 'text-red-600 font-semibold bg-red-50 px-2 py-1 rounded' : 'text-gray-500'
                        }`}>
                          {drain.Faecal_Col}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs ${
                          drain.Total_Coli !== 'N/A' ? 'text-red-600 font-semibold bg-red-50 px-2 py-1 rounded' : 'text-gray-500'
                        }`}>
                          {drain.Total_Coli}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Water Quality Summary for Drains */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainWaterQualityData.filter(d => d.pH < 6.5).length}
                </div>
                <div className="text-sm font-semibold text-red-800">Acidic pH Sites</div>
                <div className="text-xs text-red-600">pH &lt; 6.5</div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-orange-600">
                  {drainWaterQualityData.filter(d => d.DO_mg_L_ < 4).length}
                </div>
                <div className="text-sm font-semibold text-orange-800">Low DO Sites</div>
                <div className="text-xs text-orange-600">DO &lt; 4 mg/L</div>
              </div>
              
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainWaterQualityData.filter(d => d.BOD_mg_l_ > 10).length}
                </div>
                <div className="text-sm font-semibold text-red-800">High BOD Sites</div>
                <div className="text-xs text-red-600">BOD &gt; 10 mg/L</div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-purple-600">
                  {drainWaterQualityData.filter(d => d.COD > 100).length}
                </div>
                <div className="text-sm font-semibold text-purple-800">High COD Sites</div>
                <div className="text-xs text-purple-600">COD &gt; 100 mg/L</div>
              </div>
              
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                <div className="text-2xl font-bold text-red-600">
                  {drainWaterQualityData.filter(d => d.Faecal_Col !== 'N/A' && d.Faecal_Col !== ' ').length}
                </div>
                <div className="text-sm font-semibold text-red-800">Coliform Positive</div>
                <div className="text-xs text-red-600">Bacterial Contamination</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pollution-sources' && (
        <div className="space-y-8">
          {/* Enhanced Industrial Sources */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              🏭 Industrial Pollution Sources
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced Industry Breakdown */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">Industry Distribution</h3>
                <div className="space-y-4">
                  {industrialData.map((industry, index) => (
                    <div key={index} className="group flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 transform hover:scale-102">
                      <div>
                        <div className="font-semibold text-gray-800">{industry.type}</div>
                        <div className="text-sm text-gray-600">{industry.location}</div>
                        {industry.discharge && (
                          <div className="text-sm text-red-600 font-medium">Discharge: {industry.discharge}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{industry.count}</div>
                        <div className={`text-xs px-3 py-1 rounded-full font-bold ${
                          industry.status.includes('Critical') ? 'bg-red-100 text-red-800' :
                          industry.status.includes('High') ? 'bg-orange-100 text-orange-800' :
                          industry.status.includes('Medium') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {industry.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Pie Chart */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">Industry Type Distribution</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={industrialData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {industrialData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={50}
                       content={({payload}) => {
                       
                       return (
                       <ul style={{ fontSize: '12px', listStyleType: 'none', padding: 0 }}>
                       {payload?.map((entry, index) => {
                       const item = entry.payload as any; // ✅ Now 'item' is your original data object
                       return (
                       <li key={`item-${index}`} style={{ color: entry.color }}>
                       {`${item.type}: ${item.count}`}
                       </li>
                      );
                    })}
                  </ul>
                      );
                    }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Enhanced Drain Management */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              🚰 Sewage Drain Status
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-4 text-lg">Drain Connection Priority</h3>
                <div className="space-y-4">
                  {drainData.map((drain, index) => (
                    <div key={index} className="border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 transform hover:scale-102 bg-gradient-to-r from-white to-blue-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-semibold text-gray-800">{drain.name}</div>
                        <div className="text-sm bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full font-bold">
                          Priority: {drain.priority}
                        </div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mb-3">
                        <span>Status: <span className="font-medium">{drain.status}</span></span>
                        <span>BOD Contribution: <span className="font-bold text-red-600">{drain.BOD_contribution}%</span></span>
                      </div>
                      <div className="mt-3">
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                          drain.pollution === 'Critical' ? 'bg-red-100 text-red-800' :
                          drain.pollution === 'High' ? 'bg-orange-100 text-orange-800' :
                          drain.pollution === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {drain.pollution} Pollution
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4 text-lg">BOD Contribution by Source</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={drainData.filter(d => d.priority !== 'N/A')}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={120}
                      fontSize={12}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="BOD_contribution" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-8">
          {/* Enhanced Prediction Dashboard */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              📊 Water Quality Trend Analysis
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced Forecast Chart */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">BOD Forecast (Next 6 Months)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    ...temporalData.slice(-3),
                    { month: 'Jul-10', BOD: 65, forecast: true },
                    { month: 'Aug-10', BOD: 72, forecast: true },
                    { month: 'Sep-10', BOD: 58, forecast: true },
                    { month: 'Oct-10', BOD: 52, forecast: true },
                    { month: 'Nov-10', BOD: 45, forecast: true },
                    { month: 'Dec-10', BOD: 48, forecast: true }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="BOD" 
                      stroke="#2563eb" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: '#2563eb', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Enhanced Prediction Summary */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">Prediction Summary</h3>
                <div className="space-y-4">
                  {predictionData.map((pred, index) => (
                    <div key={index} className="bg-gradient-to-r from-gray-50 to-blue-50 p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-semibold text-gray-800">{pred.timeframe}</span>
                        <span className="text-2xl font-bold text-blue-600">{pred.BOD_forecast} mg/l</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Confidence: <span className="font-bold text-green-600">{pred.confidence}%</span></span>
                        <span>Trend: <span className="font-medium">{pred.trend}</span></span>
                      </div>
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000" 
                          style={{ width: `${pred.confidence}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Scenario Analysis */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              📊 Scenario Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <h3 className="font-bold text-red-800 mb-3 text-lg">Worst Case Scenario</h3>
                <p className="text-sm text-red-700 mb-4">No interventions implemented</p>
                <div className="text-4xl font-bold text-red-600 mb-2">
                  <AnimatedCounter value={95} /> mg/l
                </div>
                <div className="text-sm text-red-600 font-medium">BOD by Dec 2025</div>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <h3 className="font-bold text-yellow-800 mb-3 text-lg">Current Trajectory</h3>
                <p className="text-sm text-yellow-700 mb-4">Limited interventions</p>
                <div className="text-4xl font-bold text-yellow-600 mb-2">
                  <AnimatedCounter value={72} /> mg/l
                </div>
                <div className="text-sm text-yellow-600 font-medium">BOD by Dec 2025</div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <h3 className="font-bold text-green-800 mb-3 text-lg">Best Case Scenario</h3>
                <p className="text-sm text-green-700 mb-4">All interventions successful</p>
                <div className="text-4xl font-bold text-green-600 mb-2">
                  <AnimatedCounter value={35} /> mg/l
                </div>
                <div className="text-sm text-green-600 font-medium">BOD by Dec 2025</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'interventions' && (
        <div className="space-y-8">
          {/* Enhanced Cost-Benefit Analysis */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              ⚡ Intervention Cost-Benefit Analysis
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced ROI Chart */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">Return on Investment (ROI)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={interventionData}>
                    <defs>
                      <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="intervention" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="roi" fill="url(#roiGradient)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Enhanced Impact vs Cost */}
              <div>
                <h3 className="font-semibold mb-4 text-lg">Impact vs Cost Analysis</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={interventionData}>
                    <defs>
                      <linearGradient id="impactGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      </linearGradient>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="intervention" hide />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area type="monotone" dataKey="impact" stackId="1" stroke="#2563eb" fill="url(#impactGradient)" />
                    <Area type="monotone" dataKey="cost" stackId="2" stroke="#ef4444" fill="url(#costGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Enhanced Priority Matrix */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              🎯 Intervention Priority Matrix
            </h2>
            <div className="space-y-6">
              {interventionData.map((intervention, index) => (
                <div key={index} className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-102 bg-gradient-to-r from-white to-blue-50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{intervention.intervention}</h3>
                      <div className="flex space-x-6 text-sm text-gray-600 mt-2">
                        <span>Cost: <span className="font-bold text-red-600">₹{intervention.cost} Cr</span></span>
                        <span>Impact: <span className="font-bold text-green-600">{intervention.impact}% BOD reduction</span></span>
                        <span>Timeline: <span className="font-bold text-blue-600">{intervention.timeline} days</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">ROI: {intervention.roi}x</div>
                      <div className={`text-xs px-3 py-1 rounded-full font-bold ${
                        intervention.roi > 5 ? 'bg-green-100 text-green-800' :
                        intervention.roi > 2 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {intervention.roi > 5 ? 'High Priority' : intervention.roi > 2 ? 'Medium Priority' : 'Low Priority'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced progress bar for visual impact */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-1000" 
                      style={{ width: `${(intervention.impact / 30) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'system-dynamics' && (
        <div className="space-y-8">
          {/* Enhanced Mental Map Visualization */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🔄 System Dynamics Models
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced Feedback Loops */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                <h3 className="font-bold mb-4 text-lg">🔁 Key Feedback Loops Identified</h3>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                    <h4 className="font-semibold text-red-800 mb-2">Reinforcing Loop: Encroachment ↔ Water Availability</h4>
                    <p className="text-sm text-red-700">
                      Reduced water availability → More encroachment → Further capacity reduction → 
                      Even less water availability
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                    <h4 className="font-semibold text-blue-800 mb-2">Balancing Loop: Water Quality ↔ Extraction</h4>
                    <p className="text-sm text-blue-700">
                      Poor quality → Limited extraction → Less pressure → Potential for improvement
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-4 hover:shadow-lg transition-all duration-300">
                    <h4 className="font-semibold text-green-800 mb-2">Tourism-Pollution Loop</h4>
                    <p className="text-sm text-green-700">
                      Tourism growth → Industrial demand → Pollution increase → Tourism impact
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced System Components */}
              <div className="bg-gradient-to-br from-gray-50 to-green-50 rounded-xl p-6 border border-gray-200">
                <h3 className="font-bold mb-4 text-lg">🧩 System Components</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">Surface Water</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">Stock</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">Groundwater</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">Stock</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">River Pollution</span>
                    <span className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold">Stock</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">Industrial Discharge</span>
                    <span className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">Flow</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">Agricultural Runoff</span>
                    <span className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">Flow</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300">
                    <span className="text-sm font-medium">Treatment Capacity</span>
                    <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold">Flow</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Policy Scenarios */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              🎛️ Policy Scenario Testing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-br from-white to-blue-50">
                <h3 className="font-bold mb-3 text-lg">Scenario A: Industrial Focus</h3>
                <p className="text-sm text-gray-600 mb-4">Prioritize industrial pollution control</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>BOD Reduction:</span>
                    <span className="font-bold text-green-600 text-lg">40%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Timeline:</span>
                    <span className="font-semibold">2 years</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Investment:</span>
                    <span className="font-semibold">₹50 Cr</span>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-br from-white to-green-50">
                <h3 className="font-bold mb-3 text-lg">Scenario B: Infrastructure Focus</h3>
                <p className="text-sm text-gray-600 mb-4">Prioritize sewage infrastructure</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>BOD Reduction:</span>
                    <span className="font-bold text-green-600 text-lg">35%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Timeline:</span>
                    <span className="font-semibold">3 years</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Investment:</span>
                    <span className="font-semibold">₹80 Cr</span>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-br from-white to-purple-50">
                <h3 className="font-bold mb-3 text-lg">Scenario C: Integrated Approach</h3>
                <p className="text-sm text-gray-600 mb-4">Balanced multi-sector intervention</p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>BOD Reduction:</span>
                    <span className="font-bold text-green-600 text-lg">60%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Timeline:</span>
                    <span className="font-semibold">4 years</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Investment:</span>
                    <span className="font-semibold">₹120 Cr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Footer */}
      <div className="mt-12 text-center bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <p className="text-gray-600 font-medium">Varuna River Management System | IIT (BHU) Varanasi | Smart Laboratory on Clean River</p>
      </div>
    </div>
  );
}

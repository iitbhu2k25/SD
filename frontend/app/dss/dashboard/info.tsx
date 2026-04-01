'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { X, Info } from 'lucide-react';

export type DashboardInfoKey =
  | 'story-map'
  | 'kpi-overview'
  | 'acidic-sites'
  | 'low-do-sites'
  | 'high-bod-sites'
  | 'high-cod-sites'
  | 'sewage-infrastructure'
  | 'critical-indices'
  | 'pollution-load-index'
  | 'eutrophication-risk'
  | 'bacterial-risk'
  | 'water-quality-analysis'
  | 'potential-pollution-sources'
  | 'trend-groundwater-depth'
  | 'trend-annual-rainfall'
  | 'trend-distribution-analysis'
  | 'trend-industrial-pollution'
  | 'water-quality-index'
  | 'river-water-quality-observations';

export interface DashboardInfoContent {
  title: string;
  points: string[];
}

const INFO_CONTENT: Record<DashboardInfoKey, DashboardInfoContent> = {
  'story-map': {
    title: 'Story Map',
    points: [
      'This story map is for the Varuna River Basin.',
      'Click Play to see it in story/video mode.',
      'The flow starts from origin and ends at confluence in Ganga.',
      'For each selected point, image and corresponding description are shown in the left panel.',
    ],
  },
  'kpi-overview': {
    title: 'Key Performance Indicators',
    points: [
      'Quick summary of major water-quality and infrastructure conditions.',
      'Values are calculated from current monitoring records.',
      'Clicking KPI cards opens related section/filter.',
    ],
  },
  'acidic-sites': {
    title: 'Acidic pH Sites',
    points: [
      'Counts monitoring points with acidic condition.',
      'Threshold used: pH < 6.0.',
      'Shows most acidic location and value.',
    ],
  },
  'low-do-sites': {
    title: 'Low DO Sites',
    points: [
      'Counts sites with very low dissolved oxygen.',
      'Threshold used: DO < 2 mg/L.',
      'Shows lowest observed DO location and value.',
    ],
  },
  'high-bod-sites': {
    title: 'High BOD Sites',
    points: [
      'Highlights priority wise pollution hotspots.',
      'select a category on priority dropdown to seee priority wise stations in table and map.',
      'Click on view icon to see corresponding station on map.',
    ],
  },
  'high-cod-sites': {
    title: 'High COD Sites',
    points: [
      'Highlights chemical pollution hotspots.',
      'Threshold used: COD > 100 mg/L.',
      'Shows highest COD location and value.',
    ],
  },
  'sewage-infrastructure': {
    title: 'Sewage Infrastructure',
    points: [
      'Shows tapped, partially tapped, untapped drains and STP count.',
      'Data is fetched from sewage infrastructure statistics.',
      'Click opens sewage infrastructure section.',
    ],
  },
  'critical-indices': {
    title: 'Critical Status - Calculated Indices',
    points: [
      'This panel combines three critical indicators in one place.',
      'Pollution Load Index: composite score from BOD, COD and oxygen deficit.',
      'Eutrophication Risk: based on nitrate, turbidity and low-oxygen stress.',
      'Bacterial Contamination: faecal-coliform based, with BOD proxy fallback.',
      'The highest-risk sites are surfaced to support intervention prioritization.',
    ],
  },
  'pollution-load-index': {
    title: 'Pollution Load Index',
    points: [
      'Composite index for organic/chemical load and oxygen deficit.',
      'Calculated from BOD, COD and DO deficit.',
      'Higher score means more severe pollution.',
    ],
  },
  'eutrophication-risk': {
    title: 'Eutrophication Risk',
    points: [
      'Indicates algae bloom and nutrient stress risk.',
      'Calculated from nitrate, turbidity and oxygen penalty.',
      'Higher score indicates higher eutrophication pressure.',
    ],
  },
  'bacterial-risk': {
    title: 'Bacterial Contamination',
    points: [
      'Represents microbial contamination risk at sites.',
      'Uses faecal coliform data where available.',
      'Uses BOD-based proxy when coliform values are missing.',
    ],
  },
  'water-quality-analysis': {
    title: 'Water Quality Analysis',
    points: [
      'Shows temporal/pointwise trend for selected parameter.',
      'You can switch between BOD, COD, DO, pH and Temperature.',
      'Chart is generated from processed monitoring station data.',
    ],
  },
  'potential-pollution-sources': {
    title: 'Potential Pollution Sources',
    points: [
      'Shows source categories that may contribute to pollution.',
      'Each card displays safe limit, highest observed value and location.',
      'Clicking a card opens detailed popup for that source.',
    ],
  },
  'trend-groundwater-depth': {
    title: 'Groundwater Depth Trend',
    points: [
      'Shows district-wise pre-monsoon and post-monsoon groundwater depth trends.',
      'Pre-Monsoon depth is shown in Green and Post-Monsoon depth is shown in Blue .',
      'Hover on charts to see year-wise values.',
    ],
  },
  'trend-annual-rainfall': {
    title: 'Annual Rainfall Trend',
    points: [
      'Shows district-wise annual rainfall trend across available years.',
      'Hover on charts to see rainfall values for a specific year.',
    ],
  },
  'trend-distribution-analysis': {
    title: 'Distribution Analysis',
    points: [
      'Shows year-wise category distribution in 3D-style pie charts.',
      'Each pie shows Critical, Over-Exploited, Safe, and Semi-Critical share.',
      'Click a pie slice to highlight and pin that category.',
    ],
  },
  'trend-industrial-pollution': {
    title: 'Pollution Inventory',
    points: [
      'Shows district-wise count of industrial records grouped by pollution-index band.',
      'Legend bands are Pollution Index: 0-25 (Blue), 25-55 (Green), 55-80 (Orange), 80-100 (Red).',
      'X-axis shows districts and Y-axis shows count of records in each band.',
    ],
  },
  'water-quality-index': {
    title: 'Water Quality Index',
    points: [
      'This section computes WQI using weighted arithmetic method across key parameters.',
      'Lower WQI indicates better water quality; higher WQI indicates pollution stress.',
      'Use filters and location list to inspect site-wise parameter contribution.',
    ],
  },
  'river-water-quality-observations': {
    title: 'River Water Quality Observations',
    points: [
      'This table shows station-wise river water observations for the selected year.',
      'You can apply quick filters for acidic pH, low DO, high BOD, high COD, and coliform-positive sites.',
      'Values help identify hotspot locations for targeted intervention.',
    ],
  },
};

export const getDashboardInfo = (key: DashboardInfoKey): DashboardInfoContent => INFO_CONTENT[key];

interface InfoPopupProps {
  content: DashboardInfoContent | null;
  anchor: HTMLElement | { x: number; y: number } | null;
  onClose: () => void;
}

export const InfoPopup: React.FC<InfoPopupProps> = ({ content, anchor, onClose }) => {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  useEffect(() => {
    if (!content) return;

    const handleOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [content, onClose]);

  useEffect(() => {
    if (!content || !anchor) {
      setAnchorRect(null);
      return;
    }

    const updateAnchor = () => {
      if (typeof (anchor as HTMLElement).getBoundingClientRect === 'function') {
        setAnchorRect((anchor as HTMLElement).getBoundingClientRect());
        return;
      }

      if (
        typeof anchor === 'object' &&
        anchor !== null &&
        'x' in anchor &&
        'y' in anchor &&
        typeof anchor.x === 'number' &&
        typeof anchor.y === 'number'
      ) {
        const pointX = anchor.x;
        const pointY = anchor.y;
        setAnchorRect({
          x: pointX,
          y: pointY,
          top: pointY,
          left: pointX,
          right: pointX,
          bottom: pointY,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect);
        return;
      }

      setAnchorRect(null);
    };

    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);

    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [anchor, content]);

  const position = useMemo(() => {
    if (!content || !anchorRect || typeof window === 'undefined') {
      return {
        style: { left: '50%', top: 120, transform: 'translateX(-50%)' as const },
        popupTop: 120,
        pointerLeft: 240,
      };
    }

    const popupWidth = Math.min(480, window.innerWidth - 24);
    const margin = 12;
    const anchorX = anchorRect.left + anchorRect.width / 2;
    const anchorY = anchorRect.bottom;
    const left = Math.min(Math.max(anchorX - popupWidth / 2, margin), window.innerWidth - popupWidth - margin);
    const top = Math.max(margin, anchorY + 14);

    const pointerLeft = Math.min(Math.max(anchorX - left, 24), popupWidth - 24);

    return {
      style: { left: `${left}px`, top, transform: 'none' as const },
      popupTop: top,
      pointerLeft,
    };
  }, [anchorRect, content]);

  const connector = useMemo(() => {
    if (!anchorRect || typeof window === 'undefined') return null;
    const anchorX = anchorRect.left + anchorRect.width / 2;
    const anchorY = anchorRect.bottom;
    const top = anchorY;
    const height = 14;
    return {
      left: anchorX - 1,
      anchorLeft: anchorX - 6,
      anchorTop: anchorY - 6,
      top,
      height,
    };
  }, [anchorRect, position]);

  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {anchorRect && connector && (
        <>
          <div
            className="fixed w-3 h-3 rounded-full bg-sky-200 border border-sky-400 shadow"
            style={{ left: connector.anchorLeft, top: connector.anchorTop }}
          />
          <div
            className="fixed bg-sky-300/80 w-[2px]"
            style={{ left: connector.left, top: connector.top, height: connector.height }}
          />
        </>
      )}
      <div
        ref={popupRef}
        className="pointer-events-auto fixed w-[min(480px,calc(100vw-24px))] max-h-[72vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-sky-100"
        style={position.style}
      >
        <div
          className="absolute w-4 h-4 bg-sky-50 border-sky-100 rotate-45 -top-2 border-l border-t"
          style={{ left: position.pointerLeft - 8 }}
        ></div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200">
              <Info size={15} />
            </div>
            <h3 className="text-lg font-bold text-sky-900">{content.title}</h3>
          </div>
          <button className="bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 p-2 rounded-full" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="p-5 bg-gradient-to-b from-white to-sky-50/40">
          <ul className="space-y-3">
            {content.points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3 rounded-xl border border-sky-100 bg-white px-3 py-2.5 shadow-sm">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center text-xs font-bold flex-shrink-0">i</span>
                <span className="text-sm text-gray-700 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

'use client';
import React, { useState } from 'react';

// ─── Small circular i-button ──────────────────────────────────────────────────
export const BasicModuleInfoButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="About Basic Module"
    style={{
      width: 24, height: 24, borderRadius: '50%',
      background: 'rgba(255,255,255,0.18)',
      border: '1.5px solid rgba(255,255,255,0.55)',
      color: '#fff',
      fontSize: 12, fontWeight: 800, lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0, padding: 0,
      transition: 'background .15s, box-shadow .15s',
      verticalAlign: 'middle', marginLeft: 10,
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.35)';
      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 4px rgba(255,255,255,0.15)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)';
      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
    }}
  >
    i
  </button>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
const MODULES = [
  {
    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe',
    title: 'Population Forecasting',
    body: 'Projects population from the base year (2011) to the design year using Arithmetic, Geometric, and Incremental Increase growth methods. Set interim years (e.g. 2021, 2031, 2041) and the tool interpolates intermediate values, accounting for rural-urban migration trends.',
  },
  {
    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    title: 'Year-wise Plot Graphs',
    body: 'Interactive charts display population growth curves, demand vs. supply timelines, and shortfall bands for each planning year. Toggle between Linear and Semi-log scales, export as PNG/SVG, and compare multiple scenario runs side by side.',
  },
  {
    color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd',
    title: 'Water Demand',
    body: 'Calculates domestic, commercial, industrial, and fire-fighting water demands per capita (CPHEEO norms). Outputs include daily, peak-hourly, and peak-daily demand, with deficit flags against existing source capacity and augmentation volume recommendations.',
  },
  {
    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0',
    title: 'Water Supply',
    body: 'Models distribution network adequacy — storage reservoirs, pumping stations, and transmission mains — for the forecasted demand. Supply coverage is computed zone-wise and overlaid on the map to identify underserved pockets.',
  },
  {
    color: '#b45309', bg: '#fffbeb', border: '#fde68a',
    title: 'Sewage & Sanitation',
    body: 'Estimates wastewater generation (typically 80% of water supply), designs the collection network, and sizes treatment plants (STP) using BOD/COD load calculations. Output includes network layout, land requirement for STP, and treated-effluent reuse potential.',
  },
];

const STEPS = ['Select Location', 'Confirm', 'Set Design Years', 'Population Forecast', 'Demand Graphs', 'Download Report'];

export const BasicModuleInfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 660,
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,.22)',
        animation: 'bmModalIn .2s ease-out',
      }}
    >
      <style>{`
        @keyframes bmModalIn {
          from { opacity:0; transform:scale(.95) translateY(10px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#1d4ed8 0%,#0284c7 100%)',
        borderRadius: '18px 18px 0 0',
        padding: '22px 26px 18px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '-.3px' }}>
            Basic Module
          </p>
          <p style={{ margin: 0, color: '#bae6fd', fontSize: 12.5 }}>
            Urban Infrastructure Planning &amp; Forecasting System
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 7,
            color: '#fff', fontSize: 17, width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          &#10005;
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
          The <strong>Basic Module</strong> is the foundation of the infrastructure planning tool.
          After confirming your location selection, it processes Census 2011 population data and
          runs sector-wise infrastructure projections for your chosen planning horizon.
        </p>

        {MODULES.map(card => (
          <div key={card.title} style={{
            background: card.bg,
            border: `1.5px solid ${card.border}`,
            borderLeft: `4px solid ${card.color}`,
            borderRadius: 12, padding: '13px 15px',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: card.color, fontSize: 13 }}>
              {card.title}
            </p>
            <p style={{ margin: 0, fontSize: 12.5, color: '#475569', lineHeight: 1.75 }}>
              {card.body}
            </p>
          </div>
        ))}

        {/* Workflow */}
        <div style={{
          background: '#f8fafc', border: '1.5px solid #e2e8f0',
          borderRadius: 12, padding: '12px 16px',
        }}>
          <p style={{ margin: '0 0 9px', fontWeight: 700, color: '#334155', fontSize: 12.5 }}>
            Workflow
          </p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {STEPS.map((step, i) => (
              <React.Fragment key={step}>
                <span style={{
                  background: '#e0f2fe', color: '#0369a1',
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                }}>
                  {step}
                </span>
                {i < STEPS.length - 1 && (
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>&#8594;</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Convenience wrapper hook ─────────────────────────────────────────────────
export function useBasicModuleInfo() {
  const [open, setOpen] = useState(false);
  const modal = open ? <BasicModuleInfoModal onClose={() => setOpen(false)} /> : null;
  return { open, openModal: () => setOpen(true), closeModal: () => setOpen(false), modal };
}
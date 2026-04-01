import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DSS Basic — Report',
  description: 'Comprehensive report: population, water demand, water supply and sewage generation.',
};

/**
 * This layout covers the root-level Header / Navbar / Footer with a fixed
 * full-screen overlay so the report opens as a completely standalone page.
 */
export default function ReportPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          #report-layout-wrapper {
            position: static !important;
            overflow: visible !important;
            z-index: auto !important;
            background: #fff !important;
          }
        }
      `}</style>
      <div
        id="report-layout-wrapper"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          overflowY: 'auto',
          background: '#f4f6fb',
        }}
      >
        {children}
      </div>
    </>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'River Resource Estimation | DSS',
  description: 'River water resource analysis and mapping.',
};

export default function RiverV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-50 relative">
      {children}
    </div>
  );
}

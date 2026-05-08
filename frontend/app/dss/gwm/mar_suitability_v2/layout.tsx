import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MAR Site Suitability v2",
  description: "Site suitability and priority analysis for Managed Aquifer Recharge (MAR) using administrative and river system selection flows.",
};

export default function MarSuitabilityV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-screen w-full flex-col overflow-hidden">
      {children}
    </section>
  );
}

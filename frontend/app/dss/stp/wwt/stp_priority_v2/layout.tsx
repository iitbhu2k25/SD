import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "STP Priority v2",
  description: "Site suitability and priority analysis for Sewage Treatment Plants using administrative and river system selection flows.",
};

export default function StpPriorityV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-screen w-full flex-col overflow-hidden">
      {children}
    </section>
  );
}

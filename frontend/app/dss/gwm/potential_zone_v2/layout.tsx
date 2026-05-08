import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groundwater Potential Zone v2",
  description: "Groundwater potential zone analysis using administrative and river system selection flows.",
};

export default function GwzPotentialV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-screen w-full flex-col overflow-hidden">
      {children}
    </section>
  );
}

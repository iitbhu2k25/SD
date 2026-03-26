import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "STP Suitability v2",
  description:
    "Site suitability analysis for Sewage Treatment Plants using administrative and river-system selection flows.",
};

export default function StpSuitabilityV2Layout({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="flex h-screen w-full flex-col overflow-hidden">{children}</section>;
}

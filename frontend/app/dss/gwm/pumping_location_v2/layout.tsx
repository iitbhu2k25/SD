import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Groundwater Pumping Location v2",
  description:
    "Groundwater pumping location and well-point analysis using administrative and river system selection flows.",
};

export default function GwmPumpingLocationV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="flex h-screen w-full flex-col overflow-hidden">{children}</section>;
}


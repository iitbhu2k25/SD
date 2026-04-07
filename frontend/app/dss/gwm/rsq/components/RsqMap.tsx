"use client";

import dynamic from "next/dynamic";

const RsqMapClient = dynamic(() => import("./RsqMapClient"), { ssr: false });

type RsqMapProps = {
  comparisonEnabled?: boolean;
};

export default function RsqMap({ comparisonEnabled = false }: RsqMapProps) {
  return <RsqMapClient comparisonEnabled={comparisonEnabled} />;
}

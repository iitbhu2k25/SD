"use client";
import GridSection from '@/app/dss/home/home_grid/GridSection';
import StepCardsGrid from '@/app/dss/home/cards/StepCards.Grid';
import HLSVideoPlayer from '@/components/HlsPlayer';
import HomeHeader from '@/app/dss/home/home_header/home_header';
export default function Home() {
  return (
    <div>
      <HomeHeader />
      <GridSection />
      <StepCardsGrid />
      <div
        className="w-full mx-auto"
        style={{
          backgroundImage: 'url("/Images/main_page.jpeg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <HLSVideoPlayer
          src="/Videos/master.m3u8"
        />
      </div>
    </div>);
}

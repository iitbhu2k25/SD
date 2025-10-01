import GridSection from '@/app/dss/home/home_grid/GridSection';
import GalleryCarousel from '@/app/dss/home/project_images/GalleryCarousel';
import StepCardsGrid from '@/app/dss/home/cards/StepCards.Grid';
import SocialGridSection from '@/app/dss/home/social/social';
import HLSVideoPlayer from '@/components/HlsPlayer';
export default function Home() {
    return(
   <div>
      <GridSection/>
      <StepCardsGrid/>
      <SocialGridSection/>
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
  
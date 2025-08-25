import GridSection from '@/app/dss/home/home_grid/GridSection';
import GalleryCarousel from '@/app/dss/home/project_images/GalleryCarousel';
import StepCardsGrid from '@/app/dss/home/cards/StepCards.Grid';
import SocialGridSection from '@/app/dss/home/social/social';
export default function Home() {
    return(
   <div>
      <GridSection/>
      <StepCardsGrid/>
      <SocialGridSection/>
      <GalleryCarousel/>
    </div>);
  }
  
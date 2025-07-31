import GridSection from '@/components/home/home_grid/GridSection';
import GalleryCarousel from '@/components/home/project_images/GalleryCarousel';
import StepCardsGrid from '@/components/home/cards/StepCards.Grid';
import SocialGridSection from '@/components/home/social/social';
export default function Home() {
    return(
   <div>
      <GridSection/>
      <StepCardsGrid/>
      <SocialGridSection/>
      <GalleryCarousel/>
    </div>);
  }
  
'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'



interface GalleryImage {
  id: string
  name: string
  url: string
}

interface GallerySection {
  id: string
  title: string
  subtitle: string
  images?: GalleryImage[]
}


const GALLERY_SECTIONS: GallerySection[] = [
  {
    id: 'drone', title: 'Drone Aerial Views', subtitle: 'Aerial Perspectives',
    images: [
      { id: 'd1', name: 'Drone View 1', url: '/Images/dashboard/gallery/drone/View1.png' },
      { id: 'd2', name: 'Drone View 2', url: '/Images/dashboard/gallery/drone/View2.png' },
      { id: 'd3', name: 'Drone View 3', url: '/Images/dashboard/gallery/drone/View3.png' },
      { id: 'd4', name: 'Drone View 4', url: '/Images/dashboard/gallery/drone/View4.png' },
      { id: 'd5', name: 'Drone View 5', url: '/Images/dashboard/gallery/drone/View5.png' },
      { id: 'd6', name: 'Drone View 6', url: '/Images/dashboard/gallery/drone/View6.png' },
      { id: 'd7', name: 'Drone View 7', url: '/Images/dashboard/gallery/drone/View7.png' },
    ],
  },
  {
    id: 'site_visit', title: 'Site Visits', subtitle: 'Ground Documentation',
    images: [
      { id: 'd1', name: 'Site View 1', url: '/Images/dashboard/gallery/site_visit/BLW_STP.jpeg' },
      { id: 'd2', name: 'Site View 2', url: '/Images/dashboard/gallery/site_visit/VARUNAPUL_NADESAR.jpeg' }
    ],
  },
  {
    id: 'sampling', title: 'Field Work', subtitle: 'Scientific Analysis',
    images: [
      { id: 'd1', name: 'sampling View 1', url: '/Images/dashboard/gallery/sampling/Picture1.jpg' },
      { id: 'd2', name: 'Sampling View 2', url: '/Images/dashboard/gallery/sampling/Picture2.jpg' },
      { id: 'd3', name: 'Sampling View 3', url: '/Images/dashboard/gallery/sampling/Picture3.jpeg' },
      { id: 'd4', name: 'Sampling View 4', url: '/Images/dashboard/gallery/sampling/Picture4.jpg' },
      { id: 'd5', name: 'Sampling View 5', url: '/Images/dashboard/gallery/sampling/Picture5.jpg' },
      { id: 'd6', name: 'Sampling View 6', url: '/Images/dashboard/gallery/sampling/Picture6.jpg' },
      { id: 'd7', name: 'Sampling View 7', url: '/Images/dashboard/gallery/sampling/Picture7.jpeg' },
    ],
  },
  {
    id: 'conferences', title: 'Events at SLCR', subtitle: 'Stakeholder Engagement',
    images: [
      { id: 'd1', name: 'conferences View 1', url: '/Images/dashboard/gallery/conferences/DSS__WORKSHOP.jpg' },
      { id: 'd2', name: 'conferences View 2', url: '/Images/dashboard/gallery/conferences/DSS_WORKSHOP__.jpg' },
      { id: 'd3', name: 'conferences View 3', url: '/Images/dashboard/gallery/conferences/DSS_WORKSHOP_.jpg' },
      { id: 'd4', name: 'conferences View 4', url: '/Images/dashboard/gallery/conferences/DSS_WORKSHOP.jpg' },
      { id: 'd5', name: 'conferences View 5', url: '/Images/dashboard/gallery/conferences/RHAR_2025.jpg' },
      { id: 'd6', name: 'conferences View 6', url: '/Images/dashboard/gallery/conferences/RHAR_conference_2025_.jpg' },
      { id: 'd7', name: 'conferences View 7', url: '/Images/dashboard/gallery/conferences/RHAR_conference_2025.jpg' },
      { id: 'd8', name: 'conferences View 8', url: '/Images/dashboard/gallery/conferences/WORKSHOP_ON_NATURE_BASED_SOLUTION_FOR_SMALL_RIVER_REJUVENATION.png' },
    ],
  },
  {
    id: 'activities', title: 'Visitors at SLCR', subtitle: 'Collaborative Efforts',
    images: [
      { id: 'd1', name: 'Activities View 1', url: '/Images/dashboard/gallery/activities/ISRO_MEMBERS.png' },
      { id: 'd2', name: 'Activities  View 2', url: '/Images/dashboard/gallery/activities/Mr_Dheeraj_Joshi_Director_NMCG_.jpeg' },
      { id: 'd3', name: 'Activities  View 3', url: '/Images/dashboard/gallery/activities/Mr_Dheeraj_Joshi_Director_NMCG_.png' },
      { id: 'd4', name: 'Activities  View 4', url: '/Images/dashboard/gallery/activities/Mr_Dheeraj_Joshi_Director_NMCG.jpeg' },
      { id: 'd5', name: 'Activities  View 5', url: '/Images/dashboard/gallery/activities/Mr_Dheeraj_Joshi_Director_NMCG.png' },
    ],
  },
  {
    id: 'outreach', title: 'SLCR Outreach', subtitle: 'Awareness Programs', images: [
      { id: 'd1', name: 'outreach View 1', url: '/Images/dashboard/gallery/outreach/NMCG_Review_Meeting_.jpeg' },
      { id: 'd2', name: 'outreach  View 2', url: '/Images/dashboard/gallery/outreach/NMCG_Review_Meeting.jpeg' },
    ]
  },
  {
    id: 'biodiversity', title: 'Biodiversity & Ecology', subtitle: 'Flora & Fauna', images: [

      { id: 'd1', name: 'aquatic plants', url: '/Images/dashboard/gallery/biodiversity/aquatic_plants.jpeg' },
      { id: 'd2', name: 'Asian openbill', url: '/Images/dashboard/gallery/biodiversity/Asian_openbill.jpeg' },
      { id: 'd3', name: 'Asian water snake', url: '/Images/dashboard/gallery/biodiversity/Asian_water_snake.jpg' },
      { id: 'd4', name: 'bamboo', url: '/Images/dashboard/gallery/biodiversity/bamboo.jpeg' },
      { id: 'd5', name: 'banyan', url: '/Images/dashboard/gallery/biodiversity/banyan.jpeg' },
      { id: 'd6', name: 'Bat', url: '/Images/dashboard/gallery/biodiversity/Bat.jpeg' },
      { id: 'd7', name: 'beetle', url: '/Images/dashboard/gallery/biodiversity/beetle.jpeg' },
      { id: 'd8', name: 'black drongo', url: '/Images/dashboard/gallery/biodiversity/black_drongo.jpeg' },
      { id: 'd9', name: 'butterfly', url: '/Images/dashboard/gallery/biodiversity/butterfly.jpeg' },
      { id: 'd10', name: 'carp', url: '/Images/dashboard/gallery/biodiversity/carp.jpeg' },
      { id: 'd11', name: 'caterpillar', url: '/Images/dashboard/gallery/biodiversity/caterpillar.jpeg' },
      { id: 'd12', name: 'cattail', url: '/Images/dashboard/gallery/biodiversity/cattail.jpeg' },
      { id: 'd13', name: 'Cattle egret', url: '/Images/dashboard/gallery/biodiversity/Cattle_egret.jpg' },
      { id: 'd14', name: 'cocklebur', url: '/Images/dashboard/gallery/biodiversity/cocklebur.jpeg' },
      { id: 'd15', name: 'Common kingfisher', url: '/Images/dashboard/gallery/biodiversity/Common_kingfisher.jpeg' },
      { id: 'd16', name: 'Cormorant', url: '/Images/dashboard/gallery/biodiversity/Cormorant.jpeg' },
      { id: 'd17', name: 'datura', url: '/Images/dashboard/gallery/biodiversity/datura.jpeg' },
      { id: 'd18', name: 'Grasshopper', url: '/Images/dashboard/gallery/biodiversity/Grasshopper.jpeg' },
      { id: 'd19', name: 'Frog', url: '/Images/dashboard/gallery/biodiversity/Frog.jpeg' },
      { id: 'd20', name: 'fungus', url: '/Images/dashboard/gallery/biodiversity/fungus.jpeg' },
      { id: 'd21', name: 'Garden lizard', url: '/Images/dashboard/gallery/biodiversity/Garden_lizard.jpeg' },
      { id: 'd22', name: 'Hydrophytes', url: '/Images/dashboard/gallery/biodiversity/hydrophytes.jpeg' },
      { id: 'd23', name: 'Indian Jujube', url: '/Images/dashboard/gallery/biodiversity/Indian_Jujube.jpeg' },
      { id: 'd24', name: 'Indian pond heron', url: '/Images/dashboard/gallery/biodiversity/Indian_pond_heron.jpeg' },
      { id: 'd25', name: 'Indian Roller', url: '/Images/dashboard/gallery/biodiversity/Indian_Roller.jpg' },
      { id: 'd26', name: 'klip daga', url: '/Images/dashboard/gallery/biodiversity/klip_daga.jpeg' },
      { id: 'd27', name: 'laughing dove', url: '/Images/dashboard/gallery/biodiversity/laughing_dove.jpeg' },
      { id: 'd28', name: 'Marsilea clover', url: '/Images/dashboard/gallery/biodiversity/Marsilea_clover.jpeg' },
      { id: 'd29', name: 'Metallic shield bug', url: '/Images/dashboard/gallery/biodiversity/Metallic_shield_bug.jpeg' },
      { id: 'd30', name: 'Mollusca', url: '/Images/dashboard/gallery/biodiversity/Mollusca.jpeg' },
      { id: 'd31', name: 'Myna', url: '/Images/dashboard/gallery/biodiversity/Myna.jpg' },
      { id: 'd32', name: 'Nilgai', url: '/Images/dashboard/gallery/biodiversity/Nilgai.jpg' },
      { id: 'd33', name: 'Oriental magpie robin', url: '/Images/dashboard/gallery/biodiversity/Oriental_magpie_Robin.jpeg' },
      { id: 'd34', name: 'Peacock', url: '/Images/dashboard/gallery/biodiversity/Peacock.jpeg' },
      { id: 'd35', name: 'Peahens', url: '/Images/dashboard/gallery/biodiversity/Peahens.jpeg' },
      { id: 'd36', name: 'plain tiger', url: '/Images/dashboard/gallery/biodiversity/plain_tiger.jpeg' },
      { id: 'd37', name: 'pond', url: '/Images/dashboard/gallery/biodiversity/pond.jpeg' },
      { id: 'd38', name: 'Red wattled lapwing', url: '/Images/dashboard/gallery/biodiversity/Red_wattled_lapwing.jpeg' },
      { id: 'd39', name: 'riparian vegetation', url: '/Images/dashboard/gallery/biodiversity/riparian_vegetation.jpeg' },
      { id: 'd40', name: 'Sarus Crane', url: '/Images/dashboard/gallery/biodiversity/Sarus_Crane.jpg' },
      { id: 'd41', name: 'toothache plant', url: '/Images/dashboard/gallery/biodiversity/toothache.jpeg' },
      { id: 'd42', name: 'water hen', url: '/Images/dashboard/gallery/biodiversity/water_hen.jpeg' },
      { id: 'd43', name: 'water strider', url: '/Images/dashboard/gallery/biodiversity/water_strider.jpeg' },
      { id: 'd44', name: 'Lady bug beetle', url: '/Images/dashboard/gallery/biodiversity/Lady_bug_beetle.jpeg' },
      { id: 'd45', name: 'water bird nest', url: '/Images/dashboard/gallery/biodiversity/water_birdnest.jpg' }

    ]
  },
]


const SidebarCard = ({
  section,
  isActive,
  onSelect,
}: {
  section: GallerySection
  isActive: boolean
  onSelect: (id: string) => void
}) => {
  const bgImage = section.images?.[0]?.url

  return (
    <div
      onClick={() => onSelect(section.id)}
      className={`
        relative h-24 rounded-2xl cursor-pointer overflow-hidden
        transition-all duration-300 group border
        ${isActive
          ? 'border-cyan-400 shadow-lg scale-[1.02]'
          : 'border-gray-200 hover:scale-[1.02]'}
      `}
    >
      {/* Background Image */}
      {bgImage && (
        <Image
          src={bgImage}
          alt={section.title}
          fill
          className="object-cover"
          sizes="300px"
        />
      )}

      {/* Light overlay */}
      <div className="absolute inset-0 bg-white/70 group-hover:bg-white/60 transition" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        <h3 className="text-gray-900 font-semibold text-lg">
          {section.title}
        </h3>
        <p className="text-xs text-gray-600 mt-1">
          {section.subtitle}
        </p>
      </div>
    </div>
  )
}



const EmptyGallery = ({ title }: { title: string }) => (
  <div className="relative rounded-3xl p-24 text-center overflow-hidden border border-white/20 bg-white/60 backdrop-blur-xl shadow-xl">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-cyan-50 to-emerald-100 opacity-60" />
    <div className="relative z-10">
      <AlertCircle className="mx-auto mb-6 text-cyan-500" size={56} />
      <h3 className="text-2xl font-semibold text-gray-800">
        Gallery Coming Soon
      </h3>
      <p className="text-gray-600 mt-3 max-w-lg mx-auto">
        Images for <span className="font-medium">{title}</span> will appear here.
      </p>
    </div>
  </div>
)


const SectionImageBrowser = ({ section }: { section: GallerySection }) => {
  if (!section.images || section.images.length === 0) {
    return <EmptyGallery title={section.title} />
  }

  return (
    <div>
      <h2 className="text-4xl font-extrabold mb-8 text-gray-900">
        {section.title}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
        {section.images.map((img) => (
          <div
            key={img.id}
            className="relative h-60 rounded-2xl overflow-hidden shadow hover:shadow-xl transition"
          >
            <Image
              src={img.url}
              alt={img.name}
              fill
              className="object-cover hover:scale-110 transition duration-700"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </div>
        ))}
      </div>
    </div>
  )
}


export default function VarunaGallery() {
  const [activeSectionId, setActiveSectionId] = useState(
    GALLERY_SECTIONS[0].id
  )

  const activeSection =
    GALLERY_SECTIONS.find((s) => s.id === activeSectionId) ??
    GALLERY_SECTIONS[0]

  return (
    <div className="relative min-h-screen w-full px-6 md:px-12 py-10
 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50">

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-400/20 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl" />
      </div>


      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-indigo-400">
          VARUNA GALLERY
        </h1>
        <p className="text-slate-300 mt-5 italic text-lg">
          A digital initiative for awareness & conservation
        </p>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

        {/* LEFT – Sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          {GALLERY_SECTIONS.map((section) => (
            <SidebarCard
              key={section.id}
              section={section}
              isActive={section.id === activeSectionId}
              onSelect={setActiveSectionId}
            />
          ))}
        </aside>

        {/* RIGHT – Gallery */}
        <main className="lg:col-span-8 xl:col-span-9">
          <SectionImageBrowser section={activeSection} />
        </main>

      </div>
    </div>
  )
}

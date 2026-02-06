'use client';
import React from 'react';
import { Calendar, Users, MapPin, Award, Globe, Presentation, GraduationCap, FlaskConical } from 'lucide-react';
import ImageSlider from '@/components/ImageView';
interface ConferenceEvent {
    title: string;
    date: string;
    location: string;
    description: string;
    organizers?: string[];
    theme?: string;
    participants?: string[];
    image: string[];
}

const ConferencesPage: React.FC = () => {
    const conferences: ConferenceEvent[] = [
        {
            title: "International Groundwater Conference, 2025",
            date: "5th - 7th March, 2025",
            location: "National Institute of Hydrology (NIH), Roorkee",
            theme: "Groundwater Vision 2047: Towards Water Security under Changing Climate",
            description: "The National Institute of Hydrology (NIH), Roorkee under Department of Water Resources, River Development & Ganga Rejuvenation, Ministry of Jal Shakti, Govt. of India in association with the Central Ground Water Board (CGWB); Association of Global Groundwater Scientists (AGGS); National Mission for Clean Ganga (NMCG); and National River Conservation Directorate (NRCD) has organized the prestigious International Ground Water Conference-2025 (IGWC-2025).",
            organizers: ["NIH Roorkee", "CGWB", "AGGS", "NMCG", "NRCD"],
            participants: ["DSS Research Staff"],
            image: ["/Images/activity/Imagess/saminar/confrence/image_24.jpeg", "/Images/activity/Imagess/saminar/confrence/image_29.jpeg"]
        },
        {

            title: "Sustainable Development and Management of Groundwater Resource",
            date: "24th March, 2025",
            location: "Department of Geology, Banaras Hindu University",
            description: "Prof. Anurag Ohri and Dr. Shishir Gaur participated as Chief Guest in the 'Sustainable Development and Management of Groundwater Resource' of the Tier III Training Program organized by Rajiv Gandhi National Ground Water Training & Research Institute and hosted by Department of Geology, Banaras Hindu University.",
            participants: ["Prof. Anurag Ohri (Chief Guest)", "Dr. Shishir Gaur (Chief Guest)"],
            image: ["/Images/activity/Imagess/saminar/prize/image_28.png", "/Images/activity/Imagess/saminar/prize/image_31.png", "/Images/activity/Imagess/saminar/prize/image_32.png"]
        },
        {
            title: "International Association of Hydrological Sciences (IAHS 2025)",
            date: "5th - 10th October, 2025",
            location: "IIT Roorkee",
            description: "A Research Associate from the Decision Support System (DSS) team participated in the International Association of Hydrological Sciences (IAHS) 2025 Scientific Assembly, where the Decision Support System for Water Resource Management was showcased to an international audience. The participation provided a valuable platform to present the DSS framework, exchange scientific insights, and engage with global experts on data-driven and sustainable water resource management approaches.",
            participants: ["DSS Research Associate"],
            image: ["/Images/activity/Imagess/saminar/assos/image_1.jpeg", "/Images/activity/Imagess/saminar/assos/image_2.jpeg", "/Images/activity/Imagess/saminar/assos/image_3.jpeg"]
        },
        {
            title: "4th River Health Assessment and Rejuvenation (RHAR) 2025",
            date: "2025",
            location: "Conference Venue",
            description: "DSS research associate, Dr. Akash Tiwari has presented 'Decision Support System for Water Resource Management' in the 4th RHAR Conference, contributing to discussions on river health monitoring and sustainable rejuvenation strategies.",
            participants: ["Dr. Akash Tiwari"],
            image: ["/Images/activity/Imagess/saminar/rhar/image_4.jpeg", "/Images/activity/Imagess/saminar/rhar/image_5.jpeg"]
        }
    ];

    const getColorScheme = (index: number) => {
        const schemes = [
            { bg: 'bg-blue-50/30', border: 'border-blue-200/60', accent: 'bg-blue-600', text: 'text-blue-700', icon: 'text-blue-700', hover: 'hover:border-blue-500' },
            { bg: 'bg-emerald-50/30', border: 'border-emerald-200/60', accent: 'bg-emerald-600', text: 'text-emerald-700', icon: 'text-emerald-700', hover: 'hover:border-emerald-500' },
            { bg: 'bg-violet-50/30', border: 'border-violet-200/60', accent: 'bg-violet-600', text: 'text-violet-700', icon: 'text-violet-700', hover: 'hover:border-violet-500' },
            { bg: 'bg-amber-50/30', border: 'border-amber-200/60', accent: 'bg-amber-600', text: 'text-amber-700', icon: 'text-amber-700', hover: 'hover:border-amber-500' }
        ];
        return schemes[index % schemes.length];
    };

    const getIcon = (index: number) => {
        const icons = [Globe, GraduationCap, FlaskConical, Presentation];
        const Icon = icons[index % icons.length];
        return Icon;
    };

    return (
        <div className="min-h-screen  bg-stone-50 text-slate-900 relative overflow-hidden">
            {/* Subtle Topographic Background Pattern */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="topo-conf" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                            <path d="M 0 50 Q 50 40, 100 50 T 200 50" stroke="#3b82f6" fill="none" strokeWidth="0.8" opacity="0.4" />
                            <path d="M 0 100 Q 50 90, 100 100 T 200 100" stroke="#3b82f6" fill="none" strokeWidth="0.8" opacity="0.4" />
                            <path d="M 0 150 Q 50 140, 100 150 T 200 150" stroke="#3b82f6" fill="none" strokeWidth="0.8" opacity="0.4" />
                            <circle cx="50" cy="50" r="2" fill="#3b82f6" opacity="0.4" />
                            <circle cx="150" cy="100" r="2" fill="#3b82f6" opacity="0.4" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#topo-conf)" />
                </svg>
            </div>

            {/* Header */}
            <header className="relative border-b-2 border-indigo-600/20 bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-white to-blue-50/20"></div>

                <div className="relative max-w-7xl mx-auto px-8 py-16">
                    <div className="flex items-start gap-6 mb-8">
                        <div className="hidden md:block p-4 bg-indigo-600/10 border-2 border-indigo-600/30 rounded-sm shadow-sm">
                            <Globe className="w-12 h-12 text-indigo-700" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4 text-slate-800" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
                                CONFERENCE
                                <span className="block text-indigo-700 font-semibold">PARTICIPATIONS</span>
                            </h1>
                            <p className="text-xl text-slate-600 font-light tracking-wide" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                International & National Scientific Engagements in Water Resource Management
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-indigo-700 font-mono text-sm tracking-wide border-l-2 border-indigo-600 pl-4">
                        <Users className="w-4 h-4" />
                        <span>DSS TEAM CONTRIBUTIONS | 2025</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-8 py-16">
                {conferences.map((conference, index) => {
                    const colors = getColorScheme(index);
                    const Icon = getIcon(index);

                    return (
                        <section key={index} className="mb-16 relative">
                            <div className={`absolute -left-4 top-0 h-32 w-1 bg-gradient-to-b from-${colors.accent.split('-')[1]}-600 to-transparent`}></div>

                            <div className="relative">
                                {/* Section Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`flex items-center justify-center w-12 h-12 ${colors.accent}/15 border-2 ${colors.border.replace('/60', '/40')} rounded-sm shadow-sm`}>
                                        <Icon className={`w-6 h-6 ${colors.icon}`} strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-1`}>
                                            CONF_{String(index + 1).padStart(2, '0')} / {index === 0 ? 'INTERNATIONAL' : index === 2 ? 'SCIENTIFIC ASSEMBLY' : index === 1 ? 'TRAINING PROGRAM' : 'CONFERENCE'}
                                        </div>
                                        <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                            {conference.title.toUpperCase()}
                                        </h2>
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={`bg-white border-2 border-slate-200 rounded-sm overflow-hidden shadow-lg ${colors.hover} transition-all duration-300`}>
                                    {/* Metadata Bar */}
                                    <div className={`${colors.bg.replace('/30', '/50')} px-6 py-4 border-b-2 ${colors.border.replace('/60', '')} flex flex-wrap gap-6 font-mono text-sm`}>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Calendar className={`w-4 h-4 ${colors.icon.replace('700', '600')}`} />
                                            <span className={`${colors.text} font-semibold`}>DATE:</span>
                                            <span>{conference.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <MapPin className={`w-4 h-4 ${colors.icon.replace('700', '600')}`} />
                                            <span className={`${colors.text} font-semibold`}>VENUE:</span>
                                            <span className="text-sm">{conference.location}</span>
                                        </div>
                                    </div>

                                    <div className="p-8">
                                        {/* Theme Badge (if exists) */}
                                        {conference.theme && (
                                            <div className={`inline-flex items-center gap-3 mb-6 px-4 py-3 ${colors.bg} border-2 ${colors.border} rounded-sm shadow-sm`}>
                                                <Award className={`w-5 h-5 ${colors.icon.replace('700', '600')}`} />
                                                <div className="text-sm">
                                                    <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-1`}>CONFERENCE THEME</div>
                                                    <p className="text-slate-700 font-medium" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                        {conference.theme}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        <ImageSlider
                                            images={conference.image}
                                            direction={index %2=== 0 ? 'rtl' : 'ltr'}
                                        />

                                        {/* Description */}
                                        <p className="text-slate-700 text-base leading-relaxed mb-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                            {conference.description}
                                        </p>

                                        {/* Organizers Grid (if exists) */}
                                        {conference.organizers && (
                                            <div className={`mb-6 p-5 ${colors.bg} border-2 ${colors.border} rounded-sm`}>
                                                <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-3`}>
                                                    ORGANIZING BODIES
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {conference.organizers.map((org, idx) => (
                                                        <span key={idx} className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700 shadow-sm">
                                                            {org}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Participants */}
                                        {conference.participants && (
                                            <div className="relative overflow-hidden bg-gradient-to-r from-slate-50 to-transparent rounded-sm">
                                                <div className={`relative border-l-4 ${colors.accent.replace('bg-', 'border-')} pl-6 py-4`}>
                                                    <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-2`}>
                                                        DSS PARTICIPATION
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {conference.participants.map((participant, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-sm shadow-sm">
                                                                <Users className={`w-4 h-4 ${colors.icon.replace('700', '600')}`} />
                                                                <span className="text-sm text-slate-700" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                                    {participant}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </section>
                    );
                })}
            </main>

            {/* Summary Footer */}
            <section className="max-w-7xl mx-auto px-8 pb-16">
                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50 border-2 border-indigo-200 rounded-sm p-8 shadow-lg">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 bg-indigo-600/10 border-2 border-indigo-600/30 rounded-sm">
                            <Presentation className="w-6 h-6 text-indigo-700" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-light tracking-tight text-slate-800 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                GLOBAL OUTREACH & KNOWLEDGE EXCHANGE
                            </h3>
                            <p className="text-slate-700 leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                The DSS team actively engages in national and international forums to showcase innovative water resource management solutions, collaborate with global experts, and contribute to advancing sustainable practices in hydrology and environmental science. These participations strengthen the visibility and impact of the Decision Support System for Water Resource Management.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}


            <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
      `}</style>
        </div>
    );
};

export default ConferencesPage;
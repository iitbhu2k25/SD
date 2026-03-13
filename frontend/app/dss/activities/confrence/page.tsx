'use client';
import { useEffect, useRef, useState } from 'react';
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

const InfinityBackground = ({ colorIndex }: { colorIndex: number }) => {
    const gradientPalettes = [
        ['#2563eb', '#06b6d4', '#1e40af'], // Blue
        ['#059669', '#34d399', '#064e3b'], // Emerald
        ['#7c3aed', '#a78bfa', '#4c1d95'], // Violet
        ['#d97706', '#fbbf24', '#78350f'], // Amber
    ];
    
    const colors = gradientPalettes[colorIndex % gradientPalettes.length];
    
    return (
        <>
            {/* Main animated background layer */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                {/* Large floating circles */}
                <div 
                    className="absolute w-96 h-96 rounded-full blur-3xl animate-float-slow"
                    style={{ 
                        background: `radial-gradient(circle, ${colors[0]}40, transparent)`,
                        top: '10%',
                        left: '10%',
                        animation: 'float-diagonal 25s ease-in-out infinite'
                    }}
                />
                <div 
                    className="absolute w-80 h-80 rounded-full blur-3xl animate-float-medium"
                    style={{ 
                        background: `radial-gradient(circle, ${colors[1]}50, transparent)`,
                        top: '50%',
                        right: '10%',
                        animation: 'float-reverse 20s ease-in-out infinite'
                    }}
                />
                <div 
                    className="absolute w-72 h-72 rounded-full blur-2xl"
                    style={{ 
                        background: `radial-gradient(circle, ${colors[2]}45, transparent)`,
                        bottom: '15%',
                        left: '30%',
                        animation: 'float-up-down 18s ease-in-out infinite'
                    }}
                />
                
                {/* Moving gradient bars */}
                <div 
                    className="absolute h-2 w-full opacity-30"
                    style={{ 
                        background: `linear-gradient(90deg, transparent, ${colors[0]}, ${colors[1]}, transparent)`,
                        top: '25%',
                        animation: 'slide-right 15s linear infinite'
                    }}
                />
                <div 
                    className="absolute h-2 w-full opacity-25"
                    style={{ 
                        background: `linear-gradient(90deg, transparent, ${colors[1]}, ${colors[2]}, transparent)`,
                        top: '60%',
                        animation: 'slide-left 18s linear infinite'
                    }}
                />
                <div 
                    className="absolute h-1 w-full opacity-20"
                    style={{ 
                        background: `linear-gradient(90deg, transparent, ${colors[2]}, ${colors[0]}, transparent)`,
                        top: '80%',
                        animation: 'slide-right 20s linear infinite'
                    }}
                />
                
                {/* Animated dots */}
                <div 
                    className="absolute w-4 h-4 rounded-full"
                    style={{ 
                        background: colors[0],
                        opacity: 0.4,
                        top: '20%',
                        left: '0%',
                        animation: 'move-across 12s linear infinite'
                    }}
                />
                <div 
                    className="absolute w-3 h-3 rounded-full"
                    style={{ 
                        background: colors[1],
                        opacity: 0.5,
                        top: '45%',
                        left: '0%',
                        animation: 'move-across 15s linear infinite 2s'
                    }}
                />
                <div 
                    className="absolute w-5 h-5 rounded-full"
                    style={{ 
                        background: colors[2],
                        opacity: 0.35,
                        top: '70%',
                        right: '0%',
                        animation: 'move-across-reverse 13s linear infinite'
                    }}
                />
                
                {/* Pulsing circles */}
                <div 
                    className="absolute w-32 h-32 rounded-full border-2 opacity-20"
                    style={{ 
                        borderColor: colors[0],
                        top: '30%',
                        left: '20%',
                        animation: 'pulse-grow 4s ease-in-out infinite'
                    }}
                />
                <div 
                    className="absolute w-40 h-40 rounded-full border-2 opacity-15"
                    style={{ 
                        borderColor: colors[1],
                        bottom: '25%',
                        right: '25%',
                        animation: 'pulse-grow 5s ease-in-out infinite 1s'
                    }}
                />
                
                {/* Rotating squares */}
                <div 
                    className="absolute w-16 h-16 opacity-10"
                    style={{ 
                        background: colors[0],
                        top: '15%',
                        right: '30%',
                        animation: 'rotate-move 20s linear infinite'
                    }}
                />
                <div 
                    className="absolute w-20 h-20 opacity-12"
                    style={{ 
                        background: colors[2],
                        bottom: '20%',
                        left: '40%',
                        animation: 'rotate-move-reverse 25s linear infinite'
                    }}
                />
            </div>

            {/* Add keyframes for animations */}
            <style jsx>{`
                @keyframes float-diagonal {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(100px, -50px); }
                    50% { transform: translate(200px, 0); }
                    75% { transform: translate(100px, 50px); }
                }

                @keyframes float-reverse {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(-80px, 60px); }
                    50% { transform: translate(-150px, 0); }
                    75% { transform: translate(-80px, -60px); }
                }

                @keyframes float-up-down {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-100px); }
                }

                @keyframes slide-right {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                @keyframes slide-left {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }

                @keyframes move-across {
                    0% { 
                        left: -5%;
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.4;
                    }
                    90% {
                        opacity: 0.4;
                    }
                    100% { 
                        left: 105%;
                        opacity: 0;
                    }
                }

                @keyframes move-across-reverse {
                    0% { 
                        right: -5%;
                        opacity: 0;
                    }
                    10% {
                        opacity: 0.35;
                    }
                    90% {
                        opacity: 0.35;
                    }
                    100% { 
                        right: 105%;
                        opacity: 0;
                    }
                }

                @keyframes pulse-grow {
                    0%, 100% { 
                        transform: scale(1);
                        opacity: 0.2;
                    }
                    50% { 
                        transform: scale(1.5);
                        opacity: 0;
                    }
                }

                @keyframes rotate-move {
                    0% {
                        transform: rotate(0deg) translateX(0);
                    }
                    100% {
                        transform: rotate(360deg) translateX(50px);
                    }
                }

                @keyframes rotate-move-reverse {
                    0% {
                        transform: rotate(0deg) translateY(0);
                    }
                    100% {
                        transform: rotate(-360deg) translateY(-50px);
                    }
                }
            `}</style>
        </>
    );
};

type ColorScheme = {
    bg: string;
    border: string;
    accent: string;
    text: string;
    icon: string;
    hover: string;
    accentBorder: string;
    bgLight: string;
    borderLight: string;
};

const ConferencesPage: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const sectionRefs = useRef<(HTMLElement | null)[]>([]);
    
    const conferences: ConferenceEvent[] = [
        {
            title: "International Groundwater Conference, 2025",
            date: "5th - 7th March, 2025",
            location: "National Institute of Hydrology (NIH), Roorkee",
            theme: "Groundwater Vision 2047: Towards Water Security under Changing Climate",
            description: "The National Institute of Hydrology (NIH), Roorkee under Department of Water Resources, River Development & Ganga Rejuvenation, Ministry of Jal Shakti, Govt. of India in association with the Central Ground Water Board (CGWB); Association of Global Groundwater Scientists (AGGS); National Mission for Clean Ganga (NMCG); and National River Conservation Directorate (NRCD) has organized the prestigious International Ground Water Conference-2025 (IGWC-2025).",
            organizers: ["NIH Roorkee", "CGWB", "AGGS", "NMCG", "NRCD"],
            participants: ["DSS Research Staff"],
            image: ["/Images/activity/saminar/confrence/image_24.jpeg", "/Images/activity/saminar/confrence/image_29.jpeg"]
        },
        {
            title: "Sustainable Development and Management of Groundwater Resource",
            date: "24th March, 2025",
            location: "Department of Geology, Banaras Hindu University",
            description: "Prof. Anurag Ohri and Dr. Shishir Gaur participated as Chief Guest in the 'Sustainable Development and Management of Groundwater Resource' of the Tier III Training Program organized by Rajiv Gandhi National Ground Water Training & Research Institute and hosted by Department of Geology, Banaras Hindu University.",
            participants: ["Prof. Anurag Ohri (Chief Guest)", "Dr. Shishir Gaur (Chief Guest)"],
            image: ["/Images/activity/saminar/prize/image_28.png", "/Images/activity/saminar/prize/image_31.png", "/Images/activity/saminar/prize/image_32.png"]
        },
        {
            title: "International Association of Hydrological Sciences (IAHS 2025)",
            date: "5th - 10th October, 2025",
            location: "IIT Roorkee",
            description: "A Research Associate from the Decision Support System (DSS) team participated in the International Association of Hydrological Sciences (IAHS) 2025 Scientific Assembly, where the Decision Support System for Water Resource Management was showcased to an international audience. The participation provided a valuable platform to present the DSS framework, exchange scientific insights, and engage with global experts on data-driven and sustainable water resource management approaches.",
            participants: ["DSS Research Staff"],
            image: ["/Images/activity/saminar/assos/image_1.jpeg", "/Images/activity/saminar/assos/image_2.jpeg", "/Images/activity/saminar/assos/image_3.jpeg"]
        },
        {
            title: "4th River Health Assessment and Rejuvenation (RHAR) 2025",
            date: "2025",
            location: "Conference Venue",
            description: "DSS research associate, Dr. Akash Tiwari has presented 'Decision Support System for Water Resource Management' in the 4th RHAR Conference, contributing to discussions on river health monitoring and sustainable rejuvenation strategies.",
            participants: ["DSS Research Staff"],
            image: ["/Images/activity/saminar/rhar/image_4.jpeg", "/Images/activity/saminar/rhar/image_5.jpeg"]
        }
    ];

    const colorSchemes: ColorScheme[] = [
        { 
            bg: 'bg-blue-50/30', 
            border: 'border-blue-200/60', 
            accent: 'bg-blue-600', 
            text: 'text-blue-700', 
            icon: 'text-blue-700', 
            hover: 'hover:border-blue-500',
            accentBorder: 'border-blue-600',
            bgLight: 'bg-blue-50/50',
            borderLight: 'border-blue-200'
        },
        { 
            bg: 'bg-emerald-50/30', 
            border: 'border-emerald-200/60', 
            accent: 'bg-emerald-600', 
            text: 'text-emerald-700', 
            icon: 'text-emerald-700', 
            hover: 'hover:border-emerald-500',
            accentBorder: 'border-emerald-600',
            bgLight: 'bg-emerald-50/50',
            borderLight: 'border-emerald-200'
        },
        { 
            bg: 'bg-violet-50/30', 
            border: 'border-violet-200/60', 
            accent: 'bg-violet-600', 
            text: 'text-violet-700', 
            icon: 'text-violet-700', 
            hover: 'hover:border-violet-500',
            accentBorder: 'border-violet-600',
            bgLight: 'bg-violet-50/50',
            borderLight: 'border-violet-200'
        },
        { 
            bg: 'bg-amber-50/30', 
            border: 'border-amber-200/60', 
            accent: 'bg-amber-600', 
            text: 'text-amber-700', 
            icon: 'text-amber-700', 
            hover: 'hover:border-amber-500',
            accentBorder: 'border-amber-600',
            bgLight: 'bg-amber-50/50',
            borderLight: 'border-amber-200'
        }
    ];

    const getColorScheme = (index: number): ColorScheme => {
        return colorSchemes[index % colorSchemes.length];
    };

    const getIcon = (index: number) => {
        const icons = [Globe, GraduationCap, FlaskConical, Presentation];
        return icons[index % icons.length];
    };

    const getConferenceType = (index: number): string => {
        const types = ['INTERNATIONAL', 'TRAINING PROGRAM', 'SCIENTIFIC ASSEMBLY', 'CONFERENCE'];
        return types[index % types.length];
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = Number(entry.target.getAttribute('data-index'));
                        setActiveIndex(index);
                    }
                });
            },
            { threshold: 0.4 }
        );

        sectionRefs.current.forEach((section) => {
            if (section) observer.observe(section);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-stone-50 to-slate-100 text-slate-900 relative overflow-hidden">
            {/* Animated Infinity Background */}
            <InfinityBackground colorIndex={activeIndex} />

            {/* Header */}
            <header className="relative border-b-2 border-indigo-600/20 bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 via-white to-blue-50/20"></div>

                <div className="relative max-w-[1400px] mx-auto px-8 py-16">
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
            <main className="max-w-[1400px] mx-auto px-8 py-16">
                {conferences.map((conference, index) => {
                    const colors = getColorScheme(index);
                    const Icon = getIcon(index);
                    const conferenceType = getConferenceType(index);

                    return (
                        <section
                            key={index}
                            data-index={index}
                            ref={(el) => {
                                sectionRefs.current[index] = el;
                            }}
                            className="mb-16 relative"
                        >
                            {/* Section Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`flex items-center justify-center w-12 h-12 ${colors.accent}/15 border-2 ${colors.borderLight} rounded-sm shadow-sm`}>
                                    <Icon className={`w-6 h-6 ${colors.icon}`} strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-1`}>
                                        CONF_{String(index + 1).padStart(2, '0')} / {conferenceType}
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                        {conference.title.toUpperCase()}
                                    </h2>
                                </div>
                            </div>

                            {/* Content Card */}
                            <div className={`bg-white border-2 border-slate-200 rounded-sm overflow-hidden shadow-lg ${colors.hover} transition-all duration-300`}>
                                {/* Metadata Bar */}
                                <div className={`${colors.bgLight} px-6 py-4 border-b-2 ${colors.borderLight} flex flex-wrap gap-6 font-mono text-sm`}>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <Calendar className={`w-4 h-4 ${colors.icon}`} />
                                        <span className={`${colors.text} font-semibold`}>DATE:</span>
                                        <span>{conference.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <MapPin className={`w-4 h-4 ${colors.icon}`} />
                                        <span className={`${colors.text} font-semibold`}>VENUE:</span>
                                        <span className="text-sm">{conference.location}</span>
                                    </div>
                                </div>

                                <div className="p-8">
                                    {/* Theme Badge (if exists) */}
                                    {conference.theme && (
                                        <div className={`inline-flex items-center gap-3 mb-6 px-4 py-3 ${colors.bg} border-2 ${colors.border} rounded-sm shadow-sm`}>
                                            <Award className={`w-5 h-5 ${colors.icon}`} />
                                            <div className="text-sm">
                                                <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-1`}>CONFERENCE THEME</div>
                                                <p className="text-slate-700 font-medium" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                    {conference.theme}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <ImageSlider
                                        images={conference.image}
                                        direction={index % 2 === 0 ? 'rtl' : 'ltr'}
                                    />

                                    {/* Description */}
                                    <p className="text-slate-700 text-base leading-relaxed mb-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                        {conference.description}
                                    </p>

                                    {/* Organizers Grid (if exists) */}
                                    {conference.organizers && (
                                        <div className={`mb-6 p-5 ${colors.bg} border-2 ${colors.border} rounded-sm`}>
                                            <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-3`}>
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
                                            <div className={`relative border-l-4 ${colors.accentBorder} pl-6 py-4`}>
                                                <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-2`}>
                                                    DSS PARTICIPATION
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {conference.participants.map((participant, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-sm shadow-sm">
                                                            <Users className={`w-4 h-4 ${colors.icon}`} />
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
                        </section>
                    );
                })}
            </main>

            {/* Summary Footer */}
            <section className="max-w-[1400px] mx-auto px-8 pb-16">
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

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
            `}</style>
        </div>
    );
};

export default ConferencesPage;
'use client';
import React from 'react';
import { Calendar, MapPin, Users, Award, Plane, Building2, Leaf, Droplet } from 'lucide-react';
import ImageSlider from '@/components/ImageView';

interface ActivityEvent {
    title: string;
    date: string;
    location: string;
    description: string;
    highlights?: string[];
    images: string[];
    type: 'training' | 'visit' | 'environmental';
}

// Animated Background Component
const AnimatedBackground = ({ colorIndex }: { colorIndex: number }) => {
    const gradientPalettes = [
        ['#4f46e5', '#0891b2', '#2563eb'], // Indigo-Cyan
        ['#0891b2', '#06b6d4', '#0e7490'], // Cyan
        ['#059669', '#10b981', '#047857'], // Emerald
    ];
    
    const colors = gradientPalettes[colorIndex % gradientPalettes.length];
    
    return (
        <>
            {/* Main animated background layer */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                {/* Large floating circles */}
                <div 
                    className="absolute w-96 h-96 rounded-full blur-3xl"
                    style={{ 
                        background: `radial-gradient(circle, ${colors[0]}40, transparent)`,
                        top: '10%',
                        left: '10%',
                        animation: 'float-diagonal 25s ease-in-out infinite'
                    }}
                />
                <div 
                    className="absolute w-80 h-80 rounded-full blur-3xl"
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
    gradient: string;
    bgLight: string;
    borderLight: string;
    accentBorder: string;
};

const ActivitiesPage: React.FC = () => {
    const [activeIndex, setActiveIndex] = React.useState(0);
    const sectionRefs = React.useRef<(HTMLElement | null)[]>([]);

    const activities: ActivityEvent[] = [
        {
            title: "DSS Staff Visit to Denmark",
            date: "5th January - 17th January 2026",
            location: "Copenhagen, Denmark",
            type: "training",
            description: "Dr. Akash Tiwari, Research Associate (DSS), attended an international training programme on Innovation Management held in Copenhagen, Denmark. The programme was centered on the ISO 56000 series of standards, which provide a structured framework for establishing, implementing, assessing, and continuously improving innovation management systems at both organizational and project levels.",
            highlights: [
                "Innovation governance and strategic intelligence",
                "Intellectual property management",
                "Innovation partnerships and design thinking",
                "Opportunity management and performance measurement",
                "Application to sustainability-oriented initiatives",
                "Enhanced innovation-driven planning for DSS",
                "Strengthened stakeholder collaboration mechanisms",
                "Adaptive decision-making frameworks"
            ],
            images: [
                "/Images/activity/exposure/denmark/image_7.jpeg",
                "/Images/activity/exposure/denmark/image_8.jpeg",
                "/Images/activity/exposure/denmark/image_10.jpeg",]
        },
        {
            title: "STP Visits",
            date: "February - April 2025",
            location: "Varanasi, Uttar Pradesh",
            type: "visit",
            description: "The DSS team conducted comprehensive site visits to multiple Sewage Treatment Plants in Varanasi to assess operational parameters, treatment efficiency, and infrastructure. On 17th February 2025, the team visited Bhagwanpur STP (8 MLD capacity) for water quality management assessment and DSS integration evaluation. Subsequently, on 7th April 2025, a collaborative visit to BLW STP (12 MLD capacity) was conducted with the system dynamics team to evaluate treatment processes, model integration opportunities, and data collection protocols for enhanced decision support.",
            highlights: [
                "Bhagwanpur STP (8 MLD) - Operational assessment on 17th February 2025",
                "BLW STP (12 MLD) - System dynamics evaluation on 7th April 2025",
                "Treatment efficiency and infrastructure analysis",
                "DSS integration feasibility studies",
                "Model integration and data collection protocols",
                "Collaborative assessment with system dynamics team"
            ],
            images: [
                "/Images/activity/exposure/stp_visit/image_9.jpeg",
                "/Images/activity/exposure/stp_visit/image_11.jpeg",
                "/Images/activity/exposure/stp_visit/image_15.png",]
        },
        {
            title: "World Environment Day Celebration",
            date: "5th June 2025",
            location: "Varuna Bridge & Adikeshav Ghat, Varanasi",
            type: "environmental",
            description: "On the occasion of World Environment Day, the DSS team visited Varuna Bridge and Adikeshav Ghat and collectively took an oath to combat plastic pollution and promote environmental responsibility, reinforcing the commitment to sustainable river management and community engagement.",
            images: [
                "/Images/activity/exposure/Envt_day/image_14.jpeg",
                "/Images/activity/exposure/Envt_day/image_19.jpeg",]
        }
    ];

    const colorSchemes: Record<string, ColorScheme> = {
        training: {
            bg: 'bg-indigo-50/30',
            border: 'border-indigo-200/60',
            accent: 'bg-indigo-600',
            text: 'text-indigo-700',
            icon: 'text-indigo-700',
            hover: 'hover:border-indigo-500',
            gradient: 'from-indigo-50/50',
            bgLight: 'bg-indigo-50/50',
            borderLight: 'border-indigo-200',
            accentBorder: 'border-indigo-600'
        },
        visit: {
            bg: 'bg-cyan-50/30',
            border: 'border-cyan-200/60',
            accent: 'bg-cyan-600',
            text: 'text-cyan-700',
            icon: 'text-cyan-700',
            hover: 'hover:border-cyan-500',
            gradient: 'from-cyan-50/50',
            bgLight: 'bg-cyan-50/50',
            borderLight: 'border-cyan-200',
            accentBorder: 'border-cyan-600'
        },
        environmental: {
            bg: 'bg-emerald-50/30',
            border: 'border-emerald-200/60',
            accent: 'bg-emerald-600',
            text: 'text-emerald-700',
            icon: 'text-emerald-700',
            hover: 'hover:border-emerald-500',
            gradient: 'from-emerald-50/50',
            bgLight: 'bg-emerald-50/50',
            borderLight: 'border-emerald-200',
            accentBorder: 'border-emerald-600'
        }
    };

    const getColorScheme = (type: string): ColorScheme => {
        return colorSchemes[type] || colorSchemes.training;
    };

    const getIcon = (type: string) => {
        const icons = {
            training: Plane,
            visit: Building2,
            environmental: Leaf
        };
        return icons[type as keyof typeof icons] || Plane;
    };

    const getTypeLabel = (type: string) => {
        const labels = {
            training: 'INTERNATIONAL TRAINING',
            visit: 'SITE VISIT',
            environmental: 'ENVIRONMENTAL INITIATIVE'
        };
        return labels[type as keyof typeof labels] || 'ACTIVITY';
    };

    React.useEffect(() => {
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
            {/* Animated Background */}
            <AnimatedBackground colorIndex={activeIndex} />

            {/* Header */}
            <header className="relative border-b-2 border-teal-600/20 bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 via-white to-cyan-50/20"></div>

                <div className="relative max-w-[1400px] mx-auto px-8 py-16">
                    <div className="flex items-start gap-6 mb-8">
                        <div className="hidden md:block p-4 bg-teal-600/10 border-2 border-teal-600/30 rounded-sm shadow-sm">
                            <Droplet className="w-12 h-12 text-teal-700" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-5xl md:text-6xl font-light tracking-tight mb-4 text-slate-800" style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em' }}>
                                FIELD ACTIVITIES
                                <span className="block text-teal-700 font-semibold">& CAPACITY BUILDING</span>
                            </h1>
                            <p className="text-xl text-slate-600 font-light tracking-wide" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                Training Programs, Site Visits & Environmental Initiatives
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-teal-700 font-mono text-sm tracking-wide border-l-2 border-teal-600 pl-4">
                        <Users className="w-4 h-4" />
                        <span>DSS TEAM ENGAGEMENTS | 2025-2026</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1400px] mx-auto px-8 py-16">
                {activities.map((activity, index) => {
                    const colors = getColorScheme(activity.type);
                    const Icon = getIcon(activity.type);

                    return (
                        <section 
                            key={index} 
                            className="mb-16 relative"
                            data-index={index}
                            ref={(el) => {
                                sectionRefs.current[index] = el;
                            }}
                        >
                            {/* Section Header */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`flex items-center justify-center w-12 h-12 ${colors.accent}/15 border-2 ${colors.borderLight} rounded-sm shadow-sm`}>
                                    <Icon className={`w-6 h-6 ${colors.icon}`} strokeWidth={1.5} />
                                </div>
                                <div className="flex-1">
                                    <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-1`}>
                                        ACT_{String(index + 1).padStart(2, '0')} / {getTypeLabel(activity.type)}
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-light tracking-tight text-slate-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                        {activity.title.toUpperCase()}
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
                                        <span>{activity.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-700">
                                        <MapPin className={`w-4 h-4 ${colors.icon}`} />
                                        <span className={`${colors.text} font-semibold`}>LOCATION:</span>
                                        <span className="text-sm">{activity.location}</span>
                                    </div>
                                </div>

                                <div className="p-8">
                                    {/* Description */}
                                    <p className="text-slate-700 text-base leading-relaxed mb-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                        {activity.description}
                                    </p>

                                    {/* Highlights (if exists) */}
                                    {activity.highlights && (
                                        <div className={`mb-8 relative ${colors.bg} border-2 ${colors.border} rounded-sm p-6 shadow-sm`}>
                                            <div className={`absolute top-0 left-0 px-3 py-1 ${colors.accent} border-b-2 border-r-2 ${colors.accentBorder} font-mono text-xs text-white tracking-widest shadow-sm`}>
                                                KEY OUTCOMES
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-3 mt-8">
                                                {activity.highlights.map((highlight, idx) => (
                                                    <div key={idx} className="flex items-start gap-3 group">
                                                        <div className={`mt-1.5 w-1.5 h-1.5 ${colors.accent} rotate-45 group-hover:scale-125 transition-transform`}></div>
                                                        <span className="text-slate-700 text-sm leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                            {highlight}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <ImageSlider
                                        images={activity.images}
                                        direction={index % 2 === 0 ? 'rtl' : 'ltr'}
                                    />

                                    {/* Impact Note for Training */}
                                    {activity.type === 'training' && (
                                        <div className={`mt-8 relative overflow-hidden bg-gradient-to-r ${colors.gradient} to-transparent rounded-sm`}>
                                            <div className={`relative border-l-4 ${colors.accentBorder} pl-6 py-4`}>
                                                <div className={`font-mono text-xs ${colors.text}/70 tracking-widest mb-2`}>
                                                    DSS IMPACT
                                                </div>
                                                <p className="text-slate-700 italic leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                                    The knowledge and skills gained through this programme directly contribute to the objectives of the Smart Laboratory on Clean Rivers (SLCR) and the Decision Support System (DSS) for Water Resource Management, supporting effective design, implementation, and scaling of data-driven solutions.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    );
                })}
            </main>

            {/* Summary Section */}
            <section className="max-w-[1400px] mx-auto px-8 pb-16">
                <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 border-2 border-teal-200 rounded-sm p-8 shadow-lg">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 bg-teal-600/10 border-2 border-teal-600/30 rounded-sm">
                            <Award className="w-6 h-6 text-teal-700" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-light tracking-tight text-slate-800 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                                INTEGRATED CAPACITY BUILDING & FIELD ENGAGEMENT
                            </h3>
                            <p className="text-slate-700 leading-relaxed" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                Through international training programs, on-ground site assessments, and community-driven environmental initiatives, the DSS team continuously strengthens technical expertise, operational understanding, and stakeholder collaboration. These activities ensure that the Decision Support System remains responsive, evidence-based, and aligned with sustainable water resource management goals.
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

export default ActivitiesPage;
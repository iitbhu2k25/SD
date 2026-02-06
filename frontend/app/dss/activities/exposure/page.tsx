'use client';
import React from 'react';
import { Calendar, MapPin, Users, Award, Plane, Building2, Leaf, Droplet, Camera } from 'lucide-react';
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

const ActivitiesPage: React.FC = () => {
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
                "/Images/activity/Imagess/exposure/denmark/image_7.jpeg",
                "/Images/activity/Imagess/exposure/denmark/image_8.jpeg",
                "/Images/activity/Imagess/exposure/denmark/image_10.jpeg",]
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
                "/Images/activity/Imagess/exposure/stp_visit/image_9.jpeg",
                "/Images/activity/Imagess/exposure/stp_visit/image_11.jpeg",
                "/Images/activity/Imagess/exposure/stp_visit/image_15.jpeg",]
        },
        {
            title: "World Environment Day Celebration",
            date: "5th June 2025",
            location: "Varuna Bridge & Adikeshav Ghat, Varanasi",
            type: "environmental",
            description: "On the occasion of World Environment Day, the DSS team visited Varuna Bridge and Adikeshav Ghat and collectively took an oath to combat plastic pollution and promote environmental responsibility, reinforcing the commitment to sustainable river management and community engagement.",
            images: [
                "/Images/activity/Imagess/exposure/Envt_day/image_14.jpeg",
                "/Images/activity/Imagess/exposure/Envt_day/image_19.jpeg",]
        }
    ];

    const getColorScheme = (type: string) => {
        const schemes = {
            training: {
                bg: 'bg-indigo-50/30',
                border: 'border-indigo-200/60',
                accent: 'bg-indigo-600',
                text: 'text-indigo-700',
                icon: 'text-indigo-700',
                hover: 'hover:border-indigo-500',
                gradient: 'from-indigo-50/50'
            },
            visit: {
                bg: 'bg-cyan-50/30',
                border: 'border-cyan-200/60',
                accent: 'bg-cyan-600',
                text: 'text-cyan-700',
                icon: 'text-cyan-700',
                hover: 'hover:border-cyan-500',
                gradient: 'from-cyan-50/50'
            },
            environmental: {
                bg: 'bg-emerald-50/30',
                border: 'border-emerald-200/60',
                accent: 'bg-emerald-600',
                text: 'text-emerald-700',
                icon: 'text-emerald-700',
                hover: 'hover:border-emerald-500',
                gradient: 'from-emerald-50/50'
            }
        };
        return schemes[type as keyof typeof schemes];
    };

    const getIcon = (type: string) => {
        const icons = {
            training: Plane,
            visit: Building2,
            environmental: Leaf
        };
        return icons[type as keyof typeof icons];
    };

    const getTypeLabel = (type: string) => {
        const labels = {
            training: 'INTERNATIONAL TRAINING',
            visit: 'SITE VISIT',
            environmental: 'ENVIRONMENTAL INITIATIVE'
        };
        return labels[type as keyof typeof labels];
    };

    return (
        <div className="min-h-screen bg-stone-50 text-slate-900 relative overflow-hidden">
            {/* Subtle Wave Pattern Background */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="waves" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                            <path d="M 0 80 Q 50 70, 100 80 T 200 80" stroke="#0891b2" fill="none" strokeWidth="0.8" opacity="0.4" />
                            <path d="M 0 120 Q 50 110, 100 120 T 200 120" stroke="#10b981" fill="none" strokeWidth="0.8" opacity="0.3" />
                            <circle cx="50" cy="80" r="2" fill="#0891b2" opacity="0.3" />
                            <circle cx="150" cy="120" r="2" fill="#10b981" opacity="0.3" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#waves)" />
                </svg>
            </div>

            {/* Header */}
            <header className="relative border-b-2 border-teal-600/20 bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50/30 via-white to-cyan-50/20"></div>

                <div className="relative max-w-7xl mx-auto px-8 py-16">
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
            <main className="max-w-7xl mx-auto px-8 py-16">
                {activities.map((activity, index) => {
                    const colors = getColorScheme(activity.type);
                    const Icon = getIcon(activity.type);

                    return (
                        <section key={index} className="mb-16 relative">
                            <div className={`absolute -left-4 top-0 h-32 w-1 bg-gradient-to-b ${colors.accent.replace('bg-', 'from-')} to-transparent`}></div>

                            <div className="relative">
                                {/* Section Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`flex items-center justify-center w-12 h-12 ${colors.accent}/15 border-2 ${colors.border.replace('/60', '/40')} rounded-sm shadow-sm`}>
                                        <Icon className={`w-6 h-6 ${colors.icon}`} strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-1`}>
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
                                    <div className={`${colors.bg.replace('/30', '/50')} px-6 py-4 border-b-2 ${colors.border.replace('/60', '')} flex flex-wrap gap-6 font-mono text-sm`}>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Calendar className={`w-4 h-4 ${colors.icon.replace('700', '600')}`} />
                                            <span className={`${colors.text} font-semibold`}>DATE:</span>
                                            <span>{activity.date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <MapPin className={`w-4 h-4 ${colors.icon.replace('700', '600')}`} />
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
                                                <div className={`absolute top-0 left-0 px-3 py-1 ${colors.accent} border-b-2 border-r-2 ${colors.accent.replace('bg-', 'border-').replace('600', '700')} font-mono text-xs text-white tracking-widest shadow-sm`}>
                                                    KEY OUTCOMES
                                                </div>

                                                <div className="grid md:grid-cols-2 gap-3 mt-8">
                                                    {activity.highlights.map((highlight, idx) => (
                                                        <div key={idx} className="flex items-start gap-3 group">
                                                            <div className={`mt-1.5 w-1.5 h-1.5 ${colors.accent.replace('bg-', 'bg-')} rotate-45 group-hover:scale-125 transition-transform`}></div>
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
                                            direction={index%2 === 0 ? 'rtl' : 'ltr'}
                                        />

                                        {/* Impact Note for Training */}
                                        {activity.type === 'training' && (
                                            <div className={`mt-8 relative overflow-hidden bg-gradient-to-r ${colors.gradient} to-transparent rounded-sm`}>
                                                <div className={`relative border-l-4 ${colors.accent.replace('bg-', 'border-')} pl-6 py-4`}>
                                                    <div className={`font-mono text-xs ${colors.text.replace('700', '600')}/70 tracking-widest mb-2`}>
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
                            </div>
                        </section>
                    );
                })}
            </main>

            {/* Summary Section */}
            <section className="max-w-7xl mx-auto px-8 pb-16">
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
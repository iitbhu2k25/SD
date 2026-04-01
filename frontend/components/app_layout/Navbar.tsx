"use client";
import { useState, useEffect, useRef, JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/app/authentication/components/logout";
import { startCase } from "lodash";
import AuthDialog from "@/app/authentication/components/AuthDialog";


type BreadcrumbItem = {
  label: string;
  href: string;
};

type DropdownState = {
  [key: string]: boolean;
};


const staticBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  // Main Pages
  "/dss/about": [{ label: "About", href: "/dss/about" }],
  "/dss/dashboard": [{ label: "Dashboard", href: "/dss/dashboard" }],
  "/UserManagement/UserProfile": [{ label: "Profile", href: "/UserManagement/UserProfile" }],

  // STP Routes
  "/dss/basic": [
    { label: "STP", href: "#" },
    { label: "Basic Module", href: "/dss/basic" }
  ],
  "/dss/stp/wwt/stp_priority_v2": [
    { label: "STP", href: "#" },
    { label: "STP Priority", href: "/dss/stp/wwt/stp_priority_v2" }
  ],
  "/dss/stp/wwt/stp_suitability": [
    { label: "STP", href: "#" },
    { label: "STP Suitability", href: "/dss/stp/wwt/stp_suitability" }
  ],

  // GWM Routes
  "/dss/gwm/pumping_location": [
    { label: "GWM", href: "#" },
    { label: "Groundwater Potential Assessment", href: "#" },
    { label: "Pumping Location Identification", href: "/dss/gwm/pumping_location" }
  ],
  "/dss/gwm/potential_zone": [
    { label: "GWM", href: "#" },
    { label: "Groundwater Potential Assessment", href: "#" },
    { label: "GW Potential Zone", href: "/dss/gwm/potential_zone" }
  ],
  "/dss/gwm/resource_estimation/wqa": [
    { label: "GWM", href: "#" },
    { label: "Resource Estimation", href: "#" },
    { label: "Water Quality Assessment", href: "/dss/gwm/resource_estimation/wqa" }
  ],
  "/dss/gwm/MAR/GWA": [
    { label: "GWM", href: "#" },
    { label: "Managed Aquifer Recharge", href: "#" },
    { label: "Need Assessment", href: "/dss/gwm/MAR/GWA" }
  ],
  "/dss/gwm/MAR/SWA": [
    { label: "GWM", href: "#" },
    { label: "Managed Aquifer Recharge", href: "#" },
    { label: "Water Source Estimation", href: "/dss/gwm/MAR/SWA" }
  ],
  "/dss/gwm/mar_suitability": [
    { label: "GWM", href: "#" },
    { label: "Managed Aquifer Recharge", href: "#" },
    { label: "MAR site Suitability", href: "/dss/gwm/mar_suitability" }
  ],

  // RWM Routes
  "/dss/river": [
    { label: "RWM", href: "#" },
    { label: "Resource Estimation", href: "#" },
    { label: "Water Quality Assessment", href: "#" },
    { label: "Ground Based Assessment", href: "/dss/river" }
  ],
  "/dss/rwm/rainwater": [
    { label: "RWM", href: "#" },
    { label: "Rain Water Harvesting", href: "/dss/rwm/rainwater" }
  ],

  // Tools
  "/dss/watershed": [
    { label: "Tools", href: "#" },
    { label: "Watershed", href: "/dss/watershed" }
  ],
  "/dss/Tools/vector_visual": [
    { label: "Tools", href: "#" },
    { label: "Vector", href: "/dss/Tools/vector_visual" }
  ],
  "/dss/Tools/raster_visual": [
    { label: "Tools", href: "#" },
    { label: "Raster", href: "/dss/Tools/raster_visual" }
  ],
  // "/dss/Tools/model_water": [
  //   { label: "Tools", href: "#" },
  //   { label: "Water", href: "/dss/Tools/model_water" }
  // ],
  "/dss/seawage_infrastructure": [
    { label: "Tools", href: "#" },
    { label: "seawage_infrastructure", href: "/dss/seawage_infrastructure" }
  ],
  "/dss/extractdata": [
    { label: "Tools", href: "#" },
    { label: "Extract Data", href: "/dss/extractdata" }
  ],

  // Activities
  "/dss/activities/gallery": [
    { label: "Activities", href: "#" },
    { label: "Gallery", href: "/dss/activities/gallery" }
  ],
};

const Navbar = (): JSX.Element => {
  const [isSticky, setIsSticky] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [openDropdowns, setOpenDropdowns] = useState<DropdownState>({});
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const isLoggedIn = !!accessToken && !!user;



  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: "Home", href: "/" }
  ]);
  const pathname = usePathname();
  const isHomePage = pathname === "/"

  const navRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  let user_name = useAuthStore((state) => state.user?.fullname) ?? 'User';
  user_name = startCase(user_name);
  if (user_name.length > 8) {
    user_name = user_name.slice(0, 5) + "...";
  }

  // Breadcrumb Loader
  useEffect(() => {
    if (staticBreadcrumbs[pathname]) {
      const mappedCrumbs = staticBreadcrumbs[pathname];
      setBreadcrumbs(mappedCrumbs);
      sessionStorage.setItem('breadcrumbs', JSON.stringify(mappedCrumbs));
      return;
    }

    const storedBreadcrumbs = sessionStorage.getItem('breadcrumbs');
    if (storedBreadcrumbs) {
      try {
        const parsed = JSON.parse(storedBreadcrumbs);
        setBreadcrumbs(parsed);
      } catch (e) {
        setBreadcrumbs([{ label: "Home", href: "/" }]);
      }
    } else {
      setBreadcrumbs([{ label: "Home", href: "/" }]);
    }
  }, [pathname]);

  const handleMenuClick = (path: BreadcrumbItem[]) => {
    setBreadcrumbs(path);
    sessionStorage.setItem('breadcrumbs', JSON.stringify(path));
    setOpenDropdowns({});
    setIsMobileMenuOpen(false);
  };

  // Handle sticky navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle click outside to close dropdowns and mobile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdowns({});
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
        setOpenDropdowns({});
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Toggle dropdown with delay for closing
  const toggleDropdown = (key: string, open: boolean): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (open) {
      setOpenDropdowns((prev) => {
        const updatedDropdowns = Object.keys(prev).reduce<DropdownState>(
          (acc, curr) => {
            acc[curr] = false;
            return acc;
          },
          {}
        );
        updatedDropdowns[key] = true;
        return updatedDropdowns;
      });
    } else {
      timeoutRef.current = setTimeout(() => {
        setOpenDropdowns((prev) => ({
          ...prev,
          [key]: false,
        }));
      }, 200);
    }
  };

  // Toggle submenu visibility
  const toggleSubmenu = (e: React.MouseEvent, key: string): void => {
    e.stopPropagation();
    e.preventDefault();
    setOpenDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const { handleLogout } = useLogout();

  // Improved navbar link classes with better typography
  const navLinkClasses = `
    text-white font-medium text-base lg:text-sm xl:text-base 
    px-4 lg:px-3 xl:px-4 py-2.5
    inline-flex items-center gap-1
    relative overflow-hidden
    transition-all duration-300 ease-out
    hover:text-orange-300
    before:content-[''] before:absolute before:bottom-0 before:left-0 
    before:w-0 before:h-0.5 before:bg-orange-400 
    before:transition-all before:duration-300 before:ease-out
    hover:before:w-full
    whitespace-nowrap
    tracking-wide
  `;

  const handleOpenAuth = (view: "login" | "signup") => {
    setAuthView(view);
    setIsAuthOpen(true);
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`${isSticky
            ? "bg-slate-900/98 shadow-2xl fixed top-0 left-0 w-full backdrop-blur-sm border-b border-slate-700/50"
            : "bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"
          }  relative transition-all duration-300 z-[200]`}
      >
        <div className="container mx-auto px-4 lg:px-6">
          {/* Mobile menu button */}
          <div className="flex justify-between items-center lg:hidden">
            <div className="text-white font-bold text-lg tracking-tight">
              Decision Support System
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white focus:outline-none p-2.5 rounded-lg hover:bg-white/10 transition-colors duration-200 border border-white/10"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navbar items */}
          <div className={`${isMobileMenuOpen ? "block" : "hidden"} lg:block`}>
            <ul className="flex flex-col lg:flex-row lg:justify-center lg:items-center space-y-1 lg:space-y-0 lg:space-x-0.5 xl:space-x-1 overflow-x-auto lg:overflow-visible mt-4 lg:mt-0">

              {/* Home */}
              <li className="relative group flex-shrink-0">
                <Link href="/" className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "Home", href: "/" }])}>
                  Home
                </Link>
              </li>
              {/* About */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("about", true)}
                onMouseLeave={() => toggleDropdown("about", false)}
              >
                <button
                  onClick={() => toggleDropdown("about", !openDropdowns.about)}
                  className={navLinkClasses}
                >
                  About
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.about ? 'rotate-180' : ''}`} />
                </button>

                <ul
                  className={`${openDropdowns.about ? "block" : "hidden"}
                    lg:group-hover:block absolute left-0 top-[calc(100%+8px)]
                    bg-white shadow-2xl border border-slate-200
                    rounded-xl min-w-[220px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  <li>
                    <Link
                      href="/dss/about/objective"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() =>
                        handleMenuClick([
                          { label: "About", href: "#" },
                          { label: "Objective", href: "/dss/about/objective" }
                        ])
                      }
                    >
                      Objective
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/about/vission"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() =>
                        handleMenuClick([
                          { label: "About", href: "#" },
                          { label: "Vision and Mission", href: "/dss/about/vission" }
                        ])
                      }
                    >
                      Vision and Mission
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/about/corevalue"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() =>
                        handleMenuClick([
                          { label: "About", href: "#" },
                          { label: "Core Values", href: "/dss/about/corevalue" }
                        ])
                      }
                    >
                      Core Values
                    </Link>
                  </li>
 
                  <li>
                    <Link
                      href="/dss/about/team"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() =>
                        handleMenuClick([
                          { label: "About", href: "#" },
                          { label: "Team", href: "/dss/about/team" }
                        ])
                      }
                    >
                      Team
                    </Link>
                  </li>
                                   <li>
                    <Link
                      href="/dss/about/message"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() =>
                        handleMenuClick([
                          { label: "About", href: "#" },
                          { label: "Pi Message", href: "/dss/about/message" }
                        ])
                      }
                    >
                      PI Message
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Dashboard */}
              <li className="relative group flex-shrink-0">
                <Link href="/dss/dashboard" className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "Dashboard", href: "/dss/dashboard" }])}>
                  Dashboard
                </Link>
              </li>

              {/* STP Module */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("stp", true)}
                onMouseLeave={() => toggleDropdown("stp", false)}
              >
                <button
                  onClick={() => toggleDropdown("stp", !openDropdowns.stp)}
                  className={navLinkClasses}
                >
                  STP
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.stp ? 'rotate-180' : ''}`} />
                </button>

                <ul
                  className={`${openDropdowns.stp ? "block" : "hidden"}
                    lg:group-hover:block absolute left-0 top-[calc(100%+8px)]
                    bg-white shadow-2xl border border-slate-200
                    rounded-xl min-w-[200px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white
                    animate-fadeIn`}
                >
                  <li>
                    <Link
                      href="/dss/stp/basic"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm
                        hover:bg-orange-50 hover:text-orange-600
                        rounded-lg transition-all duration-200"
                    >
                      Basic Module
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/stp/wwt/stp_priority_v2"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm
                        hover:bg-orange-50 hover:text-orange-600
                        rounded-lg transition-all duration-200"
                    >
                      STP Priority
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/stp/wwt/stp_suitability"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm
                        hover:bg-orange-50 hover:text-orange-600
                        rounded-lg transition-all duration-200"
                    >
                      STP Suitability
                    </Link>
                  </li>
                </ul>
              </li>

              {/* GWM */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("gwm", true)}
                onMouseLeave={() => toggleDropdown("gwm", false)}
              >
                <button
                  onClick={() => toggleDropdown("gwm", !openDropdowns.gwm)}
                  className={navLinkClasses}
                >
                  GWM
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.gwm ? 'rotate-180' : ''}`} />
                  <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg border border-slate-600 font-medium">
                    Ground Water Management
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
                  </span>
                </button>
                <ul
                  className={`${openDropdowns.gwm ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[420px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  {/* Groundwater Potential Assessment */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("gwPotential", true)}
                    onMouseLeave={() => toggleDropdown("gwPotential", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "gwPotential")}
                    >
                      Groundwater Potential Assessment
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.gwPotential ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.gwPotential ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[320px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/gwm/pumping_location"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Groundwater Potential Assessment", href: "#" }, { label: "Pumping Location Identification", href: "/dss/gwm/pumping_location" }])}>
                          Pumping Location Identification
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/gwm/potential_zone"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Groundwater Potential Assessment", href: "#" }, { label: "GW Potential Zone", href: "/dss/gwm/potential_zone" }])}>
                          GW Potential Zone
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Resource Estimation */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("gwResource", true)}
                    onMouseLeave={() => toggleDropdown("gwResource", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "gwResource")}
                    >
                      Resource Estimation
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.gwResource ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.gwResource ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[340px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/gwm/rsq"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Regional Scale Quantification", href: "/dss/default" }])}>
                          Regional Scale Quantification
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/gwm/resource_estimation/wqa"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "/dss/gwm/resource_estimation/wqa" }])}>
                          Water Quality Assessment
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Identification Of Vulnerable zones", href: "/dss/default" }])}>
                          Identification Of Vulnerable zones
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Managed Aquifer Recharge */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("gwAquifer", true)}
                    onMouseLeave={() => toggleDropdown("gwAquifer", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "gwAquifer")}
                    >
                      Managed Aquifer Recharge
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.gwAquifer ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.gwAquifer ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[300px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/gwm/MAR/GWA"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "Need Assessment", href: "/dss/gwm/MAR/GWA" }])}>
                          Need Assessment
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/gwm/MAR/SWA"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "Water Source Estimation", href: "/dss/gwm/MAR/SWA" }])}
                        >
                          Water Source Estimation
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/gwm/mar_suitability"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "MAR site Suitability", href: "/dss/gwm/mar_suitability" }])}>
                          MAR site Suitability
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "Differential Optimum Solution", href: "/dss/default" }])}>
                          Differential Optimum Solution
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* River Aquifer Interaction */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("gwRiver", true)}
                    onMouseLeave={() => toggleDropdown("gwRiver", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "gwRiver")}
                    >
                      River Aquifer Interaction
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.gwRiver ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.gwRiver ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[300px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "River Aquifer Interaction", href: "#" }, { label: "Baseflow Estimation", href: "/dss/default" }])}>
                          Baseflow Estimation
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "River Aquifer Interaction", href: "#" }, { label: "Climate Change and Mitigation", href: "/dss/default" }])}>
                          Climate Change and Mitigation
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>

              {/* RWM - Following same pattern as GWM for consistency */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("rwm", true)}
                onMouseLeave={() => toggleDropdown("rwm", false)}
              >
                <button
                  onClick={() => toggleDropdown("rwm", !openDropdowns.rwm)}
                  className={navLinkClasses}
                >
                  RWM
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.rwm ? 'rotate-180' : ''}`} />
                  <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg border border-slate-600 font-medium">
                    River Water Management
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
                  </span>
                </button>
                <ul
                  className={`${openDropdowns.rwm ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[420px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  {/* Resource Estimation */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("rwEstimation", true)}
                    onMouseLeave={() => toggleDropdown("rwEstimation", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "rwEstimation")}
                    >
                      Resource Estimation
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.rwEstimation ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.rwEstimation ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[360px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/water"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Availability", href: "/dss/water" }])}>
                          Water Availability
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Flow and Storage Estimation", href: "/dss/default" }])}>
                          Water Flow and Storage Estimation
                        </Link>
                      </li>
                      <li
                        className="relative group/submenu"
                        onMouseEnter={() => toggleDropdown("wqa", true)}
                        onMouseLeave={() => toggleDropdown("wqa", false)}
                      >
                        <div
                          className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                          onClick={(e) => toggleSubmenu(e, 'wqa')}
                        >
                          Water Quality Assessment
                          <ChevronRight className={`w-4 h-4 ${openDropdowns.wqa ? 'rotate-90' : ''} lg:group-hover/submenu:rotate-0 transition-transform duration-200`} />
                        </div>

                        <ul className={`${openDropdowns.wqa ? 'block' : 'hidden'} lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[280px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}>

                          <li>
                            <Link href="/dss/rwm/resource_estimation/river"
                              className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                              onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "#" }, { label: "Ground Based Assessment", href: "/dss/river" }])}
                            >
                              Ground Based Assessment
                            </Link>
                          </li>

                          <li>
                            <Link href="https://dssiitbhu.users.earthengine.app/view/water-budget" className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                              onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "#" }, { label: "Satellite Based Assessment", href: "/default" }])}
                            >
                              Satellite Based Assessment
                            </Link>
                          </li>
                        </ul>
                      </li>

                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Vulnerability Assessment", href: "/dss/default" }])}>
                          Vulnerability Assessment
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Contamination Risk Assessment", href: "/dss/default" }])}>
                          Contamination Risk Assessment
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Flood Forecasting and Management */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("rwFlood", true)}
                    onMouseLeave={() => toggleDropdown("rwFlood", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "rwFlood")}
                    >
                      Flood Forecasting and Management
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.rwFlood ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.rwFlood ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[340px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "Flood Simulation", href: "/dss/default" }])}>
                          Flood Simulation
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "River Routing", href: "/dss/default" }])}>
                          River Routing
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "Contamination Transport Modelling", href: "/dss/default" }])}>
                          Contamination Transport Modelling
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Water Bodies Management */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("rwWaterBodies", true)}
                    onMouseLeave={() => toggleDropdown("rwWaterBodies", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "rwWaterBodies")}
                    >
                      Water Bodies Management
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.rwWaterBodies ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.rwWaterBodies ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[300px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Storage and Forecasting", href: "/dss/default" }])}>
                          Storage and Forecasting
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Climate Change", href: "/dss/default" }])}>
                          Climate Change
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Reservoir Operation", href: "/dss/default" }])}>
                          Reservoir Operation
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Water Quality and Monitoring", href: "/dss/default" }])}>
                          Water Quality and Monitoring
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Waste Water Treatment */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("rwWasteWater", true)}
                    onMouseLeave={() => toggleDropdown("rwWasteWater", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "rwWasteWater")}
                    >
                      Waste Water Treatment
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.rwWasteWater ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.rwWasteWater ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[300px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Water Pollution and Inventory", href: "/dss/default" }])}>
                          Water Pollution and Inventory
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Treatment Technology", href: "/dss/default" }])}>
                          Treatment Technology
                        </Link>
                      </li>
                    </ul>
                  </li>
                  <li>
                    <Link href="/dss/rwm/rainwater" className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Rain Water Harvesting", href: "/dss/rwm/rainwater" }])}>
                      Rain Water Harvesting
                    </Link>
                  </li>
                </ul>
              </li>

              {/* WRM */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("wrm", true)}
                onMouseLeave={() => toggleDropdown("wrm", false)}
              >
                <button
                  onClick={() => toggleDropdown("wrm", !openDropdowns.wrm)}
                  className={navLinkClasses}
                >
                  WRM
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.wrm ? 'rotate-180' : ''}`} />
                  <span className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg border border-slate-600 font-medium">
                    Water Resource Management
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
                  </span>
                </button>
                <ul
                  className={`${openDropdowns.wrm ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[320px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  {/* Demand and Forecasting */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("wrmDemand", true)}
                    onMouseLeave={() => toggleDropdown("wrmDemand", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "wrmDemand")}
                    >
                      Demand and Forecasting
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.wrmDemand ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.wrmDemand ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[300px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Demand and Forecasting", href: "#" }, { label: "Current Consumption Pattern", href: "/dss/default" }])}>
                          Current Consumption Pattern
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Demand and Forecasting", href: "#" }, { label: "Future Demand Projection", href: "/dss/default" }])}>
                          Future Demand Projection
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Resource Allocation */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("wrmAllocation", true)}
                    onMouseLeave={() => toggleDropdown("wrmAllocation", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "wrmAllocation")}
                    >
                      Resource Allocation
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.wrmAllocation ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.wrmAllocation ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[220px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Resource Allocation", href: "#" }, { label: "Source Sustainability", href: "/dss/default" }])}>
                          Source Sustainability
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Resource Allocation", href: "#" }, { label: "Source Demarcation", href: "/dss/default" }])}>
                          Source Demarcation
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>

              {/* System Dynamics */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("shsd", true)}
                onMouseLeave={() => toggleDropdown("shsd", false)}
              >
                <button
                  onClick={() => toggleDropdown("shsd", !openDropdowns.shsd)}
                  className={navLinkClasses}
                >
                  <span className="hidden xl:inline">System Dynamics</span>
                  <span className="xl:hidden">System</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.shsd ? 'rotate-180' : ''}`} />
                </button>
                <ul
                  className={`${openDropdowns.shsd ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[280px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  {/* Resource Management */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("shsdResource", true)}
                    onMouseLeave={() => toggleDropdown("shsdResource", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "shsdResource")}
                    >
                      Resource Management
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.shsdResource ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.shsdResource ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[380px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Optimum and Sustainable Management", href: "/dss/default" }])}>
                          Optimum and Sustainable Management
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Sensitive Socio-Economic Factors", href: "/dss/default" }])}>
                          Sensitive Socio-Economic Factors
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "System Dynamics Modelling", href: "/dss/default" }])}>
                          System Dynamics Modelling
                        </Link>
                      </li>
                    </ul>
                  </li>

                  {/* Impact Assessment */}
                  <li
                    className="relative group/submenu"
                    onMouseEnter={() => toggleDropdown("shsdImpact", true)}
                    onMouseLeave={() => toggleDropdown("shsdImpact", false)}
                  >
                    <div
                      className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200 flex justify-between items-center cursor-pointer"
                      onClick={(e) => toggleSubmenu(e, "shsdImpact")}
                    >
                      Impact Assessment
                      <ChevronRight
                        className={`w-4 h-4 ${openDropdowns.shsdImpact ? "rotate-90" : ""
                          } lg:group-hover/submenu:rotate-0 transition-transform duration-200`}
                      />
                    </div>
                    <ul
                      className={`${openDropdowns.shsdImpact ? "block" : "hidden"
                        } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:shadow-2xl lg:border lg:border-slate-200 lg:rounded-xl lg:min-w-[250px] lg:p-2 lg:ml-2 lg:z-[200] ml-4 mt-1 lg:mt-0`}
                    >
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Impact Assessment", href: "#" }, { label: "Plant Solutions", href: "/dss/default" }])}>
                          Plant Solutions
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/dss/default"
                          className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                          onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Impact Assessment", href: "#" }, { label: "Optimization Framework", href: "/dss/default" }])}>
                          Optimization Framework
                        </Link>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>

              {/* Activities */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("activities", true)}
                onMouseLeave={() => toggleDropdown("activities", false)}
              >
                <button
                  onClick={() => toggleDropdown("activities", !openDropdowns.activities)}
                  className={navLinkClasses}
                >
                  Activities
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.activities ? 'rotate-180' : ''}`} />
                </button>
                <ul
                  className={`${openDropdowns.activities ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[240px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  <li>
                    <Link
                      href="/dss/activities/training_workshop"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Training and Workshop", href: "/dss/activities/training_workshop" }])}>
                      Training and Workshop
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/activities/confrence"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Confrence", href: "/dss/activities/confrence" }])}>
                      Conference
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/activities/exposure"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Gallery", href: "/dss/activities/exposure" }])}>
                      Exposure
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/activities/gallery"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Gallery", href: "/dss/activities/gallery" }])}>
                      Gallery
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Report and Publication */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("reportandpublication", true)}
                onMouseLeave={() => toggleDropdown("reportandpublication", false)}
              >
                <button
                  onClick={() => toggleDropdown("reportandpublication", !openDropdowns.reportandpublication)}
                  className={navLinkClasses}
                >
                  <span className="hidden xl:inline">Report & Publication</span>
                  <span className="xl:hidden">Reports</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.reportandpublication ? 'rotate-180' : ''}`} />
                </button>
                <ul
                  className={`${openDropdowns.reportandpublication ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[200px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  <li>
                    <Link
                      href="/dss/default"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Newsletter", href: "/dss/default" }])}>
                      Newsletter
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/default"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Brochure", href: "/dss/default" }])}>
                      Brochure
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Tools */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => toggleDropdown("Tools", true)}
                onMouseLeave={() => toggleDropdown("Tools", false)}
              >
                <button
                  onClick={() => toggleDropdown("Tools", !openDropdowns.Tools)}
                  className={navLinkClasses}
                >
                  Tools
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.Tools ? 'rotate-180' : ''}`} />
                </button>
                <ul
                  className={`${openDropdowns.Tools ? "block" : "hidden"
                    } lg:group-hover:block absolute left-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[200px] p-2 z-[200]
                    before:content-[''] before:absolute before:bottom-full before:left-6
                    before:border-8 before:border-transparent before:border-b-white`}
                >
                  <li>
                    <Link
                      href="/dss/Tools/vector_visual"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "Vector", href: "/dss/Tools/vector_visual" }])}>
                      Vector
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/Tools/raster_visual"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "Raster", href: "/dss/Tools/raster_visual" }])}>
                      Raster
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/Tools/watershed"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "Watershed", href: "/dss/watershed" }])}>
                      Watershed
                    </Link>
                  </li>
                  {/* <li>
                    <Link
                      href="/dss/Tools/model_water"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "Water", href: "/dss/Tools/model_water" }])}>
                      Water
                    </Link>
                  </li> */}
                  <li>
                    <Link
                      href="/dss/Tools/seawage_infrastructure"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "seawage_infrastructure", href: "/dss/Tools/seawage_infrastructure" }])}>
                      Seawage Infra
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dss/Tools/extractdata"
                      className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      onClick={() => handleMenuClick([{ label: "Tools", href: "#" }, { label: "Extract data", href: "/dss/extractdata" }])}>
                      Extract Data
                    </Link>
                  </li>
                </ul>
              </li>

            

              {/* User */}
              <li
                className="relative group flex-shrink-0"
                onMouseEnter={() => isLoggedIn && toggleDropdown("user", true)}
                onMouseLeave={() => isLoggedIn && toggleDropdown("user", false)}
              >
                <button
                  onClick={() => {
                    if (isLoggedIn) {
                      toggleDropdown("user", !openDropdowns.user);
                    } else {
                      handleOpenAuth("login");
                    }
                  }}
                  className={navLinkClasses}
                >
                  {isLoggedIn ? user_name : "Login"}
                  {isLoggedIn && <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openDropdowns.user ? 'rotate-180' : ''}`} />}
                </button>

                {/* Dropdown - Only shows when logged in */}
                {isLoggedIn && (
                  <ul
                    className={`${openDropdowns.user ? "block" : "hidden"
                      } lg:group-hover:block absolute right-0 top-[calc(100%+8px)] bg-white shadow-2xl border border-slate-200 rounded-xl min-w-[180px] p-2 z-[200]
                      before:content-[''] before:absolute before:bottom-full before:right-6
                      before:border-8 before:border-transparent before:border-b-white`}
                  >
                    <li>
                      <Link
                        href="/UserManagement/UserProfile"
                        className="block px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                        onClick={() =>
                          handleMenuClick([
                            { label: "Profile", href: "/UserManagement/UserProfile" },
                          ])
                        }
                      >
                        Profile
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-slate-700 font-medium text-sm hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-all duration-200"
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <AuthDialog
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialView={authView}
      />

      {/* Improved Breadcrumbs */}
      {/* {!isHomePage && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3.5 border-t border-slate-200 shadow-sm">
          <div className="container mx-auto flex justify-center items-center space-x-2 text-sm md:text-base overflow-x-auto pb-1">
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 whitespace-nowrap">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />
                )}
                {index < breadcrumbs.length - 1 ? (
                  <Link
                    href={item.href}
                    className="text-orange-500 hover:text-orange-600 transition-colors font-medium hover:underline underline-offset-2"
                    onClick={() => {
                      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                      handleMenuClick(newBreadcrumbs);
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-700 font-semibold">
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )} */}
    </>
  );
};

export default Navbar;
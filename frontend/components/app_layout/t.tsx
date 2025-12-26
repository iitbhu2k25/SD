"use client";
import { useState, useEffect, useRef, JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/components/authentication/logout";
import { startCase } from "lodash";

type BreadcrumbItem = {
  label: string;
  href: string;
};

type DropdownState = {
  [key: string]: boolean;
};

const staticBreadcrumbs: Record<string, BreadcrumbItem[]> = {
  "/dss/about": [{ label: "About", href: "/dss/about" }],
  "/dss/dashboard": [{ label: "Dashboard", href: "/dss/dashboard" }],
  "/dss/basic": [{ label: "Basic Module", href: "/dss/basic" }],
  "/UserManagement/UserProfile": [{ label: "Profile", href: "/UserManagement/UserProfile" }],
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
  "/dss/river": [
    { label: "RWM", href: "#" },
    { label: "Resource Estimation", href: "#" },
    { label: "Water Quality Assessment", href: "#" },
    { label: "Ground Based Assessment", href: "/dss/river" }
  ],
  "/dss/rwm/wwt/stp_priority": [
    { label: "RWM", href: "#" },
    { label: "Waste Water Treatment", href: "#" },
    { label: "STP Priority", href: "/dss/rwm/wwt/stp_priority" }
  ],
  "/dss/rwm/wwt/stp_suitability": [
    { label: "RWM", href: "#" },
    { label: "Waste Water Treatment", href: "#" },
    { label: "STP Suitability", href: "/dss/rwm/wwt/stp_suitability" }
  ],
  "/dss/rwm/rainwater": [
    { label: "RWM", href: "#" },
    { label: "Rain Water Harvesting", href: "/dss/rwm/rainwater" }
  ],
  "/dss/watershed": [
    { label: "Visualization", href: "#" },
    { label: "Watershed", href: "/dss/watershed" }
  ],
  "/dss/visualizations/vector_visual": [
    { label: "Visualization", href: "#" },
    { label: "Vector", href: "/dss/visualizations/vector_visual" }
  ],
  "/dss/visualizations/raster_visual": [
    { label: "Visualization", href: "#" },
    { label: "Raster", href: "/dss/visualizations/raster_visual" }
  ],
  "/dss/visualizations/model_water": [
    { label: "Visualization", href: "#" },
    { label: "Water", href: "/dss/visualizations/model_water" }
  ],
  "/dss/nmcg": [
    { label: "Visualization", href: "#" },
    { label: "NMCG", href: "/dss/nmcg" }
  ],
  "/dss/extractdata": [
    { label: "Visualization", href: "#" },
    { label: "Extract Data", href: "/dss/extractdata" }
  ],
  "/dss/components/gallery": [
    { label: "Activities", href: "#" },
    { label: "Gallery", href: "/dss/components/gallery" }
  ],
};

const Navbar = (): JSX.Element => {
  const [isSticky, setIsSticky] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [openDropdowns, setOpenDropdowns] = useState<DropdownState>({});
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: "Home", href: "/dss" }
  ]);
  const pathname = usePathname();

  const isHomePage =
    pathname === "/dss" ||
    pathname === "/dss/" ||
    pathname?.startsWith("/dss/home");

  const navRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  let user_name = useAuthStore((state) => state.user?.fullname) ?? 'User';
  user_name = startCase(user_name);
  if (user_name.length > 8) {
    user_name = user_name.slice(0, 5) + "...";
  }

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
        setBreadcrumbs([{ label: "Home", href: "/dss" }]);
      }
    } else {
      setBreadcrumbs([{ label: "Home", href: "/dss" }]);
    }
  }, [pathname]);

  const handleMenuClick = (path: BreadcrumbItem[]) => {
    setBreadcrumbs(path);
    sessionStorage.setItem('breadcrumbs', JSON.stringify(path));
    setOpenDropdowns({});
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const toggleDropdown = (key: string, open: boolean): void => {
    if (isMobile) return;

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

  const toggleSubmenu = (e: React.MouseEvent, key: string): void => {
    e.stopPropagation();
    e.preventDefault();
    setOpenDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const { handleLogout } = useLogout();

  const navLinkClasses = "text-white font-semibold text-base lg:text-base xl:text-lg px-3 lg:px-4 xl:px-5 py-3 lg:py-2 inline-block relative hover:translate-y-[-2px] transition-all duration-300 hover:after:w-full after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-blue-400 after:transition-all after:duration-300 whitespace-nowrap w-full lg:w-auto text-left";

  const dropdownButtonClasses = "text-white font-semibold text-base lg:text-base xl:text-lg px-3 lg:px-4 xl:px-5 py-3 lg:py-2 inline-flex items-center justify-between lg:justify-start w-full lg:w-auto relative hover:translate-y-[-2px] transition-all duration-300 hover:after:w-full after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-blue-400 after:transition-all after:duration-300";

  const submenuButtonClasses = "w-full text-left px-4 py-3 text-slate-700 font-semibold hover:bg-blue-50 rounded-md transition duration-200 flex justify-between items-center cursor-pointer";

  const submenuLinkClasses = "block px-4 py-3 text-slate-700 font-medium hover:bg-blue-50 rounded-md transition duration-200";

  return (
    <>
      <nav
        ref={navRef}
        className={`${isSticky
            ? "bg-slate-900 shadow-lg fixed top-0 left-0 w-full z-[100]"
            : "bg-gradient-to-r from-slate-800 to-slate-900"
          } py-3 relative transition-all duration-300 z-[100]`}
      >
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center lg:hidden">
            <div className="text-white font-bold text-lg">Decision Support System</div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white focus:outline-none p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-colors duration-200 z-[110]"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-[90] lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <div
            className={`
              ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
              lg:translate-x-0
              fixed lg:static
              top-0 left-0
              h-full lg:h-auto
              w-80 lg:w-full
              bg-slate-900 lg:bg-transparent
              overflow-y-auto lg:overflow-visible
              transition-transform duration-300 ease-in-out
              z-[100] lg:z-auto
              pt-16 lg:pt-0
              shadow-xl lg:shadow-none
            `}
          >
            <ul className="flex flex-col lg:flex-row lg:justify-center lg:items-center space-y-0 lg:space-y-0 lg:space-x-1 xl:space-x-2">

              {/* Home */}
              <li className="relative group border-b border-slate-700 lg:border-none">
                <Link
                  href="/dss"
                  className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "Home", href: "/dss" }])}
                >
                  Home
                </Link>
              </li>

              {/* Dashboard */}
              <li className="relative group border-b border-slate-700 lg:border-none">
                <Link
                  href="/dss/dashboard"
                  className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "Dashboard", href: "/dss/dashboard" }])}
                >
                  Dashboard
                </Link>
              </li>

              {/* Basic Modules */}
              <li className="relative group border-b border-slate-700 lg:border-none">
                <Link
                  href="/dss/basic"
                  className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "Basic Module", href: "/dss/basic" }])}
                >
                  Basic module
                </Link>
              </li>

              {/* GWM - Same as before, keeping it brief for space */}
              {/* GWM - Ground Water Management */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("gwm", true)}
                onMouseLeave={() => toggleDropdown("gwm", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "gwm")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.gwm}
                >
                  <span>GWM</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.gwm ? 'rotate-180' : ''}`} />
                  <span className="hidden lg:block absolute top-[-35px] left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg">
                    Ground Water Management
                  </span>
                </button>

                <div
                  className={`
      ${openDropdowns.gwm ? "block" : "hidden"}
      lg:absolute lg:left-0 lg:top-full lg:mt-1
      relative lg:bg-white lg:shadow-xl lg:rounded-lg
      lg:min-w-[420px] lg:p-2
      bg-slate-800 lg:bg-white
      lg:z-[110]
    `}
                >
                  <ul className="space-y-1">
                    {/* Groundwater Potential Assessment */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("gwPotential", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("gwPotential", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "gwPotential")}
                      >
                        <span>Groundwater Potential Assessment</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.gwPotential ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
            ${openDropdowns.gwPotential ? "block" : "hidden"}
            lg:absolute lg:left-full lg:top-0 lg:-ml-1
            lg:bg-white lg:shadow-xl lg:rounded-lg
            lg:min-w-[300px] lg:p-2
            ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
          `}
                      >
                        <li>
                          <Link
                            href="/dss/gwm/potential_zone"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Groundwater Potential Assessment", href: "#" },
                              { label: "GW Potential Zone", href: "/dss/gwm/potential_zone" }
                            ])}
                          >
                            GW Potential Zone
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/gwm/pumping_location"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Groundwater Potential Assessment", href: "#" },
                              { label: "Pumping Location Identification", href: "/dss/gwm/pumping_location" }
                            ])}
                          >
                            Pumping Location Identification
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Resource Estimation */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("gwResource", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("gwResource", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "gwResource")}
                      >
                        <span>Resource Estimation</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.gwResource ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
            ${openDropdowns.gwResource ? "block" : "hidden"}
            lg:absolute lg:left-full lg:top-0 lg:-ml-1
            lg:bg-white lg:shadow-xl lg:rounded-lg
            lg:min-w-[280px] lg:p-2
            ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
          `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Resource Estimation", href: "#" },
                              { label: "Recharge Estimation", href: "/dss/default" }
                            ])}
                          >
                            Recharge Estimation
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/gwm/resource_estimation/wqa"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Resource Estimation", href: "#" },
                              { label: "Water Quality Assessment", href: "/dss/gwm/resource_estimation/wqa" }
                            ])}
                          >
                            Water Quality Assessment
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Resource Estimation", href: "#" },
                              { label: "Vulnerability Assessment", href: "/dss/default" }
                            ])}
                          >
                            Vulnerability Assessment
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Resource Estimation", href: "#" },
                              { label: "Contamination Risk Assessment", href: "/dss/default" }
                            ])}
                          >
                            Contamination Risk Assessment
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Managed Aquifer Recharge */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("gwMAR", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("gwMAR", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "gwMAR")}
                      >
                        <span>Managed Aquifer Recharge</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.gwMAR ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
            ${openDropdowns.gwMAR ? "block" : "hidden"}
            lg:absolute lg:left-full lg:top-0 lg:-ml-1
            lg:bg-white lg:shadow-xl lg:rounded-lg
            lg:min-w-[280px] lg:p-2
            ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
          `}
                      >
                        <li>
                          <Link
                            href="/dss/gwm/MAR/GWA"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Managed Aquifer Recharge", href: "#" },
                              { label: "Need Assessment", href: "/dss/gwm/MAR/GWA" }
                            ])}
                          >
                            Need Assessment
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/gwm/MAR/SWA"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Managed Aquifer Recharge", href: "#" },
                              { label: "Water Source Estimation", href: "/dss/gwm/MAR/SWA" }
                            ])}
                          >
                            Water Source Estimation
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/gwm/mar_suitability"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Managed Aquifer Recharge", href: "#" },
                              { label: "MAR Site Suitability", href: "/dss/gwm/mar_suitability" }
                            ])}
                          >
                            MAR Site Suitability
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Groundwater Modelling */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("gwModelling", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("gwModelling", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "gwModelling")}
                      >
                        <span>Groundwater Modelling</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.gwModelling ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
            ${openDropdowns.gwModelling ? "block" : "hidden"}
            lg:absolute lg:left-full lg:top-0 lg:-ml-1
            lg:bg-white lg:shadow-xl lg:rounded-lg
            lg:min-w-[280px] lg:p-2
            ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
          `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Groundwater Modelling", href: "#" },
                              { label: "Flow Simulation", href: "/dss/default" }
                            ])}
                          >
                            Flow Simulation
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([
                              { label: "GWM", href: "#" },
                              { label: "Groundwater Modelling", href: "#" },
                              { label: "Contamination Modelling", href: "/dss/default" }
                            ])}
                          >
                            Contamination Modelling
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </li>

              {/* RWM - River Water Management */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("rwm", true)}
                onMouseLeave={() => toggleDropdown("rwm", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "rwm")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.rwm}
                >
                  <span>RWM</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.rwm ? 'rotate-180' : ''}`} />
                  <span className="hidden lg:block absolute top-[-35px] left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg">
                    River Water Management
                  </span>
                </button>

                <div
                  className={`
                    ${openDropdowns.rwm ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[420px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    {/* Resource Estimation */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("rwEstimation", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("rwEstimation", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "rwEstimation")}
                      >
                        <span>Resource Estimation</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.rwEstimation ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.rwEstimation ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[360px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Availability", href: "/dss/default" }])}
                          >
                            Water Availability
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Flow and Storage Estimation", href: "/dss/default" }])}
                          >
                            Water Flow and Storage Estimation
                          </Link>
                        </li>

                        {/* Water Quality Assessment (nested) */}
                        <li className="relative">
                          <div
                            className={submenuButtonClasses}
                            onClick={(e) => toggleSubmenu(e, 'wqa')}
                          >
                            <span>Water Quality Assessment</span>
                            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.wqa ? 'rotate-90' : ''}`} />
                          </div>
                          <ul className={`
                            ${openDropdowns.wqa ? 'block' : 'hidden'}
                            lg:absolute lg:left-full lg:top-0 lg:-ml-1
                            lg:bg-white lg:shadow-xl lg:rounded-lg
                            lg:min-w-[280px] lg:p-2
                            ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                          `}>
                            <li>
                              <Link
                                href="/dss/rwm/resource_estimation/river"
                                className={submenuLinkClasses}
                                onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "#" }, { label: "Ground Based Assessment", href: "/dss/river" }])}
                              >
                                Ground Based Assessment
                              </Link>
                            </li>
                            <li>
                              <Link
                                href="/default"
                                className={submenuLinkClasses}
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
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Vulnerability Assessment", href: "/dss/default" }])}
                          >
                            Vulnerability Assessment
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Contamination Risk Assessment", href: "/dss/default" }])}
                          >
                            Contamination Risk Assessment
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Flood Forecasting and Management */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("rwFlood", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("rwFlood", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "rwFlood")}
                      >
                        <span>Flood Forecasting and Management</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.rwFlood ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.rwFlood ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[340px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "Flood Simulation", href: "/dss/default" }])}
                          >
                            Flood Simulation
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "River Routing", href: "/dss/default" }])}
                          >
                            River Routing
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "Contamination Transport Modelling", href: "/dss/default" }])}
                          >
                            Contamination Transport Modelling
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Water Bodies Management */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("rwWaterBodies", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("rwWaterBodies", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "rwWaterBodies")}
                      >
                        <span>Water Bodies Management</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.rwWaterBodies ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.rwWaterBodies ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[300px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Storage and Forecasting", href: "/dss/default" }])}
                          >
                            Storage and Forecasting
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Climate Change", href: "/dss/default" }])}
                          >
                            Climate Change
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Reservoir Operation", href: "/dss/default" }])}
                          >
                            Reservoir Operation
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Water Quality and Monitoring", href: "/dss/default" }])}
                          >
                            Water Quality and Monitoring
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Waste Water Treatment */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("rwWasteWater", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("rwWasteWater", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "rwWasteWater")}
                      >
                        <span>Waste Water Treatment</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.rwWasteWater ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.rwWasteWater ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[300px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Water Pollution and Inventory", href: "/dss/default" }])}
                          >
                            Water Pollution and Inventory
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/rwm/wwt/stp_priority"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "STP Priority", href: "/dss/rwm/wwt/stp_priority" }])}
                          >
                            STP Priority
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/rwm/wwt/stp_suitability"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "STP Suitability", href: "/dss/rwm/wwt/stp_suitability" }])}
                          >
                            STP Suitability
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Treatment Technology", href: "/dss/default" }])}
                          >
                            Treatment Technology
                          </Link>
                        </li>
                      </ul>
                    </li>

                    <li>
                      <Link
                        href="/dss/rwm/rainwater"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Rain Water Harvesting", href: "/dss/rwm/rainwater" }])}
                      >
                        Rain Water Harvesting
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>

              {/* WRM - Water Resource Management */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("wrm", true)}
                onMouseLeave={() => toggleDropdown("wrm", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "wrm")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.wrm}
                >
                  <span>WRM</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.wrm ? 'rotate-180' : ''}`} />
                  <span className="hidden lg:block absolute top-[-35px] left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 shadow-lg">
                    Water Resource Management
                  </span>
                </button>

                <div
                  className={`
                    ${openDropdowns.wrm ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[320px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    {/* Demand and Forecasting */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("wrmDemand", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("wrmDemand", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "wrmDemand")}
                      >
                        <span>Demand and Forecasting</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.wrmDemand ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.wrmDemand ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[280px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Demand and Forecasting", href: "#" }, { label: "Current Consumption Pattern", href: "/dss/default" }])}
                          >
                            Current Consumption Pattern
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Demand and Forecasting", href: "#" }, { label: "Future Demand Projection", href: "/dss/default" }])}
                          >
                            Future Demand Projection
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Resource Allocation */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("wrmAllocation", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("wrmAllocation", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "wrmAllocation")}
                      >
                        <span>Resource Allocation</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.wrmAllocation ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.wrmAllocation ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[240px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Resource Allocation", href: "#" }, { label: "Source Sustainability", href: "/dss/default" }])}
                          >
                            Source Sustainability
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Resource Allocation", href: "#" }, { label: "Source Demarcation", href: "/dss/default" }])}
                          >
                            Source Demarcation
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </li>

              {/* System Dynamics */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("shsd", true)}
                onMouseLeave={() => toggleDropdown("shsd", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "shsd")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.shsd}
                >
                  <span className="hidden xl:inline">System Dynamics</span>
                  <span className="xl:hidden">System</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.shsd ? 'rotate-180' : ''}`} />
                </button>

                <div
                  className={`
                    ${openDropdowns.shsd ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[280px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    {/* Resource Management */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("shsdResource", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("shsdResource", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "shsdResource")}
                      >
                        <span>Resource Management</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.shsdResource ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.shsdResource ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[380px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Optimum and Sustainable Management", href: "/dss/default" }])}
                          >
                            Optimum and Sustainable Management
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Sensitive Socio-Economic Factors", href: "/dss/default" }])}
                          >
                            Sensitive Socio-Economic Factors
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "System Dynamics Modelling", href: "/dss/default" }])}
                          >
                            System Dynamics Modelling
                          </Link>
                        </li>
                      </ul>
                    </li>

                    {/* Impact Assessment */}
                    <li
                      className="relative"
                      onMouseEnter={() => !isMobile && toggleDropdown("shsdImpact", true)}
                      onMouseLeave={() => !isMobile && toggleDropdown("shsdImpact", false)}
                    >
                      <div
                        className={submenuButtonClasses}
                        onClick={(e) => toggleSubmenu(e, "shsdImpact")}
                      >
                        <span>Impact Assessment</span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openDropdowns.shsdImpact ? "rotate-90" : ""}`} />
                      </div>
                      <ul
                        className={`
                          ${openDropdowns.shsdImpact ? "block" : "hidden"}
                          lg:absolute lg:left-full lg:top-0 lg:-ml-1
                          lg:bg-white lg:shadow-xl lg:rounded-lg
                          lg:min-w-[260px] lg:p-2
                          ml-4 lg:ml-0 mt-1 lg:mt-0 space-y-1
                        `}
                      >
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Impact Assessment", href: "#" }, { label: "Plant Solutions", href: "/dss/default" }])}
                          >
                            Plant Solutions
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/dss/default"
                            className={submenuLinkClasses}
                            onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Impact Assessment", href: "#" }, { label: "Optimization Framework", href: "/dss/default" }])}
                          >
                            Optimization Framework
                          </Link>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </div>
              </li>

              {/* Activities */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("activities", true)}
                onMouseLeave={() => toggleDropdown("activities", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "activities")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.activities}
                >
                  <span>Activities</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.activities ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`
                    ${openDropdowns.activities ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[240px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/dss/default"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Training and Workshop", href: "/dss/default" }])}
                      >
                        Training and Workshop
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/components/gallery"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Gallery", href: "/dss/components/gallery" }])}
                      >
                        Gallery
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>

              {/* Report and Publication */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("reportandpublication", true)}
                onMouseLeave={() => toggleDropdown("reportandpublication", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "reportandpublication")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.reportandpublication}
                >
                  <span className="hidden xl:inline">Report & Publication</span>
                  <span className="xl:hidden">Reports</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.reportandpublication ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`
                    ${openDropdowns.reportandpublication ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[200px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/dss/default"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Newsletter", href: "/dss/default" }])}
                      >
                        Newsletter
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Brochure", href: "/dss/default" }])}
                      >
                        Brochure
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>

              {/* Visualization */}
              <li
                className="relative group border-b border-slate-700 lg:border-none"
                onMouseEnter={() => toggleDropdown("visualization", true)}
                onMouseLeave={() => toggleDropdown("visualization", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "visualization")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.visualization}
                >
                  <span>Visualization</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.visualization ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`
                    ${openDropdowns.visualization ? "block" : "hidden"}
                    lg:absolute lg:left-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[180px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/dss/visualizations/vector_visual"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Vector", href: "/dss/visualizations/vector_visual" }])}
                      >
                        Vector
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/visualizations/raster_visual"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Raster", href: "/dss/visualizations/raster_visual" }])}
                      >
                        Raster
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/visualizations/watershed"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Watershed", href: "/dss/watershed" }])}
                      >
                        Watershed
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/visualizations/model_water"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Water", href: "/dss/visualizations/model_water" }])}
                      >
                        Water
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/visualizations/nmcg"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "NMCG", href: "/dss/nmcg" }])}
                      >
                        NMCG
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/visualizations/extractdata"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Extract data", href: "/dss/extractdata" }])}
                      >
                        Extract Data
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>

              {/* About */}
              <li className="relative group border-b border-slate-700 lg:border-none">
                <Link
                  href="/dss/about"
                  className={navLinkClasses}
                  onClick={() => handleMenuClick([{ label: "About", href: "/dss/about" }])}
                >
                  About
                </Link>
              </li>

              {/* User Profile */}
              <li
                className="relative group"
                onMouseEnter={() => toggleDropdown("user", true)}
                onMouseLeave={() => toggleDropdown("user", false)}
              >
                <button
                  onClick={(e) => toggleSubmenu(e, "user")}
                  className={dropdownButtonClasses}
                  aria-expanded={openDropdowns.user}
                >
                  <span>Profile</span>
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${openDropdowns.user ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`
                    ${openDropdowns.user ? "block" : "hidden"}
                    lg:absolute lg:right-0 lg:top-full lg:mt-1
                    relative lg:bg-white lg:shadow-xl lg:rounded-lg
                    lg:min-w-[180px] lg:p-2
                    bg-slate-800 lg:bg-white
                    lg:z-[110]
                  `}
                >
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/UserManagement/UserProfile"
                        className={submenuLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Profile", href: "/UserManagement/UserProfile" }])}
                      >
                        {user_name}
                      </Link>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-3 text-slate-700 font-medium hover:bg-blue-50 rounded-md transition duration-200"
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      {!isHomePage && (
        <div className="bg-gray-100 px-4 py-3 border-t border-slate-300 sticky top-[60px] lg:static z-[90]">
          <div className="container mx-auto flex justify-center items-center space-x-2 text-sm md:text-base overflow-x-auto pb-1">
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 whitespace-nowrap">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-slate-500 flex-shrink-0" />
                )}
                {index < breadcrumbs.length - 1 ? (
                  <Link
                    href={item.href}
                    className="text-blue-600 hover:text-blue-800 transition-colors font-medium hover:underline"
                    onClick={() => {
                      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                      handleMenuClick(newBreadcrumbs);
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-slate-800 font-bold">
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
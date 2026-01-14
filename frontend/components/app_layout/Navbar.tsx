"use client";
import { useState, useEffect, useRef, JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
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
  // Main Pages
  "/dss/about": [{ label: "About", href: "/dss/about" }],
  "/dss/dashboard": [{ label: "Dashboard", href: "/dss/dashboard" }],
  "/dss/basic": [{ label: "Basic Module", href: "/dss/basic" }],
  "/UserManagement/UserProfile": [{ label: "Profile", href: "/UserManagement/UserProfile" }],
  
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
  
  // Visualization
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
  "/dss/seawage_infrastructure": [
     { label: "Visualization", href: "#" }, 
     { label: "seawage_infrastructure", href: "/dss/seawage_infrastructure" }
  ],
  "/dss/extractdata": [
     { label: "Visualization", href: "#" }, 
     { label: "Extract Data", href: "/dss/extractdata" }
  ],

  // Activities
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
  
  // CHECK: Is the current page the Home page OR a sub-route of the Home Grid?
  // This ensures breadcrumbs don't show on home sub-pages
  const isHomePage = 
    pathname === "/dss" || 
    pathname === "/dss/" || 
    pathname?.startsWith("/dss/home");

  const navRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  let user_name = useAuthStore((state) => state.user?.fullname) ?? 'User';
  user_name = startCase(user_name);
  if (user_name.length > 8) {
    user_name = user_name.slice(0, 5) + "...";
  }

  // --- UPDATED LOGIC: Breadcrumb Loader ---
  useEffect(() => {
    // 1. Priority Check: Is this URL in our static map?
    if (staticBreadcrumbs[pathname]) {
      const mappedCrumbs = staticBreadcrumbs[pathname];
      setBreadcrumbs(mappedCrumbs);
      sessionStorage.setItem('breadcrumbs', JSON.stringify(mappedCrumbs));
      return;
    }

    // 2. Fallback: Check Session Storage (for complex state)
    const storedBreadcrumbs = sessionStorage.getItem('breadcrumbs');
    if (storedBreadcrumbs) {
      try {
        const parsed = JSON.parse(storedBreadcrumbs);
        setBreadcrumbs(parsed);
      } catch (e) {
        setBreadcrumbs([{ label: "Home", href: "/dss" }]);
      }
    } else {
      // 3. Default
      setBreadcrumbs([{ label: "Home", href: "/dss" }]);
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

  // Common navbar link classes
  const navLinkClasses = "text-white font-semibold text-lg lg:text-base xl:text-lg px-3 lg:px-4 xl:px-5 py-2 inline-block relative hover:translate-y-[-2px] transition-all duration-300 hover:after:w-full after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-blue-600 after:transition-all after:duration-300 whitespace-nowrap";

  return (
    <>
      <nav
      ref={navRef}
      className={`${isSticky
        ? "bg-orange-300 shadow-md fixed top-0 left-0 w-full z-200"
        : "bg-gradient-to-r from-slate-800 to-slate-900"
        } py-3 relative transition-all duration-300 z-200`}
    >
      <div className="container mx-auto px-4">
        {/* Mobile menu button */}
        <div className="flex justify-between items-center lg:hidden">
          <div className="text-white font-bold text-lg">Decision Support System</div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-white focus:outline-none p-2 rounded-md hover:bg-white hover:bg-opacity-10 transition-colors duration-200"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Navbar items */}
        <div className={`${isMobileMenuOpen ? "block" : "hidden"} lg:block`}>
          <ul className="flex flex-col lg:flex-row lg:justify-center lg:items-center space-y-2 lg:space-y-0 lg:space-x-1 xl:space-x-2 overflow-x-auto lg:overflow-visible">

            {/* Home */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss" className={navLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Home", href: "/dss" }])}>
                Home
              </Link>
            </li>

            {/* Dashboard */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/dashboard" className={navLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Dashboard", href: "/dss/dashboard" }])}>
                Dashboard
              </Link>
            </li>

            {/* Basic Modules */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/basic" className={navLinkClasses}
                        onClick={() => handleMenuClick([{ label: "Basic Module", href: "/dss/basic" }])}>
                Basic module
              </Link>
            </li>

            {/* gwm */}
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
                <span className="absolute top-[-15px] left-1/2 transform -translate-x-1/2 bg-orange-500 bg-opacity-90 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 after:content-[''] after:absolute after:top-full after:left-1/2 after:ml-[-5px] after:border-[5px] after:border-solid after:border-t-blue-900 after:border-r-transparent after:border-b-transparent after:border-l-transparent z-100">
                  Ground Water Management
                </span>
              </button>
              <ul
                className={`${openDropdowns.gwm ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[400px] p-3 z-200`}
              >
                {/* Groundwater Potential Assessment */}
                <li
                  className="relative group/submenu"
                  onMouseEnter={() => toggleDropdown("gwPotential", true)}
                  onMouseLeave={() => toggleDropdown("gwPotential", false)}
                >
                  <div
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "gwPotential")}
                  >
                    Groundwater Potential Assessment
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.gwPotential ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.gwPotential ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/gwm/pumping_location"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Groundwater Potential Assessment", href: "#" }, { label: "Pumping Location Identification", href: "/dss/gwm/pumping_location" }])}>
                        Pumping Location Identification
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/potential_zone"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "gwResource")}
                  >
                    Resource Estimation
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.gwResource ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.gwResource ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/gwm/rsq"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Regional Scale Quantification", href: "/dss/default" }])}>
                        Regional Scale Quantification
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/resource_estimation/wqa"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "/dss/gwm/resource_estimation/wqa" }])}>
                        Water Quality Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "gwAquifer")}
                  >
                    Managed Aquifer Recharge
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.gwAquifer ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.gwAquifer ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/gwm/MAR/GWA"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "Need Assessment", href: "/dss/gwm/MAR/GWA" }])}>
                        Need Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/MAR/SWA"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "Water Source Estimation", href: "/dss/gwm/MAR/SWA" }])}
                      >
                        Water Source Estimation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/mar_suitability"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "Managed Aquifer Recharge", href: "#" }, { label: "MAR site Suitability", href: "/dss/gwm/mar_suitability" }])}>
                        MAR site Suitability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "gwRiver")}
                  >
                    River Aquifer Interaction
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.gwRiver ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.gwRiver ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "River Aquifer Interaction", href: "#" }, { label: "Baseflow Estimation", href: "/dss/default" }])}>
                        Baseflow Estimation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "GWM", href: "#" }, { label: "River Aquifer Interaction", href: "#" }, { label: "Climate Change and Mitigation", href: "/dss/default" }])}>
                        Climate Change and Mitigation
                      </Link>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>

            {/* rwm */}
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
                <span className="absolute top-[-15px] left-1/2 transform -translate-x-1/2 bg-orange-500 bg-opacity-90 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 after:content-[''] after:absolute after:top-full after:left-1/2 after:ml-[-5px] after:border-[5px] after:border-solid after:border-t-blue-900 after:border-r-transparent after:border-b-transparent after:border-l-transparent z-10">
                  River Water Management
                </span>
              </button>
              <ul
                className={`${openDropdowns.rwm ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[400px] p-3 z-200`}
              >
                {/* Resource Estimation */}
                <li
                  className="relative group/submenu"
                  onMouseEnter={() => toggleDropdown("rwEstimation", true)}
                  onMouseLeave={() => toggleDropdown("rwEstimation", false)}
                >
                  <div
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "rwEstimation")}
                  >
                    Resource Estimation
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.rwEstimation ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.rwEstimation ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Availability", href: "/dss/default" }])}>
                        Water Availability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Flow and Storage Estimation", href: "/dss/default" }])}>
                        Water Flow and Storage Estimation
                      </Link>
                    </li>
                    <li className="relative group/submenu">
                      <div
                        className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                        onClick={(e) => toggleSubmenu(e, 'wqa')}
                      >
                        Water Quality Assessment
                        <ChevronRight className={`w-4 h-4 ${openDropdowns.wqa ? 'rotate-90' : ''} lg:group-hover/submenu:rotate-90 transition-transform duration-200`} />
                      </div>

                      <ul className={`${openDropdowns.wqa ? 'block' : 'hidden'} lg:hidden lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-50 ml-4`}>

                        {/* Ground Based Assessment */}
                        <li className="relative group/submenu">
                          <Link href="/dss/rwm/resource_estimation/river"
                            className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                            onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Water Quality Assessment", href: "#" }, { label: "Ground Based Assessment", href: "/dss/river" }])}
                          >
                            Ground Based Assessment
                          </Link>
                        </li>

                        {/* Satellite Based Assessment */}
                        <li>
                          <Link href="https://dssiitbhu.users.earthengine.app/view/water-budget" className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
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
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Resource Estimation", href: "#" }, { label: "Vulnerability Assessment", href: "/dss/default" }])}>
                        Vulnerability Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "rwFlood")}
                  >
                    Flood Forecasting and Management
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.rwFlood ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.rwFlood ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "Flood Simulation", href: "/dss/default" }])}>
                        Flood Simulation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Flood Forecasting", href: "#" }, { label: "River Routing", href: "/dss/default" }])}>
                        River Routing
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "rwWaterBodies")}
                  >
                    Water Bodies Management
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.rwWaterBodies ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.rwWaterBodies ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Storage and Forecasting", href: "/dss/default" }])}>
                        Storage and Forecasting
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Climate Change", href: "/dss/default" }])}>
                        Climate Change
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Water Bodies Management", href: "#" }, { label: "Reservoir Operation", href: "/dss/default" }])}>
                        Reservoir Operation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "rwWasteWater")}
                  >
                    Waste Water Treatment
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.rwWasteWater ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.rwWasteWater ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Water Pollution and Inventory", href: "/dss/default" }])}>
                        Water Pollution and Inventory
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/rwm/wwt/stp_priority"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "STP Priority", href: "/dss/rwm/wwt/stp_priority" }])}>
                        STP Priority
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/rwm/wwt/stp_suitability"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "STP Suitability", href: "/dss/rwm/wwt/stp_suitability" }])}>
                        STP Suitability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Waste Water Treatment", href: "#" }, { label: "Treatment Technology", href: "/dss/default" }])}>
                        Treatment Technology
                      </Link>
                    </li>
                  </ul>
                </li>
                <li>
                  <Link href="/dss/rwm/rainwater" className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  onClick={() => handleMenuClick([{ label: "RWM", href: "#" }, { label: "Rain Water Harvesting", href: "/dss/rwm/rainwater" }])}>
                    Rain Water Harvesting
                  </Link>
                </li>
              </ul>
            </li>

            {/* wrm */}
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
                <span className="absolute top-[-15px] left-1/2 transform -translate-x-1/2 bg-orange-500 bg-opacity-90 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 after:content-[''] after:absolute after:top-full after:left-1/2 after:ml-[-5px] after:border-[5px] after:border-solid after:border-t-blue-900 after:border-r-transparent after:border-b-transparent after:border-l-transparent z-10">
                  Water Resource Management
                </span>
              </button>
              <ul
                className={`${openDropdowns.wrm ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[300px] p-3 z-200`}
              >
                {/* Demand and Forecasting */}
                <li
                  className="relative group/submenu"
                  onMouseEnter={() => toggleDropdown("wrmDemand", true)}
                  onMouseLeave={() => toggleDropdown("wrmDemand", false)}
                >
                  <div
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "wrmDemand")}
                  >
                    Demand and Forecasting
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.wrmDemand ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.wrmDemand ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Demand and Forecasting", href: "#" }, { label: "Current Consumption Pattern", href: "/dss/default" }])}>
                        Current Consumption Pattern
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "wrmAllocation")}
                  >
                    Resource Allocation
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.wrmAllocation ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.wrmAllocation ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[220px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "WRM", href: "#" }, { label: "Resource Allocation", href: "#" }, { label: "Source Sustainability", href: "/dss/default" }])}>
                        Source Sustainability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
              className="relative group flex-shrink-0 tooltip-container"
              onMouseEnter={() => toggleDropdown("shsd", true)}
              onMouseLeave={() => toggleDropdown("shsd", false)}
            >
              <button
                onClick={() => toggleDropdown("shsd", !openDropdowns.shsd)}
                className={navLinkClasses}
                data-tooltip="Hydrological System Dynamics"
              >
                <span className="hidden xl:inline">System Dynamics</span>
                <span className="xl:hidden">System</span>
              </button>
              <ul
                className={`${openDropdowns.shsd ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[250px] p-3 z-200`}
              >
                {/* Resource Management */}
                <li
                  className="relative group/submenu"
                  onMouseEnter={() => toggleDropdown("shsdResource", true)}
                  onMouseLeave={() => toggleDropdown("shsdResource", false)}
                >
                  <div
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "shsdResource")}
                  >
                    Resource Management
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.shsdResource ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.shsdResource ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[360px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Optimum and Sustainable Management", href: "/dss/default" }])}>
                        Optimum and Sustainable Management
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Resource Management", href: "#" }, { label: "Sensitive Socio-Economic Factors", href: "/dss/default" }])}>
                        Sensitive Socio-Economic Factors
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200 flex justify-between items-center cursor-pointer"
                    onClick={(e) => toggleSubmenu(e, "shsdImpact")}
                  >
                    Impact Assessment
                    <ChevronRight
                      className={`w-4 h-4 ${openDropdowns.shsdImpact ? "rotate-90" : ""
                        } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${openDropdowns.shsdImpact ? "block" : "hidden"
                      } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[250px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
                        onClick={() => handleMenuClick([{ label: "System Dynamics", href: "#" }, { label: "Impact Assessment", href: "#" }, { label: "Plant Solutions", href: "/dss/default" }])}>
                        Plant Solutions
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      
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
              </button>
              <ul
                className={`${openDropdowns.activities ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[220px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Training and Workshop", href: "/dss/default" }])}>
                    Training and Workshop
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/components/gallery"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Activities", href: "#" }, { label: "Gallery", href: "/dss/components/gallery" }])}>
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
              </button>
              <ul
                className={`${openDropdowns.reportandpublication ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[200px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Newsletter", href: "/dss/default" }])}>
                    Newsletter
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Report & Publication", href: "#" }, { label: "Brochure", href: "/dss/default" }])}>
                    Brochure
                  </Link>
                </li>
              </ul>
            </li>

            {/* Visualization */}
            <li
              className="relative group flex-shrink-0"
              onMouseEnter={() => toggleDropdown("visualization", true)}
              onMouseLeave={() => toggleDropdown("visualization", false)}
            >
              <button
                onClick={() => toggleDropdown("visualization", !openDropdowns.visualization)}
                className={navLinkClasses}
              >
                Visualization
              </button>
              <ul
                className={`${openDropdowns.visualization ? "block" : "hidden"
                  } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[150px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/visualizations/vector_visual"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Vector", href: "/dss/visualizations/vector_visual" }])}>
                    Vector
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/raster_visual"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Raster", href: "/dss/visualizations/raster_visual" }])}>
                    Raster
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/watershed"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Watershed", href: "/dss/watershed" }])}>
                    Watershed
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/model_water"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Water", href: "/dss/visualizations/model_water" }])}>
                    Water
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/seawage_infrastructure"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                   onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "seawage_infrastructure", href: "/dss/visualizations/seawage_infrastructure" }])}>
                    NMCG
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/extractdata"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                   onClick={() => handleMenuClick([{ label: "Visualization", href: "#" }, { label: "Extract data", href: "/dss/extractdata" }])}>
                    Extract Data
                  </Link>
                </li>
              </ul>
            </li>

            {/* About */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/about" className={navLinkClasses}
                        onClick={() => handleMenuClick([{ label: "About", href: "/dss/about" }])}>
                About
              </Link>
            </li>

            {/* User */}
            <li
              className="relative group flex-shrink-0"
              onMouseEnter={() => toggleDropdown("user", true)}
              onMouseLeave={() => toggleDropdown("user", false)}
            >
              <button
                onClick={() => toggleDropdown("user", !openDropdowns.user)}
                className={navLinkClasses}
              >
                Profile
              </button>
              <ul
                className={`${openDropdowns.user ? "block" : "hidden"
                  } lg:group-hover:block absolute right-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[150px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/UserManagement/UserProfile"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  
                        onClick={() => handleMenuClick([{ label: "Profile", href: "/UserManagement/UserProfile" }])}>
                    {user_name}
                  </Link>
                </li>
                <li>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Logout
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>


      {!isHomePage && (
       
        <div className="bg-gray-100 px-4 py-3 border-t border-slate-600">
          <div className="container mx-auto flex justify-center items-center space-x-2 text-sm md:text-base overflow-x-auto pb-1">
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 whitespace-nowrap">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-orange-400 flex-shrink-0" />
                )}
                {index < breadcrumbs.length - 1 ? (
                  <Link
                    href={item.href}
                    className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                    onClick={() => {
                      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                      handleMenuClick(newBreadcrumbs);
                    }}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-amber-600 font-bold">
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
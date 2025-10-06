"use client";
import { useState, useEffect, useRef, JSX } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Menu, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/components/authentication/logout";
import { startCase } from "lodash";

type DropdownState = {
  [key: string]: boolean;
};

const Navbar = (): JSX.Element => {
  const [isSticky, setIsSticky] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [openDropdowns, setOpenDropdowns] = useState<DropdownState>({});
  const navRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  let user_name = useAuthStore((state) => state.user?.fullname) ?? 'User';
  user_name = startCase(user_name);
  if (user_name.length > 8) {
    user_name = user_name.slice(0, 5) + "...";
  }

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
    <nav
      ref={navRef}
      className={`${
        isSticky
          ? "bg-orange-300 shadow-md fixed top-0 left-0 w-full z-200"
          : "bg-opacity-10 bg-[#081F5C]"
        } border-b border-white border-opacity-20 py-4 relative transition-all duration-300 z-200`}
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
              <Link href="/dss" className={navLinkClasses}>
                Home
              </Link>
            </li>

            {/* Dashboard */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/dashboard" className={navLinkClasses}>
                Dashboard
              </Link>
            </li>

            {/* Basic Modules */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/basic" className={navLinkClasses}>
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
                className={`${
                  openDropdowns.gwm ? "block" : "hidden"
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
                      className={`w-4 h-4 ${
                        openDropdowns.gwPotential ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.gwPotential ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/gwm/pumping_location"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Pumping Location Identification
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/potential_zone"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.gwResource ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.gwResource ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Regional Scale Quantification
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/resource_estimation/wqa"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Quality Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.gwAquifer ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.gwAquifer ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/gwm/MAR/GWA"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Need Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Source Estimation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/gwm/mar_suitability"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        MAR site Suitability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.gwRiver ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.gwRiver ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Baseflow Estimation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                className={`${
                  openDropdowns.rwm ? "block" : "hidden"
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
                      className={`w-4 h-4 ${
                        openDropdowns.rwEstimation ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.rwEstimation ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Availability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Flow and Storage Estimation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Quality Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Vulnerability Assessment
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.rwFlood ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.rwFlood ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[320px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Flood Simulation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        River Routing
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.rwWaterBodies ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.rwWaterBodies ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Storage and Forecasting
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Climate Change
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Reservoir Operation
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.rwWasteWater ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.rwWasteWater ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Water Pollution and Inventory
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/rwm/wwt/stp_priority"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        STP Priority
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/rwm/wwt/stp_suitability"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        STP Suitability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Treatment Technology
                      </Link>
                    </li>
                  </ul>
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
                className={`${
                  openDropdowns.wrm ? "block" : "hidden"
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
                      className={`w-4 h-4 ${
                        openDropdowns.wrmDemand ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.wrmDemand ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[300px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Current Consumption Pattern
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.wrmAllocation ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.wrmAllocation ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[220px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Source Sustainability
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                className={`${
                  openDropdowns.shsd ? "block" : "hidden"
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
                      className={`w-4 h-4 ${
                        openDropdowns.shsdResource ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.shsdResource ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[360px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Optimum and Sustainable Management
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Sensitive Socio-Economic Factors
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                      className={`w-4 h-4 ${
                        openDropdowns.shsdImpact ? "rotate-90" : ""
                      } lg:group-hover/submenu:rotate-90 transition-transform duration-200`}
                    />
                  </div>
                  <ul
                    className={`${
                      openDropdowns.shsdImpact ? "block" : "hidden"
                    } lg:group-hover/submenu:block lg:absolute lg:left-full lg:top-0 lg:bg-white lg:bg-opacity-95 lg:border lg:border-gray-200 lg:border-opacity-10 lg:rounded-lg lg:shadow-lg lg:min-w-[250px] lg:p-3 lg:ml-1 lg:z-200 ml-4`}
                  >
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
                        Plant Solutions
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/dss/default"
                        className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                      >
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
                className={`${
                  openDropdowns.activities ? "block" : "hidden"
                } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[220px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Training and Workshop
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/components/gallery"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
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
                className={`${
                  openDropdowns.reportandpublication ? "block" : "hidden"
                } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[200px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Newsletter
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/default"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
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
                className={`${
                  openDropdowns.visualization ? "block" : "hidden"
                } lg:group-hover:block absolute left-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[150px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/dss/visualizations/vector_visual"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Vector
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/visualizations/raster_visual"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Raster
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dss/watershed"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
                    Watershed
                  </Link>
                </li>
              </ul>
            </li>

            {/* About */}
            <li className="relative group flex-shrink-0">
              <Link href="/dss/about" className={navLinkClasses}>
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
                className={`${
                  openDropdowns.user ? "block" : "hidden"
                } lg:group-hover:block absolute right-0 top-[calc(100%+2px)] bg-white bg-opacity-95 border border-gray-200 border-opacity-10 rounded-lg shadow-lg min-w-[150px] p-3 z-200`}
              >
                <li>
                  <Link
                    href="/UserManagement/UserProfile"
                    className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50 hover:bg-opacity-10 rounded-md transition duration-200"
                  >
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
  );
};

export default Navbar;
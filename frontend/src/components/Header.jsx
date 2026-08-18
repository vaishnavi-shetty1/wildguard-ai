import React, { useEffect, useState } from "react";
import {
  Shield,
  LogOut,
  User2,
  Bell,
  MapPin,
  Radio,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";

const Header = ({
  activeTab = "home",
  setActiveTab,
  unreadCount = 0,
  onOpenNotifications,
}) => {
  const navigate = useNavigate();

  const [time, setTime] = useState("");
  const [showProfileMenu, setShowProfileMenu] =
    useState(false);

  const [currentUser, setCurrentUser] =
    useState(null);

  //load current user
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser =
          localStorage.getItem(
            "wildguard_user"
          );

        if (storedUser) {
          setCurrentUser(
            JSON.parse(storedUser)
          );
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error(
          "Unable to load user:",
          error
        );

        setCurrentUser(null);
      }
    };

    loadUser();

    /*
     * Allows Header to update if another component
     * changes the authentication state.
     */

    window.addEventListener(
      "storage",
      loadUser
    );

    return () => {
      window.removeEventListener(
        "storage",
        loadUser
      );
    };
  }, []);

 // SYSTEM LOCAL TIME
useEffect(() => {
  const updateTime = () => {
    const now = new Date();
    setTime(
      now.toLocaleString([], {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    );
  };
  // Display immediately
  updateTime();
  // Update every second
  const interval = setInterval(updateTime, 1000);
  return () => clearInterval(interval);
}, []);

  //role

  const getRoleName = () => {
    if (!currentUser) return "Guest";

    switch (currentUser.role) {
      case "admin":
        return "Administrator";

      case "operator":
        return "Forest Operator";

      case "landowner":
        return "Landowner";

      case "village_head":
        return "Village Head";

      default:
        return "User";
    }
  };

  const getRoleColor = () => {
    if (!currentUser) {
      return "text-slate-400";
    }

    switch (currentUser.role) {
      case "admin":
        return "text-purple-400";

      case "operator":
        return "text-emerald-400";

      case "landowner":
        return "text-amber-400";

      case "village_head":
        return "text-blue-400";

      default:
        return "text-emerald-400";
    }
  };

  const getRoleBadge = () => {
    if (!currentUser) return "";

    switch (currentUser.role) {
      case "admin":
        return "ADMIN NODE";

      case "operator":
        return "OPERATOR NODE";

      case "landowner":
        return "LANDOWNER NODE";

      case "village_head":
        return "VILLAGE NODE";

      default:
        return "USER NODE";
    }
  };

  // role based navigation

  const getTabs = () => {
    if (!currentUser) {
      return [
        {
          id: "home",
          label: "Overview",
        },
      ];
    }

    //landowner

    if (
      currentUser.role ===
      "landowner"
    ) {
      return [
        {
          id: "home",
          label: "Overview",
        },
        {
          id: "stakeholder",
          label: "Farm Portal & SOS",
        },
        {
          id: "sms",
          label: "SMS Alerts",
        },
        {
          id: "dashboard",
          label: "Threat Radar",
        },
      ];
    }

    //village head

    if (
      currentUser.role ===
      "village_head"
    ) {
      return [
        {
          id: "home",
          label: "Overview",
        },
        {
          id: "stakeholder",
          label: "Village Portal & SOS",
        },
        {
          id: "sms",
          label: "SMS Alerts",
        },
        {
          id: "dashboard",
          label: "Threat Radar",
        },
      ];
    }

    //field operator

    if (
      currentUser.role ===
      "operator"
    ) {
      return [
        {
          id: "home",
          label: "Overview",
        },
        {
          id: "dashboard",
          label: "Live Monitor",
        },
        {
          id: "sms",
          label: "SMS Center",
        },
        {
          id: "training",
          label: "Classifier Training",
        },
      ];
    }

    //admin

    if (
      currentUser.role ===
      "admin"
    ) {
      return [
        {
          id: "home",
          label: "Overview",
        },
        {
          id: "dashboard",
          label: "Live Monitor",
        },
        {
          id: "sms",
          label: "SMS Center",
        },
        {
          id: "training",
          label: "Classifier Training",
        },
        {
          id: "admin",
          label: "Control Panel",
        },
      ];
    }

    return [];
  };

  const tabs = getTabs();

  // navigation tabs

  const handleTabChange = (tabId) => {
    setShowProfileMenu(false);

    if (setActiveTab) {
      setActiveTab(tabId);
    }

    /*
     * If your application uses separate routes,
     * these routes will work automatically.
     */

    const routes = {
      home: "/home",
      dashboard: "/home?tab=dashboard",
      sms: "/home?tab=sms",
      training: "/home?tab=training",
      stakeholder:
        "/home?tab=stakeholder",
      admin: "/home?tab=admin",
    };

    if (routes[tabId]) {
      navigate(routes[tabId]);
    }
  };

  //logout

  const handleLogout = () => {
    setShowProfileMenu(false);

    localStorage.removeItem(
      "wildguard_user"
    );

    localStorage.removeItem(
      "wildguard_token"
    );

    localStorage.removeItem(
      "wildguard_remember"
    );

    setCurrentUser(null);

    navigate("/login", {
      replace: true,
    });
  };

  // user initialization 

  const userInitial =
    currentUser?.username
      ?.charAt(0)
      ?.toUpperCase() || "U";

  return (
    <header
      id="main_header"
      className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 px-3 py-2.5 backdrop-blur-md sm:px-4 md:px-6"
    >

      <div className="mx-auto flex max-w-350 flex-col gap-3">

        {/* TOP HEADER */}

        <div className="flex items-center justify-between gap-3">

          {/* LOGO */}

          <button
            type="button"
            onClick={() =>
              handleTabChange("home")
            }
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent text-left"
          >

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-1.5 text-emerald-400 shadow-md shadow-emerald-950/20">

              <Shield
                className="h-6 w-6"
                id="logo_icon"
              />

            </div>

            <div>

              <h1 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-slate-100 sm:text-lg">

                WILDGUARD

                <span className="text-emerald-400">
                  AI
                </span>

              </h1>

              <span className="hidden text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500 sm:block">
                Wildlife protection and prevention
              </span>

            </div>

          </button>

          {/* RIGHT SIDE */}

          <div className="flex items-center gap-2">

            {/* SYSTEM STATUS */}

            <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-1.5 lg:flex">

              <span className="relative flex size-2">

                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />

              </span>

              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                System Online
              </span>

            </div>

            {/* MOBILE NOTIFICATION */}

            {currentUser && (
              <button
                type="button"
                onClick={
                  onOpenNotifications
                }
                className="relative grid size-9 cursor-pointer place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 md:hidden"
              >

                <Bell size={16} />

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[8px] font-bold leading-none text-white">
                    {unreadCount}
                  </span>
                )}

              </button>
            )}

            {/* MOBILE PROFILE */}

            {currentUser && (
              <button
                type="button"
                onClick={() =>
                  setShowProfileMenu(
                    (value) => !value
                  )
                }
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-sm font-bold text-emerald-400 md:hidden"
              >
                {userInitial}
              </button>
            )}

          </div>

        </div>

        {/* NAVIGATION */}

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

          {/* NAV */}

          <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-900 p-1 scrollbar-none">

            {tabs.map((tab) => {

              const isActive =
                activeTab ===
                tab.id;

              return (
                <button
                  key={tab.id}
                  id={`tab_btn_${tab.id}`}
                  type="button"
                  onClick={() =>
                    handleTabChange(
                      tab.id
                    )
                  }
                  className={`relative shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-[10px] font-medium transition-all duration-150 sm:text-xs ${
                    isActive
                      ? "font-semibold text-slate-100"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >

                  {tab.label}

                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 -z-10 rounded-md border border-slate-700/50 bg-slate-800"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}

                </button>
              );
            })}

          </nav>

          {/* DESKTOP USER AREA */}

          <div className="hidden items-center gap-3 md:flex">

            {/* UTC */}

            <div className="hidden flex-col items-end text-right font-mono xl:flex">

              <span className="text-[9px] uppercase tracking-wider text-slate-500">
                Surveillance UTC Feed
              </span>

              <span className="text-[10px] font-medium text-slate-300">
                {time ||
                  "0000-00-00 00:00:00 UTC"}
              </span>

            </div>

            {currentUser ? (
              <>

                {/* LOCATION */}

                {currentUser.locationName && (
                  <div className="hidden items-center gap-1.5 border-l border-slate-800 pl-3 lg:flex">

                    <MapPin
                      size={13}
                      className="text-slate-500"
                    />

                    <span className="max-w-42.5 truncate text-[10px] text-slate-400">
                      {
                        currentUser.locationName
                      }
                    </span>

                  </div>
                )}

                {/* NOTIFICATION */}

                <button
                  type="button"
                  onClick={
                    onOpenNotifications
                  }
                  className="relative grid size-9 cursor-pointer place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                  title="System Alerts"
                >

                  <Bell size={15} />

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid size-4 animate-pulse place-items-center rounded-full bg-red-500 text-[8px] font-bold leading-none text-white">
                      {unreadCount}
                    </span>
                  )}

                </button>

                {/* PROFILE */}

                <div className="relative">

                  <button
                    type="button"
                    onClick={() =>
                      setShowProfileMenu(
                        (value) =>
                          !value
                      )
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-left transition-all hover:bg-slate-800"
                  >

                    {/* AVATAR */}

                    <div
                      className={`grid size-7 place-items-center rounded-full border bg-white/5 text-xs font-bold ${getRoleColor()} border-current/20`}
                    >
                      {userInitial}
                    </div>

                    {/* USER */}

                    <div className="hidden max-w-30 sm:block">

                      <p className="truncate text-[11px] font-semibold leading-tight text-slate-200">
                        {
                          currentUser.username
                        }
                      </p>

                      <p
                        className={`truncate text-[8px] uppercase tracking-wider ${getRoleColor()}`}
                      >
                        {getRoleBadge()}
                      </p>

                    </div>

                    <ChevronDown
                      size={13}
                      className={`text-slate-500 transition-transform ${
                        showProfileMenu
                          ? "rotate-180"
                          : ""
                      }`}
                    />

                  </button>

                  {/* PROFILE MENU */}

                  <AnimatePresence>

                    {showProfileMenu && (
                      <>
                        {/* BACKDROP */}

                        <div
                          className="fixed inset-0 z-40"
                          onClick={() =>
                            setShowProfileMenu(
                              false
                            )
                          }
                        />

                        {/* MENU */}

                        <motion.div
                          initial={{
                            opacity: 0,
                            y: 8,
                            scale: 0.96,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                          }}
                          exit={{
                            opacity: 0,
                            y: 8,
                            scale: 0.96,
                          }}
                          transition={{
                            duration: 0.15,
                          }}
                          className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40"
                        >

                          {/* USER DETAILS */}

                          <div className="border-b border-slate-800 p-3">

                            <div className="mb-3 flex items-center gap-2.5">

                              <div
                                className={`grid size-9 place-items-center rounded-full border bg-white/5 font-bold ${getRoleColor()} border-current/20`}
                              >
                                {userInitial}
                              </div>

                              <div className="min-w-0">

                                <p className="truncate text-xs font-bold text-slate-100">
                                  {
                                    currentUser.username
                                  }
                                </p>

                                <p
                                  className={`text-[9px] uppercase tracking-wider ${getRoleColor()}`}
                                >
                                  {
                                    getRoleName()
                                  }
                                </p>

                              </div>

                            </div>

                            <div className="space-y-1.5">

                              <div>

                                <p className="text-[9px] uppercase tracking-wider text-slate-500">
                                  Email
                                </p>

                                <p className="truncate text-[10px] text-slate-300">
                                  {
                                    currentUser.email
                                  }
                                </p>

                              </div>

                              {currentUser.phone && (
                                <div>

                                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                                    Mobile
                                  </p>

                                  <p className="text-[10px] text-slate-300">
                                    {
                                      currentUser.phone
                                    }
                                  </p>

                                </div>
                              )}

                              {currentUser.locationName && (
                                <div>

                                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                                    Assigned Sector
                                  </p>

                                  <p className="truncate text-[10px] text-slate-300">
                                    {
                                      currentUser.locationName
                                    }
                                  </p>

                                </div>
                              )}

                            </div>

                          </div>

                          {/* ROLE */}

                          <div className="p-2">

                            <div className="mb-1 flex items-center gap-2 rounded-lg bg-slate-950/50 px-2.5 py-2">

                              <Radio
                                size={13}
                                className={getRoleColor()}
                              />

                              <div>

                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                  Access Level
                                </p>

                                <p
                                  className={`text-[10px] font-semibold ${getRoleColor()}`}
                                >
                                  {
                                    getRoleName()
                                  }
                                </p>

                              </div>

                            </div>

                            {/* LOGOUT */}

                            <button
                              type="button"
                              onClick={
                                handleLogout
                              }
                              className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                            >

                              <LogOut
                                size={14}
                              />

                              Secure Disconnect

                            </button>

                          </div>

                        </motion.div>
                      </>
                    )}

                  </AnimatePresence>

                </div>

              </>
            ) : (
              //guest user

              <button
                type="button"
                onClick={() =>
                  navigate("/login")
                }
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-emerald-500/10 transition hover:bg-emerald-400"
              >

                <User2 size={14} />

                Ranger Console Access

              </button>
            )}

          </div>

        </div>

        {/* MOBILE USER INFORMATION */}

        {currentUser && (
          <div className="flex items-center justify-between border-t border-slate-900 pt-2 md:hidden">

            <div className="flex min-w-0 items-center gap-2">

              <div
                className={`grid size-7 shrink-0 place-items-center rounded-full border bg-white/5 text-[10px] font-bold ${getRoleColor()} border-current/20`}
              >
                {userInitial}
              </div>

              <div className="min-w-0">

                <p className="truncate text-[10px] font-semibold text-slate-200">
                  {
                    currentUser.username
                  }
                </p>

                <p
                  className={`text-[8px] uppercase tracking-wider ${getRoleColor()}`}
                >
                  {getRoleBadge()}
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2">

              <span className="font-mono text-[8px] text-slate-500">
                {time}
              </span>

              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="grid size-7 cursor-pointer place-items-center rounded-lg border border-slate-800 bg-slate-900 text-red-400 hover:bg-red-500/10"
                title="Logout"
              >
                <LogOut size={13} />
              </button>

            </div>

          </div>
        )}

      </div>
    </header>
  );
};

export default Header;
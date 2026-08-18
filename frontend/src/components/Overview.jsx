import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Eye,
  MapPin,
  Radio,
  Shield,
  ShieldAlert,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import DetectionLogs from "./DetectionLogs";
import { useNavigate } from "react-router-dom";

const Overview = ({ currentUser, detectionLogs =[] }) => {
  const [showAllDetections, setShowAllDetections] = useState(false);

  //user information

  const navigate = useNavigate();
  const username =
    currentUser?.username || "WildGuard User";

  const role =
    currentUser?.role || "operator";

  const location =
    currentUser?.locationName ||
    "National Reserve Network";

  const roleLabel = useMemo(() => {
    switch (role) {
      case "admin":
        return "Administrator";

      case "operator":
        return "Forest Operator";

      case "landowner":
        return "Landowner";

      case "village_head":
        return "Village Head";

      default:
        return "WildGuard User";
    }
  }, [role]);

  //role description

  const roleDescription = useMemo(() => {
    switch (role) {
      case "admin":
        return "Monitor the complete WildGuard protection network, system activity, users, alerts, and AI operations.";

      case "operator":
        return "Monitor wildlife activity, field alerts, AI detections, and emergency response operations.";

      case "landowner":
        return "Monitor threats around your farm or assigned land and receive wildlife safety alerts.";

      case "village_head":
        return "Monitor village-level wildlife threats, community alerts, and emergency SOS operations.";

      default:
        return "Monitor wildlife protection operations in real time.";
    }
  }, [role]);

  //dashboard stats

  const stats = useMemo(() => {
    if (role === "admin") {
      return [
        {
          label: "Active Threats",
          value: "08",
          description: "Across protected zones",
          icon: ShieldAlert,
          iconClass: "text-red-400",
          bgClass: "bg-red-500/10",
        },
        {
          label: "Active Sensors",
          value: "42",
          description: "IoT nodes online",
          icon: Radio,
          iconClass: "text-emerald-400",
          bgClass: "bg-emerald-500/10",
        },
        {
          label: "SMS Alerts",
          value: "126",
          description: "Dispatched today",
          icon: Smartphone,
          iconClass: "text-blue-400",
          bgClass: "bg-blue-500/10",
        },
        {
          label: "Active Users",
          value: "38",
          description: "Connected stakeholders",
          icon: Users,
          iconClass: "text-purple-400",
          bgClass: "bg-purple-500/10",
        },
      ];
    }

    if (role === "operator") {
      return [
        {
          label: "Active Threats",
          value: "05",
          description: "Requires monitoring",
          icon: ShieldAlert,
          iconClass: "text-red-400",
          bgClass: "bg-red-500/10",
        },
        {
          label: "Live Cameras",
          value: "18",
          description: "Currently streaming",
          icon: Eye,
          iconClass: "text-emerald-400",
          bgClass: "bg-emerald-500/10",
        },
        {
          label: "AI Detections",
          value: "24",
          description: "Detected today",
          icon: Zap,
          iconClass: "text-amber-400",
          bgClass: "bg-amber-500/10",
        },
        {
          label: "SMS Alerts",
          value: "64",
          description: "Dispatched today",
          icon: Smartphone,
          iconClass: "text-blue-400",
          bgClass: "bg-blue-500/10",
        },
      ];
    }

    if (role === "landowner") {
      return [
        {
          label: "Nearby Threats",
          value: "02",
          description: "In your assigned zone",
          icon: ShieldAlert,
          iconClass: "text-red-400",
          bgClass: "bg-red-500/10",
        },
        {
          label: "Sensors",
          value: "08",
          description: "Monitoring your area",
          icon: Radio,
          iconClass: "text-emerald-400",
          bgClass: "bg-emerald-500/10",
        },
        {
          label: "SMS Alerts",
          value: "12",
          description: "Received today",
          icon: Smartphone,
          iconClass: "text-blue-400",
          bgClass: "bg-blue-500/10",
        },
        {
          label: "Safety Status",
          value: "SAFE",
          description: "Current zone status",
          icon: CheckCircle2,
          iconClass: "text-emerald-400",
          bgClass: "bg-emerald-500/10",
        },
      ];
    }

    return [
      {
        label: "Village Threats",
        value: "03",
        description: "Active in nearby zones",
        icon: ShieldAlert,
        iconClass: "text-red-400",
        bgClass: "bg-red-500/10",
      },
      {
        label: "Community Sensors",
        value: "14",
        description: "IoT nodes online",
        icon: Radio,
        iconClass: "text-emerald-400",
        bgClass: "bg-emerald-500/10",
      },
      {
        label: "SMS Alerts",
        value: "31",
        description: "Community notifications",
        icon: Smartphone,
        iconClass: "text-blue-400",
        bgClass: "bg-blue-500/10",
      },
      {
        label: "Village Status",
        value: "SAFE",
        description: "Current village status",
        icon: CheckCircle2,
        iconClass: "text-emerald-400",
        bgClass: "bg-emerald-500/10",
      },
    ];
  }, [role]);

  //recent sightings
  const demoSightings = [
  {
    id: "demo-1",
    animal: "Elephant",
    species: "Elephant",
    location: "Sector B3",
    confidence: "96%",
    level: "HIGH",
    time: "2 min ago",
    date: new Date().toLocaleDateString(),
  },
  {
    id: "demo-2",
    animal: "Leopard",
    species: "Leopard",
    location: "Sector A4",
    confidence: "91%",
    level: "MEDIUM",
    time: "8 min ago",
    date: new Date().toLocaleDateString(),
  },
  {
    id: "demo-3",
    animal: "Human intruder",
    species: "Human intruder",
    location: "Reserve Gate 02",
    confidence: "87%",
    level: "CRITICAL",
    time: "14 min ago",
    date: new Date().toLocaleDateString(),
  },
  {
    id: "demo-4",
    animal: "No Threat",
    species: "No Threat",
    location: "Sector C2",
    confidence: "98%",
    level: "LOW",
    time: "21 min ago",
    date: new Date().toLocaleDateString(),
  },
];

const sightings =
  detectionLogs.length > 0
    ? detectionLogs.slice(0, 5)
    : demoSightings;

  const getAlertClass = (level) => {
    switch (level) {
      case "CRITICAL":
        return "border-red-500/20 bg-red-500/10 text-red-400";

      case "HIGH":
        return "border-orange-500/20 bg-orange-500/10 text-orange-400";

      case "MEDIUM":
        return "border-amber-500/20 bg-amber-500/10 text-amber-400";

      default:
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
    }
  };

  const getAnimalClass = (animal) => {
    if (animal === "No Threat") {
      return "text-emerald-400";
    }

    if (animal === "Human intruder") {
      return "text-red-400";
    }

    return "text-slate-100";
  };

  return (
    <div className="space-y-5">

      {/* WELCOME SECTION */}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">

        <div className="relative p-5 sm:p-6 md:p-7">

          {/* Background decoration */}

          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-teal-500/5 blur-3xl" />

          <div className="relative">

            <div className="mb-3 flex flex-wrap items-center gap-2">

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">

                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />

                Operations Online

              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">

                <MapPin size={10} />

                {location}

              </span>

            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">

              Welcome back,{" "}
              <span className="text-emerald-400">
                {username}
              </span>

            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {roleDescription}
            </p>

            <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">

              <Shield size={12} className="text-emerald-400" />

              <span>
                {roleLabel} Access
              </span>

            </div>

          </div>

        </div>

      </section>


      {/* STATISTICS */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        {stats.map((stat) => {

          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="group rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700 hover:bg-slate-900/70"
            >

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-100">
                    {stat.value}
                  </p>

                </div>

                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${stat.bgClass} ${stat.iconClass}`}
                >
                  <Icon size={17} />
                </div>

              </div>

              <p className="mt-2 text-[10px] text-slate-500">
                {stat.description}
              </p>

            </div>
          );
        })}

      </section>


      {/* MAIN GRID */}

      <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">


        {/* RECENT SIGHTINGS */}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">

          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">

            <div className="flex items-center gap-2">

              <div className="grid size-8 place-items-center rounded-lg bg-red-500/10 text-red-400">
                <Activity size={15} />
              </div>

              <div>

                <h3 className="text-xs font-bold text-slate-200">
                  Recent Wildlife Activity
                </h3>

                <p className="text-[9px] text-slate-500">
                  Latest AI and sensor detections
                </p>

              </div>

            </div>

            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
              Live Feed
            </span>

          </div>


          {/* SIGHTINGS */}

          <div className="divide-y divide-slate-900">

            {sightings.map((sighting) => (

              <div
                key={sighting.id}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-900/50"
              >

                {/* STATUS ICON */}

                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                    sighting.level === "CRITICAL"
                      ? "bg-red-500/10 text-red-400"
                      : sighting.level === "HIGH"
                        ? "bg-orange-500/10 text-orange-400"
                        : sighting.level === "MEDIUM"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >

                  {sighting.animal ===
                  "No Threat" ? (
                    <CheckCircle2
                      size={16}
                    />
                  ) : (
                    <AlertTriangle
                      size={16}
                    />
                  )}

                </div>


                {/* DETAILS */}

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-2">

                    <p
                      className={`truncate text-xs font-semibold ${getAnimalClass(
                        sighting.animal
                      )}`}
                    >
                      {sighting.animal}
                    </p>

                    <span
                      className={`rounded border px-1.5 py-0.5 text-[7px] font-bold ${getAlertClass(
                        sighting.level
                      )}`}
                    >
                      {sighting.level}
                    </span>

                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">

                    <span className="flex items-center gap-1">
                      <MapPin size={9} />
                      {sighting.location}
                    </span>

                    <span>
                      AI Confidence{" "}
                      {sighting.confidence}
                    </span>

                  </div>

                </div>


                {/* TIME */}

                <div className="shrink-0 text-right">

                  <p className="text-[9px] text-slate-500">
                    {sighting.time}
                  </p>

                </div>

              </div>

            ))}

          </div>


          {/* FOOTER */}

          <div className="border-t border-slate-800 px-4 py-3">

            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 transition hover:text-emerald-300"
              onClick={()=>navigate("/detections",{
                state: {
                  detections : detectionLogs.length > 0 ? detectionLogs : demoSightings,
                }
              })}
            >
              View all detections
              <ChevronRight size={12} />
            </button>

          </div>

        </div>


        {/* SYSTEM STATUS */}

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">

          <div className="border-b border-slate-800 px-4 py-3">

            <div className="flex items-center gap-2">

              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Radio size={15} />
              </div>

              <div>

                <h3 className="text-xs font-bold text-slate-200">
                  Network Status
                </h3>

                <p className="text-[9px] text-slate-500">
                  Protected zone infrastructure
                </p>

              </div>

            </div>

          </div>


          <div className="space-y-1 p-3">

            <StatusRow
              label="IoT Sensor Network"
              value="Online"
              status="online"
            />

            <StatusRow
              label="AI Detection Engine"
              value="Online"
              status="online"
            />

            <StatusRow
              label="SMS Gateway"
              value="Operational"
              status="online"
            />

            <StatusRow
              label="Camera Surveillance"
              value="18 / 18"
              status="online"
            />

            <StatusRow
              label="Emergency SOS"
              value="Ready"
              status="online"
            />

          </div>


          {/* SAFETY STATUS */}

          <div className="m-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

            <div className="flex items-center gap-3">

              <div className="grid size-9 place-items-center rounded-full bg-emerald-500/10 text-emerald-400">

                <CheckCircle2
                  size={18}
                />

              </div>

              <div>

                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                  Protection Network
                </p>

                <p className="mt-0.5 text-sm font-semibold text-slate-200">
                  All core systems operational
                </p>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* OPERATIONAL INFORMATION */}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

        <InfoCard
          icon={Bell}
          title="Alert Response"
          description="AI detections are automatically evaluated and classified according to threat severity."
        />

        <InfoCard
          icon={Smartphone}
          title="SMS Notification"
          description="Critical wildlife alerts can be dispatched to registered stakeholders through SMS."
        />

        <InfoCard
          icon={Shield}
          title="Wildlife Protection"
          description="WildGuard combines AI classification, IoT sensors, and stakeholder communication."
        />

      </section>

            {/* ALL DETECTION LOGS */}

{showAllDetections && (
  <DetectionLogs
    detectionLogs={detectionLogs}
    onClose={() => setShowAllDetections(false)}
  />
)}

    </div>
  );
};



//status row

const StatusRow = ({
  label,
  value,
  status,
}) => {
  const online =
    status === "online";

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-slate-900">

      <div className="flex min-w-0 items-center gap-2">

        <span
          className={`relative flex size-2 shrink-0`}
        >

          <span
            className={`absolute inline-flex size-full rounded-full ${
              online
                ? "animate-ping bg-emerald-400 opacity-50"
                : "bg-red-400"
            }`}
          />

          <span
            className={`relative inline-flex size-2 rounded-full ${
              online
                ? "bg-emerald-400"
                : "bg-red-400"
            }`}
          />

        </span>

        <span className="truncate text-[10px] text-slate-400">
          {label}
        </span>

      </div>

      <span
        className={`ml-2 shrink-0 text-[9px] font-semibold ${
          online
            ? "text-emerald-400"
            : "text-red-400"
        }`}
      >
        {value}
      </span>

    </div>
  );
};



//info card

const InfoCard = ({
  icon: Icon,
  title,
  description,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-slate-700 hover:bg-slate-900/60">

      <div className="mb-3 grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">

        <Icon size={15} />

      </div>

      <h3 className="text-xs font-bold text-slate-200">
        {title}
      </h3>

      <p className="mt-1.5 text-[10px] leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
};


export default Overview;

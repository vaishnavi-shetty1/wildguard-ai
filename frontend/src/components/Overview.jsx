import React, { useMemo, useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Radio,
  ShieldAlert,
  Smartphone,
  Eye,
} from "lucide-react";
import DetectionLogs from "./DetectionLogs";
import { useNavigate } from "react-router-dom";
import { fetchStats } from "../api";
import { formatDate } from "../utils/datetime";

const SAMPLE_SIGHTINGS = [
  {
    id: "sample-1",
    animal: "Elephant",
    level: "HIGH",
    location: "Sector B3",
    confidence: "96%",
    timestamp: null,
  },
  {
    id: "sample-2",
    animal: "Leopard",
    level: "MEDIUM",
    location: "Sector A4",
    confidence: "91%",
    timestamp: null,
  },
  {
    id: "sample-3",
    animal: "Human intruder",
    level: "CRITICAL",
    location: "Reserve Gate 02",
    confidence: "87%",
    timestamp: null,
  },
  {
    id: "sample-4",
    animal: "No Threat",
    level: "LOW",
    location: "Sector C2",
    confidence: "98%",
    timestamp: null,
  },
];

// Species the model reports that are not wildlife threats.
const NON_THREAT_SPECIES = new Set(["no threat", "none", "unknown", ""]);

const ROLE_COPY = {
  admin: {
    label: "Administrator",
    description:
      "You can see the whole network from here: detections, alerts, people, and the AI models running behind them.",
  },
  operator: {
    label: "Forest operator",
    description:
      "Keep an eye on detections, field alerts, and the live camera feed across your patrol area.",
  },
  landowner: {
    label: "Landowner",
    description:
      "Watch what is moving near your land and read the SMS alerts sent to you.",
  },
  village_head: {
    label: "Village head",
    description:
      "Watch wildlife activity around the village and the alerts sent to residents.",
  },
};

const timeAgo = (value) => {
  if (!value) return "just now";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return formatDate(date);
};

const levelStyles = {
  CRITICAL: "bg-red-500/10 text-red-400",
  HIGH: "bg-orange-500/10 text-orange-400",
  MEDIUM: "bg-amber-500/10 text-amber-300",
  LOW: "bg-emerald-500/10 text-emerald-400",
};

const Overview = ({ currentUser, detectionLogs = [] }) => {
  const navigate = useNavigate();
  const [showAllDetections, setShowAllDetections] = useState(false);
  const [liveStats, setLiveStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchStats()
      .then((stats) => {
        if (!cancelled) setLiveStats(stats);
      })
      .catch(() => {
        if (!cancelled) setLiveStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const username = currentUser?.username || "there";
  const role = currentUser?.role || "operator";
  const location = currentUser?.locationName || "National reserve network";
  const copy = ROLE_COPY[role] || ROLE_COPY.operator;

  const { threatCount, speciesCount, species, lastSeen, clients } = useMemo(() => {
    const bySpecies = liveStats?.by_species || {};

    const threatSpecies = Object.entries(bySpecies).filter(
      ([name]) => !NON_THREAT_SPECIES.has(String(name).toLowerCase())
    );

    const top = [...threatSpecies].sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    return {
      threatCount: liveStats ? threatSpecies.reduce((sum, [, n]) => sum + Number(n), 0) : null,
      speciesCount: liveStats ? threatSpecies.length : null,
      species: top ? top[0] : null,
      lastSeen:
        liveStats?.last_detection?.detected_at ||
        detectionLogs[0]?.timestamp ||
        null,
      clients: liveStats ? Number(liveStats.live_dashboard_clients ?? 0) : null,
    };
  }, [liveStats, detectionLogs]);

  const stats = useMemo(() => {
    const total = liveStats?.total_detections;
    const shared = [
      {
        label: "Threat detections",
        value: threatCount != null ? String(threatCount) : "—",
        hint: "Wildlife and people flagged as threats",
        icon: ShieldAlert,
        tone: "text-red-400",
      },
      {
        label: "All detections",
        value: total != null ? String(total) : "—",
        hint: "Every event recorded by the cameras",
        icon: Radio,
        tone: "text-emerald-400",
      },
      {
        label: "Species seen",
        value: speciesCount != null ? String(speciesCount) : "—",
        hint: species ? `Most often: ${species}` : "Distinct animals identified",
        icon: Eye,
        tone: "text-sky-400",
      },
    ];

    if (role === "admin" || role === "operator") {
      return [
        ...shared,
        {
          label: "Watching live",
          value: clients != null ? String(clients) : "—",
          hint: "Dashboards connected right now",
          icon: Smartphone,
          tone: "text-slate-300",
        },
      ];
    }

    return [
      ...shared.slice(0, 2),
      {
        label: "Last detection",
        value: lastSeen ? timeAgo(lastSeen) : "—",
        hint: detectionLogs[0]?.location || "No detections recorded yet",
        icon: Clock3,
        tone: "text-slate-300",
      },
      shared[2],
    ];
  }, [role, liveStats, threatCount, speciesCount, species, lastSeen, clients, detectionLogs]);

  const sightings = detectionLogs.length > 0 ? detectionLogs.slice(0, 5) : SAMPLE_SIGHTINGS;
  const isSample = detectionLogs.length === 0;

  return (
    <div className="space-y-6">
      {/* GREETING */}
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
          Good {timeOfDay()},{" "}
          <span className="text-emerald-400">{username}</span>
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{copy.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <MapPin size={12} />
            {location}
          </span>
          <span aria-hidden="true">·</span>
          <span>{copy.label}</span>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] text-slate-400">{stat.label}</p>
                <Icon size={15} className={stat.tone} />
              </div>

              <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-100">
                {stat.value}
              </p>

              <p className="mt-1 truncate text-[12px] text-slate-500" title={stat.hint}>
                {stat.hint}
              </p>
            </div>
          );
        })}
      </section>

      {/* RECENT ACTIVITY */}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Activity size={15} className="text-slate-400" />
              Recent activity
            </h2>

            <p className="mt-0.5 text-[13px] text-slate-500">
              {isSample
                ? "Sample rows — real detections will replace these."
                : "The five most recent detections."}
            </p>
          </div>

          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-emerald-400 hover:text-emerald-300"
            onClick={() =>
              navigate("/detections", {
                state: {
                  detections: detectionLogs.length > 0 ? detectionLogs : SAMPLE_SIGHTINGS,
                },
              })
            }
          >
            View all
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="divide-y divide-slate-900">
          {sightings.map((sighting) => {
            const isClear = sighting.animal === "No Threat";
            const level = sighting.level || "LOW";

            return (
              <div
                key={sighting.id}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-900/40"
              >
                <div className="shrink-0">
                  {isClear ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle
                      size={16}
                      className={level === "CRITICAL" ? "text-red-400" : "text-amber-400"}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm text-slate-200">{sighting.animal}</p>

                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${levelStyles[level] || levelStyles.LOW}`}
                    >
                      {level.charAt(0) + level.slice(1).toLowerCase()}
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {sighting.location}
                    {sighting.confidence ? ` · ${sighting.confidence} confidence` : ""}
                  </p>
                </div>

                <p className="shrink-0 text-[12px] text-slate-500">
                  {sighting.timestamp ? timeAgo(sighting.timestamp) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {showAllDetections && (
        <DetectionLogs
          detectionLogs={detectionLogs}
          onClose={() => setShowAllDetections(false)}
        />
      )}
    </div>
  );
};

const timeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
};

export default Overview;

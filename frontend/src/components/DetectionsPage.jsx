import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ShieldAlert,
} from "lucide-react";

const sampleDetections = [
  {
    id: "sample-1",
    animal: "Elephant",
    species: "Elephant",
    confidence: "94%",
    confidenceValue: 0.94,
    level: "HIGH",
    threatLevel: "HIGH",
    location: "Zone A - Forest Boundary",
    cameraName: "Camera 01",
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  },
  {
    id: "sample-2",
    animal: "Wild Boar",
    species: "Wild Boar",
    confidence: "91%",
    confidenceValue: 0.91,
    level: "MEDIUM",
    threatLevel: "MEDIUM",
    location: "Zone B - Agricultural Area",
    cameraName: "Camera 03",
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  },
  {
    id: "sample-3",
    animal: "No Threat",
    species: "No Threat",
    confidence: "98%",
    confidenceValue: 0.98,
    level: "LOW",
    threatLevel: "LOW",
    location: "Zone C - Monitoring Point",
    cameraName: "Camera 05",
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  },
];

const getLevelClass = (level) => {
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

const getIconClass = (level) => {
  switch (level) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-400";

    case "HIGH":
      return "bg-orange-500/10 text-orange-400";

    case "MEDIUM":
      return "bg-amber-500/10 text-amber-400";

    default:
      return "bg-emerald-500/10 text-emerald-400";
  }
};

const DetectionsPAge = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const detections =
    location.state?.detections?.length > 0
      ? location.state.detections
      : sampleDetections;

  return (
    <div className="min-h-screen bg-[#061418] text-slate-100">

      {/* HEADER */}

      <header className="border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-4">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => navigate("/home")}
              className="grid size-9 place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <ArrowLeft size={17} />
            </button>

            <div>
              <h1 className="text-lg font-bold text-slate-100">
                Wildlife Detections
              </h1>

              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Complete AI detection history
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <Activity
              size={14}
              className="text-emerald-400"
            />

            <span className="text-xs font-semibold text-emerald-400">
              {detections.length} Detections
            </span>
          </div>

        </div>
      </header>

      {/* CONTENT */}

      <main className="mx-auto max-w-[1400px] px-4 py-6">

        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-100">
            All Wildlife Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            AI and sensor-based wildlife detections recorded by WildGuard.
          </p>
        </div>

        {/* DETECTIONS */}

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">

          <div className="border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">

              <div className="grid size-9 place-items-center rounded-lg bg-red-500/10 text-red-400">
                <ShieldAlert size={17} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  Detection History
                </h3>

                <p className="text-[10px] text-slate-500">
                  Latest wildlife classification events
                </p>
              </div>

            </div>
          </div>

          <div className="divide-y divide-slate-900">

            {detections.map((detection) => {

              const isSafe =
                detection.animal === "No Threat";

              return (
                <div
                  key={detection.id}
                  className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-900/50 md:flex-row md:items-center"
                >

                  {/* ICON */}

                  <div
                    className={`grid size-11 shrink-0 place-items-center rounded-xl ${getIconClass(
                      detection.level
                    )}`}
                  >
                    {isSafe ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>

                  {/* MAIN INFO */}

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-sm font-bold text-slate-100">
                        {detection.animal}
                      </h3>

                      <span
                        className={`rounded border px-2 py-0.5 text-[8px] font-bold uppercase ${getLevelClass(
                          detection.level
                        )}`}
                      >
                        {detection.level}
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-500">

                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {detection.location}
                      </span>

                      <span>
                        Camera:{" "}
                        {detection.cameraName}
                      </span>

                    </div>

                  </div>

                  {/* CONFIDENCE */}

                  <div className="min-w-[100px]">

                    <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-600">
                      AI Confidence
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-200">
                      {detection.confidence}
                    </p>

                  </div>

                  {/* TIME */}

                  <div className="min-w-[130px] text-left md:text-right">

                    <p className="text-[9px] text-slate-400">
                      {detection.date}
                    </p>

                    <p className="mt-1 text-[9px] text-slate-600">
                      {detection.time}
                    </p>

                  </div>

                </div>
              );
            })}

          </div>

        </div>

        {/* BACK BUTTON */}

        <div className="mt-5">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-400"
          >
            ← Back to Overview
          </button>
        </div>

      </main>
    </div>
  );
};

export default DetectionsPAge;
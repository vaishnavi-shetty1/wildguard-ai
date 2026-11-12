import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { fetchDetections, mapBackendDetection } from "../api";
import { formatDate } from "../utils/datetime";

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
    date: formatDate(new Date()),
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
    date: formatDate(new Date()),
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
    date: formatDate(new Date()),
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

const capitalize = (value = "") => value.charAt(0) + value.slice(1).toLowerCase();

const DetectionsPAge = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [backendDetections, setBackendDetections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDetections({ limit: 200 })
      .then((records) => {
        if (cancelled) return;
        setBackendDetections((records || []).map(mapBackendDetection));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const drafts =
    location.state?.detections?.length > 0
      ? location.state.detections
      : [];

  const isSample =
    backendDetections.length === 0 && drafts.length === 0 && !isLoading;

  const detections =
    backendDetections.length > 0
      ? [...backendDetections, ...drafts]
      : drafts.length > 0
        ? drafts
        : isLoading
          ? []
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
              <h1 className="text-lg font-semibold text-slate-100">
                Detections
              </h1>

              <p className="text-[13px] text-slate-500">
                Everything the cameras have flagged so far.
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <Activity
              size={14}
              className="text-emerald-400"
            />

            <span className="text-xs font-medium tabular-nums text-emerald-400">
              {detections.length} recorded
            </span>
          </div>

        </div>

        {loadError && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-[14px] text-amber-300">
            Backend unavailable — showing the last known data. ({loadError})
          </div>
        )}

        {isSample && (
          <div className="border-t border-slate-800 bg-slate-900/40 px-4 py-2 text-center text-[13px] text-slate-400">
            No detections recorded yet, so these are sample rows.
          </div>
        )}
      </header>

      {/* CONTENT */}

      <main className="mx-auto max-w-[1400px] px-4 py-6">

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-100">
            Activity
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Newest first.
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
                <h3 className="text-sm font-semibold text-slate-200">
                  Detection history
                </h3>

                <p className="text-[13px] text-slate-500">
                  What each camera saw and how sure the model was
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

                      <h3 className="text-sm font-semibold text-slate-100">
                        {detection.animal}
                      </h3>

                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${getLevelClass(
                          detection.level
                        )}`}
                      >
                        {capitalize(detection.level)}
                      </span>

                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-500">

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

                    <p className="text-[11px] text-slate-500">
                      Confidence
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {detection.confidence}
                    </p>

                  </div>

                  {/* TIME */}

                  <div className="min-w-[130px] text-left md:text-right">

                    <p className="text-[12px] text-slate-400">
                      {detection.date}
                    </p>

                    <p className="mt-1 text-[12px] text-slate-600">
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
← Back to overview
          </button>
        </div>

      </main>
    </div>
  );
};

export default DetectionsPAge;
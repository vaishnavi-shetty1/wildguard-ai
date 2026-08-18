import React, { useState } from "react";
import {
  AlertTriangle,
  Camera,
  MapPin,
  Radio,
  ShieldCheck,
} from "lucide-react";

import CameraFeed from "./CameraFeed";

const ThreatRadar = ({ currentUser }) => {
  const [latestDetection, setLatestDetection] = useState({
    label: "No Threat",
    confidence: 0,
    alertLevel: "LOW",
    location:
      currentUser?.locationName ||
      "Registered Community Zone",
  });

  const handleDetection = (detection) => {
    setLatestDetection(detection);
  };

  const isThreat =
    latestDetection.label !== "No Threat";

  const alertClass = {
    LOW: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    MEDIUM: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
    HIGH: "border-orange-500/20 bg-orange-500/10 text-orange-400",
    CRITICAL: "border-red-500/20 bg-red-500/10 text-red-400",
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-3">

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <Radio className="h-6 w-6 text-emerald-400" />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                Community Safety
              </p>

              <h1 className="mt-1 text-2xl font-bold text-white">
                Threat Radar
              </h1>

              <p className="mt-1 text-xs text-slate-500">
                Real-time wildlife monitoring for your registered zone.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">

            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Surveillance Active
            </span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">

        <MapPin className="h-4 w-4 text-emerald-400" />

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
            Registered Location
          </p>

          <p className="text-xs font-semibold text-slate-300">
            {currentUser?.locationName ||
              "Registered Community Zone"}
          </p>
        </div>
      </div>

      {/* Camera */}
      <CameraFeed
        title="Community Surveillance Camera"
        location={
          currentUser?.locationName ||
          "Registered Community Zone"
        }
        onDetection={handleDetection}
      />

      {/* Threat cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />

            <p className="text-xs font-semibold text-slate-400">
              Current Status
            </p>
          </div>

          <p
            className={`mt-4 text-xl font-bold ${
              isThreat
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {latestDetection.label}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />

            <p className="text-xs font-semibold text-slate-400">
              Alert Level
            </p>
          </div>

          <span
            className={`mt-4 inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${
              alertClass[
                latestDetection.alertLevel
              ] || alertClass.LOW
            }`}
          >
            {latestDetection.alertLevel}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">

          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-400" />

            <p className="text-xs font-semibold text-slate-400">
              AI Confidence
            </p>
          </div>

          <p className="mt-4 text-xl font-bold text-slate-100">
            {latestDetection.confidence
              ? `${(
                  latestDetection.confidence * 100
                ).toFixed(1)}%`
              : "--"}
          </p>
        </div>
      </div>

      {/* Threat warning */}
      {isThreat ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">

          <div className="flex items-start gap-3">

            <div className="rounded-lg bg-red-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-red-300">
                Wildlife Threat Detected
              </h3>

              <p className="mt-1 text-xs leading-5 text-red-300/70">
                A potential{" "}
                <strong>
                  {latestDetection.label}
                </strong>{" "}
                has been detected in your registered area.
                Move to a safe location and follow local
                wildlife safety instructions.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">

          <div className="rounded-lg bg-emerald-500/10 p-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-emerald-300">
              Area Currently Safe
            </h3>

            <p className="mt-1 text-xs text-emerald-300/60">
              No wildlife threat has been detected by the
              active surveillance camera.
            </p>
          </div>
        </div>
      )}

      {/* Safety information */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">

        <div className="flex items-center gap-3">

          <div className="rounded-lg bg-slate-900 p-2">
            <Radio className="h-4 w-4 text-slate-400" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-200">
              Community Surveillance
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-600">
              Keep the surveillance camera active when
              monitoring wildlife movement near your
              registered area.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatRadar;
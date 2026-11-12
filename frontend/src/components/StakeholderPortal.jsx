import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Phone,
  Radio,
  Shield,
  Siren,
  Users,
} from "lucide-react";
import { fetchDetections, fetchUsers, mapBackendDetection, mapBackendUser, sendSos } from "../api";
import { formatDate } from "../utils/datetime";

const StakeholderPortal = ({ currentUser, onNotification }) => {
  const [sosSent, setSosSent] = useState(false);
  const [selectedSector, setSelectedSector] = useState(
    currentUser?.locationName || "Your Assigned Sector"
  );
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const isVillageHead = currentUser?.role === "village_head";

  const [detections, setDetections] = useState([]);
  const [people, setPeople] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetchDetections({ limit: 50 })
      .then((records) => {
        if (!cancelled) setDetections((records || []).map(mapBackendDetection));
      })
      .catch(() => {});

    fetchUsers()
      .then((records) => {
        if (!cancelled) setPeople((records || []).map(mapBackendUser));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const portalTitle = isVillageHead
    ? "Village portal"
    : "Farm portal";

  const portalDescription = isVillageHead
    ? "See what has been moving around the village, and call for help if you need it."
    : "See what has been moving around your land, and call for help if you need it.";

  const locationName =
    currentUser?.locationName ||
    (isVillageHead ? "Silverwood Hamlet" : "Green Valley Orchards");

  const stats = useMemo(() => {
    const threatLevels = detections.map((d) => d.level);
    const currentLevel = threatLevels.includes("HIGH")
      ? "HIGH"
      : threatLevels.includes("MEDIUM")
        ? "MEDIUM"
        : "LOW";

    const team = people.filter(
      (person) => person.role === "operator" || person.role === "admin"
    );

    const nearby = people.filter(
      (person) => person.locationName && person.locationName === locationName
    );

    return [
      {
        label: "Threat level",
        value: currentLevel,
        icon: Shield,
      },
      {
        label: "Recent alerts",
        value: String(detections.length),
        icon: Bell,
      },
      {
        label: "Responders",
        value: String(team.length),
        icon: Radio,
      },
      {
        label: "People nearby",
        value: String(nearby.length),
        icon: Users,
      },
    ];
  }, [detections, people, locationName]);

  const recentAlerts = detections.slice(0, 4).map((detection) => ({
    id: detection.id,
    species: detection.animal,
    location: detection.location,
    time: timeAgo(detection.timestamp),
    level: detection.level || "LOW",
    message:
      detection.animal === "No Threat"
        ? "Camera scan finished. Nothing of concern in the frame."
        : `${detection.animal} picked up by the camera at ${detection.location}.`,
    status: detection.level === "HIGH" ? "Active" : "Resolved",
  }));

  const sendSOS = async () => {
    setSosSent(true);

    try {
      const emergencyMessage = `WILDGUARD EMERGENCY SOS: Immediate assistance required from ${locationName}. Reported by ${currentUser?.username || "Stakeholder"}.`;
      await sendSos({
        message: emergencyMessage,
        location: locationName,
      });
      if (onNotification) {
        onNotification({
          title: "Emergency SOS Sent",
          message: "Emergency broadcast dispatched to all stakeholders.",
          type: "threat",
        }, false);
      }
    } catch (error) {
      console.error("Failed to send SOS:", error);
    }

    setTimeout(() => {
      setSosSent(false);
    }, 5000);
  };

  const sendMessage = (event) => {
    event.preventDefault();

    if (!message.trim()) return;

    setMessageSent(true);
    setMessage("");

    setTimeout(() => {
      setMessageSent(false);
    }, 4000);
  };

  const getLevelStyle = (level) => {
    switch (level) {
      case "CRITICAL":
        return "border-red-500/30 bg-red-500/10 text-red-400";

      case "HIGH":
        return "border-orange-500/30 bg-orange-500/10 text-orange-400";

      case "MEDIUM":
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

      default:
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    }
  };

  return (
    <div className="min-h-screen bg-[#071417] px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {portalTitle}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            {portalDescription}
          </p>

          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {locationName}
          </p>
        </div>

        {/* SOS Emergency Section */}
        <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-linear-to-r from-red-950/30 via-slate-950/80 to-slate-950/80">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                <Siren className="h-7 w-7" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white">
                  Emergency SOS
                </h2>

                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                  Only use this if someone is in danger right now. It alerts the response team and everyone registered to this area.
                </p>
              </div>
            </div>

            <button
              onClick={sendSOS}
              disabled={sosSent}
              className={`flex min-w-47.5 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all ${
                sosSent
                  ? "cursor-not-allowed bg-emerald-500 text-slate-950"
                  : "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 hover:shadow-red-500/30"
              }`}
            >
              {sosSent ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  SOS sent
                </>
              ) : (
                <>
                  <Siren className="h-5 w-5" />
                  Send SOS
                </>
              )}
            </button>

          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-slate-400">
                    {stat.label}
                  </p>

                  <Icon className="h-4 w-4 text-slate-500" />
                </div>

                <p className="mt-3 text-xl font-semibold capitalize tabular-nums text-slate-100">
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_.6fr]">

          {/* Alerts */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70">

            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">
                  Recent alerts
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  The last few detections from the cameras
                </p>
              </div>

              {detections.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Live
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-800">
              {recentAlerts.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No detections yet. Alerts appear here once the cameras spot something.
                </p>
              )}

              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-5 transition-colors hover:bg-slate-900/40"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                    <div className="flex gap-3">
                      <div className="mt-1 rounded-lg border border-slate-800 bg-slate-900 p-2">
                        <AlertTriangle
                          className={`h-5 w-5 ${
                            alert.level === "HIGH"
                              ? "text-orange-400"
                              : alert.level === "MEDIUM"
                              ? "text-yellow-400"
                              : "text-emerald-400"
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-100">
                            {alert.species}
                          </h3>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[12px] font-medium ${getLevelStyle(
                              alert.level
                            )}`}
                          >
                            {capitalize(alert.level)}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {alert.location}
                          </span>

                          <span>{alert.time}</span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {alert.message}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                        alert.status === "Active"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {alert.status}
                    </span>

                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right Panel */}
          <div className="space-y-6">

            {/* Location */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Monitoring area</h2>
              </div>

              <label className="mb-2 block text-[13px] text-slate-400">
                Watching
              </label>

              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50"
              >
                <option value={locationName}>{locationName}</option>
                <option value="Sector A4 - Silverwood Hamlet">
                  Sector A4 - Silverwood Hamlet
                </option>
                <option value="Sector B3 - Green Valley Orchards">
                  Sector B3 - Green Valley Orchards
                </option>
                <option value="Sector C2 - Eastern Forest Boundary">
                  Sector C2 - Eastern Forest Boundary
                </option>
              </select>

              <div className="mt-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">
                    Alerts are on
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Wildlife detection alerts for this location will be sent to
                  your registered account.
                </p>
              </div>
            </section>

            {/* Contact Response Team */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Response team</h2>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Wildlife Response Unit
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Available 24/7
                    </p>
                  </div>

                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Online
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call the response team
                </button>
              </div>
            </section>

          </div>
        </div>

        {/* Message Section */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                Message WildGuard
              </h2>

              <p className="text-xs text-slate-500">
                Tell the operations team about a sighting or a concern
              </p>
            </div>
          </div>

          <form onSubmit={sendMessage}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="What did you see, and where?"
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {messageSent ? (
                <span className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Message sent.
                </span>
              ) : (
                <span className="text-xs text-slate-600">
                  Messages are logged for operational review.
                </span>
              )}

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <MessageSquare className="h-4 w-4" />
                Send message
              </button>
            </div>
          </form>
        </section>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-900 pt-4 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>WildGuard · community safety</span>

          <span>
            {currentUser?.username || "Guest"} •{" "}
            {currentUser?.role?.replace("_", " ") || "stakeholder"}
          </span>
        </div>

      </div>
    </div>
  );
};

const capitalize = (value = "") => value.charAt(0) + value.slice(1).toLowerCase();

const timeAgo = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  return formatDate(date);
};

export default StakeholderPortal;
import React, { useMemo, useState } from "react";
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
import { sendSos } from "../api";

const StakeholderPortal = ({ currentUser, onNotification }) => {
  const [sosSent, setSosSent] = useState(false);
  const [selectedSector, setSelectedSector] = useState(
    currentUser?.locationName || "Your Assigned Sector"
  );
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const isVillageHead = currentUser?.role === "village_head";

  const portalTitle = isVillageHead
    ? "Village Portal & SOS"
    : "Farm Portal & SOS";

  const portalDescription = isVillageHead
    ? "Monitor village-level wildlife threats, receive alerts, and coordinate emergency response."
    : "Monitor your farm or land area, receive wildlife alerts, and request immediate assistance.";

  const locationName =
    currentUser?.locationName ||
    (isVillageHead ? "Silverwood Hamlet" : "Green Valley Orchards");

  const stats = useMemo(
    () => [
      {
        label: "Current Threat Level",
        value: "LOW",
        icon: Shield,
        type: "success",
      },
      {
        label: "Active Alerts",
        value: "2",
        icon: Bell,
        type: "warning",
      },
      {
        label: "Response Team",
        value: "ONLINE",
        icon: Radio,
        type: "success",
      },
      {
        label: "Nearby Users",
        value: isVillageHead ? "18" : "6",
        icon: Users,
        type: "info",
      },
    ],
    [isVillageHead]
  );

  const recentAlerts = [
    {
      id: 1,
      species: "Elephant",
      location: locationName,
      time: "10 minutes ago",
      level: "HIGH",
      message:
        "Possible elephant movement detected near the monitored boundary.",
      status: "Active",
    },
    {
      id: 2,
      species: "No Threat",
      location: locationName,
      time: "42 minutes ago",
      level: "LOW",
      message: "Camera scan completed. No immediate threat detected.",
      status: "Resolved",
    },
    {
      id: 3,
      species: "Human intruder",
      location: locationName,
      time: "1 hour ago",
      level: "MEDIUM",
      message: "Unidentified movement detected near the perimeter.",
      status: "Resolved",
    },
  ];

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
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
                  <Shield className="h-5 w-5" />
                </div>

                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Stakeholder Console
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                {portalTitle}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {portalDescription}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
              <MapPin className="h-5 w-5 text-emerald-400" />

              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Assigned Location
                </p>

                <p className="text-sm font-semibold text-slate-200">
                  {locationName}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* SOS Emergency Section */}
        <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-linear-to-r from-red-950/30 via-slate-950/80 to-slate-950/80">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                <Siren className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-400">
                  Emergency Response
                </p>

                <h2 className="mt-1 text-xl font-bold text-white">
                  Wildlife Emergency SOS
                </h2>

                <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
                  Use SOS only when an immediate wildlife or human safety
                  threat is present. Nearby response teams and configured
                  stakeholders will be notified.
                </p>
              </div>
            </div>

            <button
              onClick={sendSOS}
              disabled={sosSent}
              className={`flex min-w-47.5 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all ${
                sosSent
                  ? "cursor-not-allowed bg-emerald-500 text-slate-950"
                  : "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 hover:shadow-red-500/30"
              }`}
            >
              {sosSent ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  SOS Dispatched
                </>
              ) : (
                <>
                  <Siren className="h-5 w-5" />
                  SEND SOS
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
                  <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                      stat.type === "warning"
                        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                        : stat.type === "info"
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    LIVE
                  </span>
                </div>

                <p className="mt-4 text-xs uppercase tracking-wider text-slate-500">
                  {stat.label}
                </p>

                <p className="mt-1 text-xl font-bold text-slate-100">
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
                <h2 className="font-bold text-white">
                  Recent Wildlife Alerts
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Activity detected in your monitored area
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Live feed
              </div>
            </div>

            <div className="divide-y divide-slate-800">
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
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${getLevelStyle(
                              alert.level
                            )}`}
                          >
                            {alert.level}
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
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
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
                <h2 className="font-bold text-white">Monitoring Area</h2>
              </div>

              <label className="mb-2 block text-xs font-medium text-slate-500">
                SELECT LOCATION
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
                  <span className="text-sm font-semibold text-emerald-300">
                    Monitoring Active
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
                <h2 className="font-bold text-white">Response Team</h2>
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
                  Contact Response Team
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
              <h2 className="font-bold text-white">
                Contact WildGuard Operations
              </h2>

              <p className="text-xs text-slate-500">
                Send a message to the operations team
              </p>
            </div>
          </div>

          <form onSubmit={sendMessage}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Describe a wildlife sighting, safety concern, or request..."
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-500/50"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {messageSent ? (
                <span className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Message sent successfully.
                </span>
              ) : (
                <span className="text-xs text-slate-600">
                  Messages are logged for operational review.
                </span>
              )}

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                <MessageSquare className="h-4 w-4" />
                Send Message
              </button>
            </div>
          </form>
        </section>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-900 pt-4 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>WILDGUARD AI • Stakeholder Safety Network</span>

          <span>
            {currentUser?.username || "Guest"} •{" "}
            {currentUser?.role?.replace("_", " ") || "stakeholder"}
          </span>
        </div>

      </div>
    </div>
  );
};

export default StakeholderPortal;
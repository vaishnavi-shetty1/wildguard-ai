import React, { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  X,
  Bell,
} from "lucide-react";

const NotificationToast = ({
  notification,
  onClose,
  duration = 6000,
}) => {
  useEffect(() => {
    if (!notification) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [notification, duration, onClose]);

  if (!notification) {
    return null;
  }

  const getIcon = () => {
    if (notification.type === "danger") {
      return (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400 ring-1 ring-red-500/20">
          <AlertTriangle size={21} />
        </div>
      );
    }

    if (notification.type === "ai") {
      return (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
          <ShieldAlert size={21} />
        </div>
      );
    }

    if (notification.type === "success") {
      return (
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
          <CheckCircle2 size={21} />
        </div>
      );
    }

    return (
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20">
        <Bell size={21} />
      </div>
    );
  };

  const getBorder = () => {
    if (notification.type === "danger") {
      return "border-red-500/30";
    }

    if (notification.type === "ai") {
      return "border-emerald-500/30";
    }

    return "border-slate-700";
  };

  return (
    <div
      className={`fixed right-4 top-24 z-9999 w-[calc(100%-2rem)] max-w-[390px] overflow-hidden rounded-2xl border ${getBorder()} bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur-xl`}
      role="alert"
    >
      {/* TOP ACCENT */}
      <div
        className={`h-0.5 w-full ${
          notification.type === "danger"
            ? "bg-red-500"
            : notification.type === "ai"
            ? "bg-emerald-400"
            : "bg-blue-400"
        }`}
      />

      <div className="flex gap-3 p-4">
        {getIcon()}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {notification.type === "ai"
                  ? "AI Wildlife Detection"
                  : "WildGuard Alert"}
              </p>

              <h3 className="mt-1 text-sm font-bold text-slate-100">
                {notification.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            >
              <X size={15} />
            </button>
          </div>

          <p className="mt-1.5 text-xs leading-5 text-slate-400">
            {notification.message}
          </p>

          {notification.confidence && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">
                Confidence
              </span>

              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{
                    width: `${notification.confidence}%`,
                  }}
                />
              </div>

              <span className="text-[10px] font-bold text-emerald-400">
                {notification.confidence}%
              </span>
            </div>
          )}

          {notification.location && (
            <p className="mt-2 text-[10px] text-slate-500">
              Location:{" "}
              <span className="text-slate-400">
                {notification.location}
              </span>
            </p>
          )}

          <div className="mt-2 text-[9px] font-mono text-slate-600">
            {notification.time || "NOW"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
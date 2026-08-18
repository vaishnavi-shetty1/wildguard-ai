import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Radio,
  X,
  Trash2,
} from "lucide-react";

const NotificationDrawer = ({
  notifications = [],
  onClose,
  onMarkRead,
  onClearAll,
}) => {

  const getIcon = (type) => {
    switch (type) {
      case "threat":
        return (
          <AlertTriangle
            size={15}
            className="text-red-400"
          />
        );

      case "sms":
        return (
          <ShieldAlert
            size={15}
            className="text-emerald-400"
          />
        );

      case "ai":
        return (
          <CheckCircle2
            size={15}
            className="text-blue-400"
          />
        );

      case "camera":
        return (
          <Radio
            size={15}
            className="text-amber-400"
          />
        );

      default:
        return (
          <ShieldAlert
            size={15}
            className="text-emerald-400"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[110]">

      {/* BACKDROP */}

      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* DRAWER */}

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">

          <div>

            <h2 className="text-sm font-bold text-slate-100">
              System Notifications
            </h2>

            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
              WildGuard Operations Feed
            </p>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-100"
          >
            <X size={17} />
          </button>

        </div>

        {/* ACTION BAR */}

        {notifications.length > 0 && (
          <div className="flex items-center justify-between border-b border-slate-900 px-5 py-2.5">

            <span className="text-[10px] text-slate-500">
              {notifications.length} notification
              {notifications.length !== 1
                ? "s"
                : ""}
            </span>

            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={12} />
              Clear all
            </button>

          </div>
        )}

        {/* NOTIFICATION LIST */}

        <div className="flex-1 overflow-y-auto">

          {notifications.length === 0 ? (

            <div className="flex h-full flex-col items-center justify-center px-6 text-center">

              <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                <CheckCircle2
                  size={25}
                  className="text-emerald-400"
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-200">
                All clear
              </h3>

              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                There are currently no system notifications.
              </p>

            </div>

          ) : (

            <div>

              {notifications.map(
                (notification) => (

                  <button
                    key={notification.id}
                    type="button"
                    onClick={() =>
                      onMarkRead?.(
                        notification.id
                      )
                    }
                    className={`flex w-full gap-3 border-b border-slate-900 px-5 py-4 text-left transition hover:bg-slate-900/70 ${
                      !notification.read
                        ? "bg-slate-900/30"
                        : ""
                    }`}
                  >

                    {/* ICON */}

                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-900">
                      {getIcon(
                        notification.type
                      )}
                    </div>

                    {/* CONTENT */}

                    <div className="min-w-0 flex-1">

                      <div className="flex items-start justify-between gap-3">

                        <p className="text-xs font-semibold text-slate-200">
                          {notification.title}
                        </p>

                        {!notification.read && (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
                        )}

                      </div>

                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {notification.message}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">

                        {notification.location && (
                          <span className="rounded-md bg-slate-900 px-1.5 py-1 text-[9px] text-slate-500">
                            {notification.location}
                          </span>
                        )}

                        {notification.alertLevel && (
                          <span className="rounded-md bg-red-500/10 px-1.5 py-1 text-[9px] font-semibold text-red-400">
                            {notification.alertLevel}
                          </span>
                        )}

                      </div>

                      {notification.timestamp && (
                        <p className="mt-2 font-mono text-[9px] text-slate-600">
                          {notification.timestamp}
                        </p>
                      )}

                    </div>

                  </button>

                )
              )}

            </div>

          )}

        </div>

      </aside>
    </div>
  );
};

export default NotificationDrawer;
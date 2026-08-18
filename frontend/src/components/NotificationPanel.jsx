import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";

const NotificationPanel = ({
  notifications,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-100">

      {/* BACKDROP */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>

      {/* PANEL */}
      <div className="absolute right-3 top-20 w-[calc(100%-24px)] max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl sm:right-6 sm:w-96">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">System Notifications</h3>
            <p className="text-[10px] text-slate-500">WildGuard Operations Feed </p>
          </div>

          <button type="button" onClick={onClose} className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* NOTIFICATIONS */}
        <div className="max-h-[60vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={28}/>
              <p className="text-sm text-slate-400">No new notifications</p>
            </div>
          ) : (
            notifications.map(
              (notification) => (
                <div key={notification.id} className="flex gap-3 border-b border-slate-900 px-4 py-3 transition hover:bg-slate-900/70">
                  {/* ICON */}
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    {notification.type === "sms" ? (
                      <ShieldAlert size={15}/>
                    ) : notification.type === "ai" ? (
                      <CheckCircle2 size={15}/>
                    ) : (
                      <AlertTriangle size={15}/>
                    )}
                  </div>

                  {/* CONTENT */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200">
                        {notification.title}
                      </p>

                      {!notification.read && (
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-red-400" />
                      )}
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {notification.message}
                    </p>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
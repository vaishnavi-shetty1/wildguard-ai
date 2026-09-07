import React, { useEffect, useMemo, useState } from "react";
import {
  fetchUsers,
  mapBackendUser,
  getSmsConfig,
  updateSmsConfig,
  sendSms,
  fetchSmsLogs,
  mapSmsLog,
  sendSos,
} from "../api";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  MessageSquare,
  Phone,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  Smartphone,
  Users,
  X,
  Zap,
} from "lucide-react";

/* =========================================================
   SAMPLE USERS
   Replace with your localStorage / backend users later.
   ========================================================= */

const INITIAL_RECIPIENTS = [
  {
    id: "USR-001",
    name: "Forest Control Room",
    phone: "+91 9876543210",
    role: "operator",
    location: "National Reserve Control",
    enabled: true,
  },
  {
    id: "USR-002",
    name: "Ravi Kumar",
    phone: "+91 9876543211",
    role: "landowner",
    location: "Sector B3 - Green Valley Orchards",
    enabled: true,
  },
  {
    id: "USR-003",
    name: "Meena Devi",
    phone: "+91 9876543212",
    role: "landowner",
    location: "Sector A4 - Silverwood Hamlet",
    enabled: true,
  },
  {
    id: "USR-004",
    name: "Village Head - Silverwood",
    phone: "+91 9876543213",
    role: "village_head",
    location: "Sector A4 - Silverwood Hamlet",
    enabled: true,
  },
  {
    id: "USR-005",
    name: "Wildlife Officer",
    phone: "+91 9876543214",
    role: "operator",
    location: "National Reserve",
    enabled: true,
  },
  {
    id: "USR-006",
    name: "Admin Control",
    phone: "+91 9876543215",
    role: "admin",
    location: "Central Administration",
    enabled: true,
  },
];


/* =========================================================
   SAMPLE SMS LOGS
   ========================================================= */

const INITIAL_LOGS = [
  {
    id: "SMS-001",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    recipientPhone: "+91 9876543211",
    recipientName: "Ravi Kumar",
    recipientRole: "landowner",
    message:
      "WILDGUARD ALERT: Elephant detected near Sector B3. Please remain indoors and avoid the forest boundary.",
    status: "delivered",
    sightingId: "WG-001",
    sector: "Sector B3",
    triggerType: "auto_detection",
  },
  {
    id: "SMS-002",
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    recipientPhone: "+91 9876543213",
    recipientName: "Village Head - Silverwood",
    recipientRole: "village_head",
    message:
      "WILDGUARD ALERT: Leopard movement detected near Sector A4. Exercise caution and inform residents.",
    status: "delivered",
    sightingId: "WG-002",
    sector: "Sector A4",
    triggerType: "auto_detection",
  },
  {
    id: "SMS-003",
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
    recipientPhone: "+91 9876543214",
    recipientName: "Wildlife Officer",
    recipientRole: "operator",
    message:
      "WILDGUARD CRITICAL: Human intruder detected at Reserve Gate 02.",
    status: "sent",
    sightingId: "WG-003",
    sector: "Reserve Gate 02",
    triggerType: "auto_detection",
  },
  {
    id: "SMS-004",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    recipientPhone: "+91 9876543212",
    recipientName: "Meena Devi",
    recipientRole: "landowner",
    message:
      "WILDGUARD TEST: This is a test notification from the Wildlife Protection Dashboard.",
    status: "simulated",
    sector: "Sector A4",
    triggerType: "test",
  },
];


/* =========================================================
   COMPONENT
   ========================================================= */

const SmsCenter = ({ currentUser, onNotification }) => {
  const [recipients, setRecipients] = useState(
    INITIAL_RECIPIENTS
  );

  const [logs, setLogs] = useState(
    INITIAL_LOGS
  );

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((data) => {
        if (cancelled) return;
        const mapped = (data || []).map((u) => {
          const user = mapBackendUser(u);
          return {
            id: user.id,
            uid: user.id,
            name: user.username,
            phone: user.phone || "+91 0000000000",
            role: user.role,
            location: user.locationName || "Unknown Sector",
            enabled: user.smsAlertsEnabled && user.isActive,
          };
        });
        if (mapped.length > 0) {
          setRecipients(mapped);
        }
      })
      .catch((error) => {
        console.warn("Could not load recipients from backend, using sample data:", error);
      });
    return () => { cancelled = true; };
  }, []);

  //load SMS config from backend
  useEffect(() => {
    let cancelled = false;
    getSmsConfig()
      .then((config) => {
        if (cancelled) return;
        setSmsConfig((current) => ({
          ...current,
          autoAlertEnabled: config.auto_alert_enabled,
          alertLevels: config.alert_levels || current.alertLevels,
          selectedSpecies: (config.selected_species || []).map((s) => capitalize(s)),
          defaultSenderName: config.default_sender_name,
          twilioConfigured: config.twilio_configured,
        }));
      })
      .catch((error) => {
        console.warn("Could not load SMS config, using defaults:", error);
      });
    return () => { cancelled = true; };
  }, []);

  //load SMS logs from backend
  useEffect(() => {
    let cancelled = false;
    fetchSmsLogs({ limit: 100 })
      .then((records) => {
        if (cancelled) return;
        const mapped = (records || []).map(mapSmsLog);
        if (mapped.length > 0) {
          setLogs(mapped);
        }
      })
      .catch((error) => {
        console.warn("Could not load SMS logs from backend, using sample:", error);
      });
    return () => { cancelled = true; };
  }, []);

  const saveSmsConfig = async () => {
    try {
      await updateSmsConfig({
        auto_alert_enabled: smsConfig.autoAlertEnabled,
        alert_levels: smsConfig.alertLevels,
        selected_species: smsConfig.selectedSpecies.map((s) => s.toLowerCase()),
        default_sender_name: smsConfig.defaultSenderName,
        twilio_configured: smsConfig.twilioConfigured,
      });
      if (onNotification) onNotification({ title: "SMS Settings Saved", message: "SMS configuration updated on the backend.", type: "sms" }, false);
    } catch (error) {
      console.error("Failed to save SMS config:", error);
    }
  };

  const [activeSection, setActiveSection] =
    useState("compose");

  const [message, setMessage] = useState("");

  const [selectedRecipients, setSelectedRecipients] =
    useState([]);

  const [recipientRole, setRecipientRole] =
    useState("all");

  const [triggerType, setTriggerType] =
    useState("manual_broadcast");

  const [search, setSearch] =
    useState("");

  const [logFilter, setLogFilter] =
    useState("all");

  const [showSettings, setShowSettings] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [smsConfig, setSmsConfig] =
    useState({
      autoAlertEnabled: true,
      alertLevels: [
        "HIGH",
        "CRITICAL",
      ],
      selectedSpecies: [
        "Elephant",
        "Tiger",
        "Leopard",
        "Human intruder",
      ],
      defaultSenderName: "WILDGUARD AI",
      twilioConfigured: false,
    });


  /* =======================================================
     ROLE
     ======================================================= */

  const role =
    currentUser?.role || "operator";


  /* =======================================================
     ROLE LABEL
     ======================================================= */

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
        return "Operator";
    }
  }, [role]);


  /* =======================================================
     AVAILABLE RECIPIENTS
     ======================================================= */

  const availableRecipients =
    useMemo(() => {
      let result = recipients.filter(
        (recipient) =>
          recipient.enabled
      );

      if (
        recipientRole !== "all"
      ) {
        result = result.filter(
          (recipient) =>
            recipient.role ===
            recipientRole
        );
      }

      if (search.trim()) {
        const query =
          search
            .toLowerCase()
            .trim();

        result = result.filter(
          (recipient) =>
            recipient.name
              .toLowerCase()
              .includes(query) ||
            recipient.phone
              .toLowerCase()
              .includes(query) ||
            recipient.location
              .toLowerCase()
              .includes(query)
        );
      }

      return result;
    }, [
      recipients,
      recipientRole,
      search,
    ]);


  /* =======================================================
     FILTERED LOGS
     ======================================================= */

  const filteredLogs =
    useMemo(() => {
      return logs.filter(
        (log) => {

          const matchesStatus =
            logFilter === "all" ||
            log.status ===
              logFilter;

          const query =
            search
              .toLowerCase()
              .trim();

          const matchesSearch =
            !query ||
            log.recipientName
              .toLowerCase()
              .includes(query) ||
            log.recipientPhone
              .toLowerCase()
              .includes(query) ||
            log.message
              .toLowerCase()
              .includes(query);

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      logs,
      logFilter,
      search,
    ]);


  /* =======================================================
     STATISTICS
     ======================================================= */

  const deliveredCount =
    logs.filter(
      (log) =>
        log.status ===
        "delivered"
    ).length;

  const sentCount =
    logs.filter(
      (log) =>
        log.status === "sent" ||
        log.status === "delivered"
    ).length;

  const failedCount =
    logs.filter(
      (log) =>
        log.status ===
        "failed"
    ).length;

  const totalRecipients =
    recipients.filter(
      (recipient) =>
        recipient.enabled
    ).length;


  /* =======================================================
     SELECT RECIPIENT
     ======================================================= */

  const toggleRecipient = (
    id
  ) => {
    setSelectedRecipients(
      (current) =>
        current.includes(id)
          ? current.filter(
              (item) =>
                item !== id
            )
          : [
              ...current,
              id,
            ]
    );
  };


  /* =======================================================
     SELECT ALL
     ======================================================= */

  const selectAllRecipients =
    () => {
      const ids =
        availableRecipients.map(
          (recipient) =>
            recipient.id
        );

      const allSelected =
        ids.every((id) =>
          selectedRecipients.includes(
            id
          )
        );

      if (allSelected) {
        setSelectedRecipients(
          (current) =>
            current.filter(
              (id) =>
                !ids.includes(id)
            )
        );
      } else {
        setSelectedRecipients(
          (current) => [
            ...new Set([
              ...current,
              ...ids,
            ]),
        ]);
      }
    };


  /* =======================================================
     SEND SMS
     ======================================================= */

  const sendSms = async () => {
    if (
      selectedRecipients.length ===
      0
    ) {
      alert(
        "Please select at least one recipient."
      );
      return;
    }

    if (!message.trim()) {
      alert(
        "Please enter a message."
      );
      return;
    }

    setSending(true);

    try {
      const mappedRecipients = recipients
        .filter((recipient) => selectedRecipients.includes(recipient.id))
        .map((r) => Number(r.id));
      const created = await sendSms({
        recipient_ids: mappedRecipients,
        message: message.trim(),
        trigger_type: triggerType,
      });
      const newLogs = (created || []).map(mapSmsLog);
      setLogs((current) => [...newLogs, ...current]);
    } catch (error) {
      console.error("Failed to send SMS:", error);
      alert("Failed to send SMS. Please try again.");
    }

    setMessage("");

    setSelectedRecipients(
      []
    );

    setSending(false);

    setActiveSection(
      "history"
    );
  };


  /* =======================================================
     EMERGENCY SOS
     ======================================================= */

  const sendEmergencySOS = () => {
    const emergencyMessage =
      `WILDGUARD EMERGENCY SOS: Immediate wildlife/security assistance required. Alert generated by ${currentUser?.username || "WildGuard Operator"}.`;

    // Fire the backend SOS broadcast immediately
    sendSos({
      message: emergencyMessage,
      location: currentUser?.locationName || "",
    })
      .then(() => {
        if (onNotification) onNotification({ title: "Emergency SOS Sent", message: "Emergency broadcast dispatched to all stakeholders.", type: "threat" }, false);
      })
      .catch((error) => {
        console.error("Failed to send SOS:", error);
      });

    setMessage(
      emergencyMessage
    );

    setTriggerType(
      "emergency_sos"
    );

    setActiveSection(
      "compose"
    );
  };


  /* =======================================================
     RESET
     ======================================================= */

  const resetComposer = () => {
    setMessage("");

    setSelectedRecipients(
      []
    );

    setTriggerType(
      "manual_broadcast"
    );
  };


  /* =======================================================
     FORMAT TIME
     ======================================================= */

  const formatTime = (
    timestamp
  ) => {
    const seconds = Math.floor(
      (Date.now() -
        timestamp.getTime()) /
        1000
    );

    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    return timestamp.toLocaleDateString();
  };


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="space-y-5">

      {/* =================================================
          HEADER
          ================================================= */}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70">

        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">

                <Smartphone
                  size={10}
                />

                SMS Gateway

              </span>

              <span className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">
                {roleLabel}
              </span>

            </div>

            <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
              SMS Center
            </h1>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              Send wildlife alerts,
              emergency notifications,
              and operational SMS
              messages to registered
              stakeholders.
            </p>

          </div>


          {/* EMERGENCY */}

          <button
            type="button"
            onClick={
              sendEmergencySOS
            }
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold text-red-400 transition hover:bg-red-500/20"
          >
            <ShieldAlert
              size={14}
            />

            Emergency SOS

          </button>

        </div>

      </section>


      {/* =================================================
          STATISTICS
          ================================================= */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">

        <SmsStat
          icon={Users}
          label="Recipients"
          value={
            totalRecipients
          }
          description="Active contacts"
        />

        <SmsStat
          icon={Send}
          label="Messages Sent"
          value={sentCount}
          description="Current logs"
        />

        <SmsStat
          icon={CheckCircle2}
          label="Delivered"
          value={deliveredCount}
          description="Successfully delivered"
        />

        <SmsStat
          icon={AlertTriangle}
          label="Failed"
          value={failedCount}
          description="Delivery failures"
        />

      </section>


      {/* =================================================
          TABS
          ================================================= */}

      <div className="flex w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 p-1">

        <SmsTab
          active={
            activeSection ===
            "compose"
          }
          icon={MessageSquare}
          label="Compose SMS"
          onClick={() =>
            setActiveSection(
              "compose"
            )
          }
        />

        <SmsTab
          active={
            activeSection ===
            "history"
          }
          icon={History}
          label="Message History"
          onClick={() =>
            setActiveSection(
              "history"
            )
          }
        />

        <SmsTab
          active={
            activeSection ===
            "settings"
          }
          icon={Settings2}
          label="SMS Settings"
          onClick={() =>
            setActiveSection(
              "settings"
            )
          }
        />

      </div>


      {/* =================================================
          COMPOSE
          ================================================= */}

      {activeSection ===
        "compose" && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">

          {/* COMPOSER */}

          <section className="rounded-xl border border-slate-800 bg-slate-950/60">

            <div className="border-b border-slate-800 p-4">

              <div className="flex items-center gap-2">

                <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <MessageSquare
                    size={14}
                  />
                </div>

                <div>

                  <h2 className="text-xs font-bold text-slate-200">
                    Compose Message
                  </h2>

                  <p className="text-[9px] text-slate-600">
                    Create and dispatch
                    a notification.
                  </p>

                </div>

              </div>

            </div>


            <div className="space-y-4 p-4">

              {/* TRIGGER TYPE */}

              <div>

                <label className="mb-2 block text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                  Message Type
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                  <TriggerButton
                    active={
                      triggerType ===
                      "manual_broadcast"
                    }
                    icon={Send}
                    label="Broadcast"
                    onClick={() =>
                      setTriggerType(
                        "manual_broadcast"
                      )
                    }
                  />

                  <TriggerButton
                    active={
                      triggerType ===
                      "auto_detection"
                    }
                    icon={Radio}
                    label="Auto Alert"
                    onClick={() =>
                      setTriggerType(
                        "auto_detection"
                      )
                    }
                  />

                  <TriggerButton
                    active={
                      triggerType ===
                      "emergency_sos"
                    }
                    icon={
                      ShieldAlert
                    }
                    label="Emergency"
                    onClick={() =>
                      setTriggerType(
                        "emergency_sos"
                      )
                    }
                  />

                  <TriggerButton
                    active={
                      triggerType ===
                      "test"
                    }
                    icon={Zap}
                    label="Test"
                    onClick={() =>
                      setTriggerType(
                        "test"
                      )
                    }
                  />

                </div>

              </div>


              {/* MESSAGE */}

              <div>

                <div className="mb-2 flex items-center justify-between">

                  <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    Message
                  </label>

                  <span className="text-[9px] text-slate-600">
                    {message.length}
                    /160
                  </span>

                </div>

                <textarea
                  value={message}
                  maxLength={160}
                  onChange={(event) =>
                    setMessage(
                      event.target.value
                    )
                  }
                  placeholder="Enter your SMS notification..."
                  rows={5}
                  className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-5 text-slate-200 outline-none placeholder:text-slate-700 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/5"
                />

              </div>


              {/* BUTTONS */}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={
                    resetComposer
                  }
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-800"
                >
                  <RefreshCw
                    size={12}
                  />

                  Reset

                </button>

                <button
                  type="button"
                  disabled={
                    sending
                  }
                  onClick={
                    sendSms
                  }
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-[10px] font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {sending ? (
                    <>
                      <RefreshCw
                        size={12}
                        className="animate-spin"
                      />

                      Sending...

                    </>
                  ) : (
                    <>
                      <Send
                        size={12}
                      />

                      Send SMS
                    </>
                  )}

                </button>

              </div>

            </div>

          </section>


          {/* RECIPIENTS */}

          <section className="rounded-xl border border-slate-800 bg-slate-950/60">

            <div className="border-b border-slate-800 p-4">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-xs font-bold text-slate-200">
                    Recipients
                  </h2>

                  <p className="mt-1 text-[9px] text-slate-600">
                    Select who receives
                    this message.
                  </p>

                </div>

                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">
                  {
                    selectedRecipients.length
                  } selected
                </span>

              </div>

            </div>


            <div className="p-3">

              {/* SEARCH */}

              <div className="relative">

                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search recipients..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-[10px] text-slate-300 outline-none placeholder:text-slate-700 focus:border-emerald-500/40"
                />

              </div>


              {/* ROLE */}

              <div className="mt-2">

                <select
                  value={
                    recipientRole
                  }
                  onChange={(
                    event
                  ) =>
                    setRecipientRole(
                      event.target.value
                    )
                  }
                  className="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400 outline-none"
                >

                  <option value="all">
                    All roles
                  </option>

                  <option value="operator">
                    Operators
                  </option>

                  <option value="admin">
                    Administrators
                  </option>

                  <option value="landowner">
                    Landowners
                  </option>

                  <option value="village_head">
                    Village Heads
                  </option>

                </select>

              </div>


              {/* SELECT ALL */}

              <button
                type="button"
                onClick={
                  selectAllRecipients
                }
                className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[9px] font-semibold text-slate-400 transition hover:bg-slate-900"
              >

                <span>
                  Select all visible
                </span>

                <Users size={12} />

              </button>


              {/* RECIPIENT LIST */}

              <div className="mt-3 max-h-82.5 space-y-1.5 overflow-y-auto pr-1">

                {availableRecipients.map(
                  (recipient) => {

                    const selected =
                      selectedRecipients.includes(
                        recipient.id
                      );

                    return (
                      <button
                        type="button"
                        key={
                          recipient.id
                        }
                        onClick={() =>
                          toggleRecipient(
                            recipient.id
                          )
                        }
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                          selected
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-transparent hover:border-slate-800 hover:bg-slate-900"
                        }`}
                      >

                        <div
                          className={`grid size-7 shrink-0 place-items-center rounded-full ${
                            selected
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >

                          {selected ? (
                            <CheckCircle2
                              size={13}
                            />
                          ) : (
                            <Phone
                              size={12}
                            />
                          )}

                        </div>

                        <div className="min-w-0 flex-1">

                          <p className="truncate text-[10px] font-semibold text-slate-300">
                            {
                              recipient.name
                            }
                          </p>

                          <p className="mt-0.5 truncate text-[8px] text-slate-600">
                            {
                              recipient.phone
                            }
                            {" · "}
                            {
                              recipient.role
                            }
                          </p>

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

            </div>

          </section>

        </div>
      )}


      {/* =================================================
          HISTORY
          ================================================= */}

      {activeSection ===
        "history" && (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">

          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="flex items-center gap-2 text-xs font-bold text-slate-200">

                <History
                  size={14}
                  className="text-emerald-400"
                />

                SMS Delivery History

              </h2>

              <p className="mt-1 text-[9px] text-slate-600">
                Complete record of
                dispatched notifications.
              </p>

            </div>


            <div className="flex items-center gap-2">

              <select
                value={
                  logFilter
                }
                onChange={(event) =>
                  setLogFilter(
                    event.target.value
                  )
                }
                className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-slate-400 outline-none"
              >

                <option value="all">
                  All messages
                </option>

                <option value="delivered">
                  Delivered
                </option>

                <option value="sent">
                  Sent
                </option>

                <option value="simulated">
                  Simulated
                </option>

                <option value="failed">
                  Failed
                </option>

              </select>

            </div>

          </div>


          <div className="overflow-x-auto">

            <table className="w-full min-w-200">

              <thead>

                <tr className="border-b border-slate-900 text-left">

                  <th className="px-4 py-3 text-[8px] uppercase tracking-wider text-slate-600">
                    Recipient
                  </th>

                  <th className="px-4 py-3 text-[8px] uppercase tracking-wider text-slate-600">
                    Message
                  </th>

                  <th className="px-4 py-3 text-[8px] uppercase tracking-wider text-slate-600">
                    Type
                  </th>

                  <th className="px-4 py-3 text-[8px] uppercase tracking-wider text-slate-600">
                    Status
                  </th>

                  <th className="px-4 py-3 text-[8px] uppercase tracking-wider text-slate-600">
                    Time
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-slate-900">

                {filteredLogs.map(
                  (log) => (
                    <tr
                      key={log.id}
                      className="transition hover:bg-slate-900/40"
                    >

                      <td className="px-4 py-3">

                        <div className="flex items-center gap-2">

                          <div className="grid size-8 place-items-center rounded-lg bg-slate-900 text-slate-500">
                            <Phone
                              size={12}
                            />
                          </div>

                          <div>

                            <p className="text-[10px] font-semibold text-slate-300">
                              {
                                log.recipientName
                              }
                            </p>

                            <p className="text-[8px] text-slate-600">
                              {
                                log.recipientPhone
                              }
                            </p>

                          </div>

                        </div>

                      </td>


                      <td className="max-w-90 px-4 py-3">

                        <p className="truncate text-[10px] text-slate-400">
                          {
                            log.message
                          }
                        </p>

                      </td>


                      <td className="px-4 py-3">

                        <span className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[8px] capitalize text-slate-500">
                          {log.triggerType.replace(
                            "_",
                            " "
                          )}
                        </span>

                      </td>


                      <td className="px-4 py-3">

                        <SmsStatus
                          status={
                            log.status
                          }
                        />

                      </td>


                      <td className="px-4 py-3">

                        <span className="text-[9px] text-slate-600">
                          {formatTime(
                            log.timestamp
                          )}
                        </span>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>
      )}


      {/* =================================================
          SETTINGS
          ================================================= */}

      {activeSection ===
        "settings" && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60">

          <div className="flex items-center justify-between border-b border-slate-800 p-4">

            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold text-slate-200">

                <Settings2
                  size={14}
                  className="text-emerald-400"
                />

                SMS Configuration

              </h2>

              <p className="mt-1 text-[9px] text-slate-600">
                Configure automatic alert
                notifications and gateway
                settings.
              </p>
            </div>

            <button
              type="button"
              onClick={saveSmsConfig}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-400 transition hover:bg-emerald-500/20"
            >
              <Save size={13} />
              Save Settings
            </button>

          </div>


          <div className="grid gap-5 p-4 lg:grid-cols-2">

            {/* AUTO ALERT */}

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-xs font-semibold text-slate-300">
                    Automatic Alerts
                  </p>

                  <p className="mt-1 max-w-sm text-[9px] leading-4 text-slate-600">
                    Automatically dispatch
                    SMS when AI detects a
                    configured wildlife
                    threat.
                  </p>

                </div>

                <Toggle
                  enabled={
                    smsConfig.autoAlertEnabled
                  }
                  onChange={() =>
                    setSmsConfig(
                      (current) => ({
                        ...current,
                        autoAlertEnabled:
                          !current.autoAlertEnabled,
                      })
                    )
                  }
                />

              </div>

            </div>


            {/* SENDER */}

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

              <label className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Sender Name
              </label>

              <input
                value={
                  smsConfig.defaultSenderName
                }
                onChange={(event) =>
                  setSmsConfig(
                    (current) => ({
                      ...current,
                      defaultSenderName:
                        event.target.value,
                    })
                  )
                }
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500/40"
              />

            </div>


            {/* ALERT LEVELS */}

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Automatic Alert Levels
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                {[
                  "LOW",
                  "MEDIUM",
                  "HIGH",
                  "CRITICAL",
                ].map(
                  (level) => {

                    const active =
                      smsConfig.alertLevels.includes(
                        level
                      );

                    return (
                      <button
                        type="button"
                        key={level}
                        onClick={() =>
                          setSmsConfig(
                            (current) => ({
                              ...current,
                              alertLevels:
                                active
                                  ? current.alertLevels.filter(
                                      (
                                        item
                                      ) =>
                                        item !==
                                        level
                                    )
                                  : [
                                      ...current.alertLevels,
                                      level,
                                    ],
                            })
                          )
                        }
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-[9px] font-bold transition ${
                          active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-800 bg-slate-900 text-slate-600"
                        }`}
                      >
                        {level}
                      </button>
                    );
                  }
                )}

              </div>

            </div>


            {/* SPECIES */}

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">

              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Monitored Species
              </p>

              <div className="mt-3 flex flex-wrap gap-2">

                {[
                  "Elephant",
                  "Tiger",
                  "Leopard",
                  "Human intruder",
                  "No Threat",
                ].map(
                  (species) => {

                    const active =
                      smsConfig.selectedSpecies.includes(
                        species
                      );

                    return (
                      <button
                        type="button"
                        key={species}
                        onClick={() =>
                          setSmsConfig(
                            (current) => ({
                              ...current,
                              selectedSpecies:
                                active
                                  ? current.selectedSpecies.filter(
                                      (
                                        item
                                      ) =>
                                        item !==
                                        species
                                    )
                                  : [
                                      ...current.selectedSpecies,
                                      species,
                                    ],
                            })
                          )
                        }
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-[9px] transition ${
                          active
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-800 bg-slate-900 text-slate-600"
                        }`}
                      >
                        {species}
                      </button>
                    );
                  }
                )}

              </div>

            </div>


            {/* GATEWAY */}

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 lg:col-span-2">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-3">

                  <div
                    className={`grid size-9 place-items-center rounded-lg ${
                      smsConfig.twilioConfigured
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    <Radio
                      size={15}
                    />
                  </div>

                  <div>

                    <p className="text-xs font-semibold text-slate-300">
                      SMS Gateway
                    </p>

                    <p className="mt-1 text-[9px] text-slate-600">
                      {smsConfig.twilioConfigured
                        ? "Twilio gateway is configured and ready."
                        : "Gateway is in simulation mode. Configure Twilio for real SMS delivery."}
                    </p>

                  </div>

                </div>


                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-bold ${
                    smsConfig.twilioConfigured
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                  }`}
                >

                  <span className="size-1.5 rounded-full bg-current" />

                  {smsConfig.twilioConfigured
                    ? "Connected"
                    : "Simulation Mode"}

                </span>

              </div>

            </div>

          </div>

        </section>
      )}

    </div>
  );
};


/* =========================================================
   STAT CARD
   ========================================================= */

const SmsStat = ({
  icon: Icon,
  label,
  value,
  description,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-100">
            {value}
          </p>

        </div>

        <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Icon size={16} />
        </div>

      </div>

      <p className="mt-2 text-[9px] text-slate-600">
        {description}
      </p>

    </div>
  );
};


/* =========================================================
   TAB
   ========================================================= */

const SmsTab = ({
  active,
  icon: Icon,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold transition ${
        active
          ? "bg-slate-800 text-slate-100"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
};


/* =========================================================
   TRIGGER BUTTON
   ========================================================= */

const TriggerButton = ({
  active,
  icon: Icon,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-[9px] font-semibold transition ${
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
};


/* =========================================================
   SMS STATUS
   ========================================================= */

const SmsStatus = ({
  status,
}) => {

  const config = {
    delivered: {
      label: "Delivered",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      icon: CheckCircle2,
    },

    sent: {
      label: "Sent",
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-400",
      icon: Send,
    },

    simulated: {
      label: "Simulated",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-400",
      icon: Zap,
    },

    failed: {
      label: "Failed",
      className:
        "border-red-500/20 bg-red-500/10 text-red-400",
      icon: X,
    },
  };

  const current =
    config[status] ||
    config.simulated;

  const Icon =
    current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[8px] font-bold ${current.className}`}
    >
      <Icon size={9} />
      {current.label}
    </span>
  );
};


/* =========================================================
   TOGGLE
   ========================================================= */

const Toggle = ({
  enabled,
  onChange,
}) => {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-5 w-9 cursor-pointer rounded-full transition ${
        enabled
          ? "bg-emerald-500"
          : "bg-slate-700"
      }`}
    >

      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition ${
          enabled
            ? "left-4.5"
            : "left-0.5"
        }`}
      />

    </button>
  );
};

const capitalize = (value) => {
  if (!value) return value;
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export default SmsCenter;
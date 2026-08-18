import React, { useMemo, useState } from "react";
import {Activity,AlertTriangle,CheckCircle2,Edit3,Lock,MessageSquare,Plus,Search,Shield,Trash2,UserCheck,UserCog,UserX,Users,X,} from "lucide-react";

const initialUsers = [
  {
    id: "USR-001",
    username: "admin",
    email: "admin@wildguard.org",
    role: "admin",
    phone: "+91 9876543210",
    locationName: "National Reserve Network",
    smsAlertsEnabled: true,
    createdAt: "2026-07-01",
    isActive: true,
  },
  {
    id: "USR-002",
    username: "ranger01",
    email: "ranger@wildguard.org",
    role: "operator",
    phone: "+91 9876543211",
    locationName: "Sector B3 - Green Valley",
    smsAlertsEnabled: true,
    createdAt: "2026-07-05",
    isActive: true,
  },
  {
    id: "USR-003",
    username: "landowner01",
    email: "farmer@wildguard.org",
    role: "landowner",
    phone: "+91 9876543212",
    locationName: "Sector B3 - Green Valley Orchards",
    smsAlertsEnabled: true,
    createdAt: "2026-07-12",
    isActive: true,
  },
  {
    id: "USR-004",
    username: "villagehead01",
    email: "villagehead@wildguard.org",
    role: "village_head",
    phone: "+91 9876543213",
    locationName: "Sector A4 - Silverwood Hamlet",
    smsAlertsEnabled: true,
    createdAt: "2026-07-18",
    isActive: true,
  },
  {
    id: "USR-005",
    username: "operator02",
    email: "operator2@wildguard.org",
    role: "operator",
    phone: "+91 9876543214",
    locationName: "Sector C2",
    smsAlertsEnabled: false,
    createdAt: "2026-07-25",
    isActive: false,
  },
];

const initialLogs = [
  {
    id: "LOG-001",
    timestamp: "2026-08-16 09:42:18",
    user: "admin",
    ip: "192.168.1.10",
    action: "User Login",
    details: "Administrator signed into the control panel",
    isSuspicious: false,
  },
  {
    id: "LOG-002",
    timestamp: "2026-08-16 09:35:44",
    user: "ranger01",
    ip: "192.168.1.24",
    action: "Sighting Updated",
    details: "Tiger sighting WG-2488 marked as active",
    isSuspicious: false,
  },
  {
    id: "LOG-003",
    timestamp: "2026-08-16 08:51:22",
    user: "unknown",
    ip: "45.122.18.77",
    action: "Failed Login",
    details: "Multiple invalid authentication attempts",
    isSuspicious: true,
  },
  {
    id: "LOG-004",
    timestamp: "2026-08-16 08:12:05",
    user: "operator02",
    ip: "192.168.1.31",
    action: "SMS Broadcast",
    details: "Manual alert broadcast initiated",
    isSuspicious: false,
  },
];

const AdminPanel = () => {
  const [users, setUsers] = useState(initialUsers);
  const [logs] = useState(initialLogs);
  const [activeSection, setActiveSection] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [smsConfig, setSmsConfig] = useState({
    autoAlertEnabled: true,
    highAlert: true,
    criticalAlert: true,
    mediumAlert: true,
    lowAlert: false,
    twilioConfigured: false,
    senderName: "WILDGUARD",
  });

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    role: "operator",
    phone: "",
    locationName: "",
    smsAlertsEnabled: true,
  });

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = user.username.toLowerCase().includes(search) || user.email.toLowerCase().includes(search) || user.locationName?.toLowerCase().includes(search);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const statistics = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      operators: users.filter((u) => u.role === "operator").length,
      stakeholders: users.filter( (u) => u.role === "landowner" || u.role === "village_head").length,
      suspicious: logs.filter((log) => log.isSuspicious).length,
    };
  }, [users, logs]);

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      role: "operator",
      phone: "",
      locationName: "",
      smsAlertsEnabled: true,
    });
    setEditingUser(null);
  };

  const openAddUser = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
      locationName: user.locationName || "",
      smsAlertsEnabled: user.smsAlertsEnabled ?? true,
    });
    setShowModal(true);
  };

  const saveUser = (event) => {
    event.preventDefault();
    if (!formData.username || !formData.email) return;
    if (editingUser) {
      setUsers((current) => current.map((user) => user.id === editingUser.id ? { ...user, ...formData, } : user ) );
    } else {
      const newUser = {
        id: `USR-${String(users.length + 1).padStart(3, "0")}`,
        ...formData,
        createdAt: new Date().toISOString().split("T")[0],
        isActive: true,
      };
      setUsers((current) => [...current, newUser]);
    }
    setShowModal(false);
    resetForm();
  };

  const toggleUserStatus = (id) => {
    setUsers((current) =>
      current.map((user) => user.id === id ? { ...user, isActive: !user.isActive, } : user )
    );
  };

  const deleteUser = (id) => {
    const user = users.find((item) => item.id === id);
    if (user?.role === "admin") {
      alert("The administrator account cannot be deleted.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers((current) =>
        current.filter((user) => user.id !== id)
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#071417] px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <Shield className="h-7 w-7 text-emerald-400" />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                  Administrator Console
                </p>
                <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">
                  Control Panel
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Manage WildGuard users, system security, SMS configuration,
                  and operational activity.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <Lock className="h-4 w-4 text-red-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Access Level
                </p>
                <p className="text-sm font-bold text-red-400">
                  Administrator
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard icon={Users} label="Total Users" value={statistics.total}/>
          <StatCard icon={UserCheck} label="Active Users" value={statistics.active}/>
          <StatCard icon={UserCog} label="Operators" value={statistics.operators}/>
          <StatCard icon={Shield} label="Stakeholders" value={statistics.stakeholders}/>
          <StatCard icon={AlertTriangle} label="Security Events" value={statistics.suspicious} danger/>
        </div>

        {/* Navigation */}
        <div className="flex overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 p-1">
          <AdminTab active={activeSection === "users"} onClick={() => setActiveSection("users")} icon={Users} label="User Management"/>
          <AdminTab active={activeSection === "logs"} onClick={() => setActiveSection("logs")} icon={Activity} label="System Logs"/>
          <AdminTab active={activeSection === "sms"} onClick={() => setActiveSection("sms")} icon={MessageSquare} label="SMS Configuration"/>
          <AdminTab active={activeSection === "security"} onClick={() => setActiveSection("security")} icon={Lock} label="Security"/>
        </div>

        {/* USER MANAGEMENT */}
        {activeSection === "users" && (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-white">
                  User Management
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Create, modify, activate, and deactivate system users.
                </p>
              </div>

              <button type="button" onClick={openAddUser} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
                <Plus className="h-4 w-4" />Add User
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search users..." className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-200 outline-none focus:border-emerald-500/50"/>
              </div>

              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 outline-none">
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="landowner">Landowner</option>
                <option value="village_head">Village Head</option>
              </select>

            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-225">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">SMS</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-900 hover:bg-slate-900/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-400">
                            {user.username.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              {user.username}
                            </p>

                            <p className="text-xs text-slate-600">
                              {user.email}
                            </p>
                          </div>

                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-400">
                        {user.locationName || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {user.smsAlertsEnabled ? (
                          <span className="text-xs font-semibold text-emerald-400">
                            Enabled
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">
                            Disabled
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">

                          <button type="button" onClick={() => openEditUser(user)} title="Edit user" className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-400">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button type="button" onClick={() =>toggleUserStatus(user.id)} title={ user.isActive ? "Deactivate" : "Activate" }
                            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:text-yellow-400">
                            {user.isActive ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button type="button" onClick={() => deleteUser(user.id)} title="Delete user" className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>

              {filteredUsers.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-slate-600">
                  No users found.
                </div>
              )}

            </div>
          </section>
        )}

        {/* SYSTEM LOGS */}
        {activeSection === "logs" && (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 p-5">
              <h2 className="font-bold text-white">
                System Activity Logs
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Audit trail of user and system activity.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-225">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">IP Address</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-900">
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {log.timestamp}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-300">
                        {log.user}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {log.ip}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-300">
                        {log.action}
                      </td>
                      <td className="max-w-sm px-5 py-4 text-xs text-slate-500">
                        {log.details}
                      </td>
                      <td className="px-5 py-4">
                        {log.isSuspicious ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Suspicious
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Normal
                          </span>
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </section>
        )}

        {/* SMS CONFIGURATION */}
        {activeSection === "sms" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                  <MessageSquare className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white">
                    SMS Alert Configuration
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Configure automatic SMS notifications.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
              <div className="space-y-5">
                <ToggleSetting label="Automatic SMS Alerts" description="Send SMS when a threat is detected." enabled={smsConfig.autoAlertEnabled}
                 onChange={(value) => setSmsConfig((current) => ({ ...current, autoAlertEnabled: value, }))}/>

                <ToggleSetting label="Critical Alerts" description="Send SMS for CRITICAL threats." enabled={smsConfig.criticalAlert} onChange={(value) => setSmsConfig((current) => ({ ...current, criticalAlert: value, }))}/>

                <ToggleSetting label="High Alerts" description="Send SMS for HIGH threats." enabled={smsConfig.highAlert} onChange={(value) => setSmsConfig((current) => ({ ...current, highAlert: value, }))} />

                <ToggleSetting label="Medium Alerts" description="Send SMS for MEDIUM threats." enabled={smsConfig.mediumAlert} onChange={(value) => setSmsConfig((current) => ({ ...current, mediumAlert: value, }))}/>

                <ToggleSetting label="Low Alerts" description="Send SMS for LOW threats." enabled={smsConfig.lowAlert} onChange={(value) => setSmsConfig((current) => ({ ...current, lowAlert: value,}))} />

              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <label className="text-sm font-semibold text-slate-200">
                    Sender Name
                  </label>
                  <input value={smsConfig.senderName} onChange={(e) => setSmsConfig((current) => ({ ...current, senderName: e.target.value,}))} className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/50"/>
                  <p className="mt-2 text-xs text-slate-600">
                    Name displayed as the SMS sender.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        SMS Gateway
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Twilio integration status
                      </p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${ smsConfig.twilioConfigured ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400" }`}>
                      {smsConfig.twilioConfigured ? "CONNECTED" : "SIMULATED"}
                    </span>
                  </div>
                  <button type="button" onClick={() => setSmsConfig((current) => ({ ...current, twilioConfigured: !current.twilioConfigured, }))} className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">
                    {smsConfig.twilioConfigured ? "Switch to Simulation" : "Configure Gateway"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECURITY */}
        {activeSection === "security" && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SecurityCard icon={Lock} title="Authentication Security" description="Controls for administrator authentication and access.">
              <SecurityRow label="Administrator authentication" value="Enabled"/>
              <SecurityRow label="Session protection" value="Active"/>
              <SecurityRow label="Role-based access" value="Enabled"/>
              <SecurityRow label="Audit logging" value="Enabled"/>
            </SecurityCard>

            <SecurityCard icon={AlertTriangle} title="Security Monitoring" description="Current system security status.">
              <SecurityRow label="Suspicious events" value={`${statistics.suspicious} detected`} danger />
              <SecurityRow label="Failed authentication" value="1 event" danger/>
              <SecurityRow label="System status" value="Operational"/>
              <SecurityRow label="Monitoring" value="Active"/>
            </SecurityCard>
          </section>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-slate-900 pt-4 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            WILDGUARD AI • Administrator Control Panel
          </span>
          <span>
            Role-Based Access Control Enabled
          </span>
        </div>

      </div>

      {/* ADD / EDIT USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#09191d] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Administration
                </p>
                <h2 className="mt-1 text-lg font-bold text-white">
                  {editingUser ? "Edit User" : "Create User"}
                </h2>
              </div>
              <button type="button" onClick={() => { setShowModal(false); resetForm();}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveUser} className="space-y-4 p-5">

              <AdminInput label="Username" value={formData.username} onChange={(e) => setFormData((current) => ({ ...current, username: e.target.value, }))} placeholder="Enter username" required/>

              <AdminInput label="Email" type="email" value={formData.email} onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value, }))} placeholder="user@wildguard.org" required/>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">
                  Role
                </label>
                <select value={formData.role} onChange={(e) => setFormData((current) => ({ ...current, role: e.target.value, }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-500/50">
                  <option value="operator">Operator</option>
                  <option value="landowner">Landowner</option>
                  <option value="village_head">Village Head</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <AdminInput label="Phone Number" value={formData.phone} onChange={(e) => setFormData((current) => ({ ...current, phone: e.target.value, }))} placeholder="+91 XXXXX XXXXX"/>

              <AdminInput label="Location / Sector" value={formData.locationName} onChange={(e) => setFormData((current) => ({ ...current, locationName: e.target.value, }))} placeholder="Sector A1"/>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    SMS Alerts
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Allow this user to receive threat alerts.
                  </p>
                </div>
                <input type="checkbox" checked={formData.smsAlertsEnabled} onChange={(e) => setFormData((current) => ({ ...current, smsAlertsEnabled: e.target.checked, }))} className="h-4 w-4 accent-emerald-500"/>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400">
                  {editingUser ? "Save Changes" : "Create User"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};


//reusable components
const StatCard = ({ icon: Icon, label, value, danger = false,}) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${ danger ? "border-red-500/20 bg-red-500/10" : "border-emerald-500/20 bg-emerald-500/10" }`}>
        <Icon className={`h-4 w-4 ${ danger ? "text-red-400" : "text-emerald-400"}`}/>
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${ danger ? "text-red-400" : "text-slate-100"}`}> {value}</p>
    </div>
  );
};

const AdminTab = ({ active, onClick, icon: Icon, label,}) => {
  return (
    <button type="button" onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
        active ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

const RoleBadge = ({ role }) => {
  const labels = {
    admin: "Admin",
    operator: "Operator",
    landowner: "Landowner",
    village_head: "Village Head",
  };
  return (
    <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300">{labels[role] || role} </span>
  );
};

const AdminInput = ({ label, type = "text", value, onChange, placeholder, required = false,}) => {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-slate-300"> {label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-emerald-500/50"/>
    </div>
  );
};

const ToggleSetting = ({ label, description, enabled, onChange,}) => {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="pr-4">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
      <button type="button" onClick={() => onChange(!enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${ enabled ? "bg-emerald-500" : "bg-slate-700"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${ enabled ? "left-6" : "left-1"}`}/>
      </button>

    </div>
  );
};

const SecurityCard = ({ icon: Icon, title, description, children,}) => {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-bold text-white">{title}</h2>
          <p className="mt-1 text-xs text-slate-600"> {description}</p>
        </div>
      </div>
      <div className="space-y-2"> {children}</div>
    </section>
  );
};

const SecurityRow = ({ label, value, danger = false,}) => {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <span className="text-xs text-slate-500"> {label}</span>
      <span className={`text-xs font-bold ${ danger ? "text-red-400" : "text-emerald-400"}`}> {value}</span>
    </div>
  );
};

export default AdminPanel;
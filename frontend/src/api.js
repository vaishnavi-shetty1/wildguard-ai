const API_BASE = "/api/v1";

function getAuthHeaders() {
  const token = localStorage.getItem("wildguard_token") || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getDeviceHeaders() {
  const token = localStorage.getItem("wildguard_token") || "";
  return {
    "Content-Type": "application/json",
    "X-Api-Key": token,
  };
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Authentication ────────────────────────────────────────────────────────────

export function loginUser({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return request("/auth/me");
}

// ── User management ───────────────────────────────────────────────────────────

export function fetchUsers() {
  return request("/users");
}

export function createUser(payload) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(id, payload) {
  return request(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id) {
  return request(`/users/${id}`, {
    method: "DELETE",
  });
}

// ── SMS ───────────────────────────────────────────────────────────────────────

export function getSmsConfig() {
  return request("/sms/config");
}

export function updateSmsConfig(payload) {
  return request("/sms/config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function sendSms(payload) {
  return request("/sms/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchSmsLogs(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.trigger_type) qs.set("trigger_type", params.trigger_type);
  if (params.limit) qs.set("limit", params.limit);
  const q = qs.toString();
  return request(`/sms/logs${q ? `?${q}` : ""}`);
}

// ── Alerts / SOS ──────────────────────────────────────────────────────────────

export function sendSos(payload) {
  return request("/alerts/sos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── System logs ───────────────────────────────────────────────────────────────

export function fetchSystemLogs(limit = 100) {
  return request(`/logs?limit=${limit}`);
}

// ── Detections / stats ────────────────────────────────────────────────────────

export function fetchDetections({ species, device_id, from_dt, to_dt, limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  if (species) params.set("species", species);
  if (device_id) params.set("device_id", device_id);
  if (from_dt) params.set("from_dt", from_dt);
  if (to_dt) params.set("to_dt", to_dt);
  params.set("limit", limit);
  params.set("offset", offset);
  const qs = params.toString();
  return request(`/detections${qs ? `?${qs}` : ""}`);
}

export function fetchDetection(id) {
  return request(`/detections/${id}`);
}

export function updateDetection(id, payload) {
  return request(`/detections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchStats() {
  return request("/stats");
}

export function postDetection(payload) {
  return fetch(`${API_BASE}/detections`, {
    method: "POST",
    headers: getDeviceHeaders(),
    body: JSON.stringify(payload),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Request failed: ${res.status}`);
    }
    return res.json();
  });
}

export function getWebSocketUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/v1/ws/live`;
}

export function mapBackendDetection(d) {
  const ts = d.detected_at || new Date().toISOString();
  const confidence = typeof d.confidence === "number" ? d.confidence : 0;
  const pct = `${Math.round(confidence * 100)}%`;
  const level = getThreatLevel(d.species, confidence);
  const location =
    d.latitude != null && d.longitude != null
      ? `${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}`
      : "Unknown Location";

  return {
    id: d.id,
    animal: d.species,
    species: d.species,
    confidence: pct,
    confidenceValue: confidence,
    level,
    threatLevel: level,
    location,
    cameraName: d.device_id || "AI Camera",
    timestamp: ts,
    date: new Date(ts).toLocaleDateString(),
    time: new Date(ts).toLocaleTimeString(),
    smsSent: d.sms_sent,
    imageB64: d.image_b64,
  };
}

export function getThreatLevel(species, confidence) {
  if (species === "unknown" || species === "no threat") return "LOW";
  if (confidence >= 0.85) return "HIGH";
  if (confidence >= 0.6) return "MEDIUM";
  return "LOW";
}

// ── User mapping ──────────────────────────────────────────────────────────────

export function mapBackendUser(u) {
  return {
    id: String(u.id),
    uid: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    phone: u.phone || "",
    locationName: u.location_name || "",
    smsAlertsEnabled: u.sms_alerts_enabled,
    isActive: u.is_active,
    createdAt: u.created_at,
  };
}

export function mapSmsLog(l) {
  return {
    id: String(l.id),
    uid: l.id,
    timestamp: new Date(l.timestamp),
    recipientPhone: l.recipient_phone || "",
    recipientName: l.recipient_name || "",
    recipientRole: l.recipient_role || "custom",
    message: l.message || "",
    status: l.status || "simulated",
    triggerType: l.trigger_type || "manual_broadcast",
    sightingId: l.sighting_id,
    sector: l.sector || "",
  };
}

export function mapSystemLog(sl) {
  return {
    id: String(sl.id),
    timestamp: new Date(sl.timestamp).toLocaleString(),
    user: sl.user || "",
    ip: sl.ip || "",
    action: sl.action || "",
    details: sl.details || "",
    isSuspicious: sl.is_suspicious || false,
  };
}

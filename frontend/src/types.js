//user roles 
export const USER_ROLES =[
    "admin",
    "operator",
    "village_head",
    "landowner",
];

export const DEFAULT_USER ={
    id: "",
    username: "",
    email: "",
    role : "operator",
    phone : "",
    loactionName : "",
    smsAlertsEnabled : true,
    createdAt : "",
    isActive: true,
};

//sightings
export const SIGHTING_LABELS =[
    "Elephant",
    "Tiger",
    "Leopard",
    "No Threat",
    "Human intruder",
];

export const ALERT_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const SIGHTING_STATUSES = [
  "active",
  "resolved",
  "dismissed",
];

export const DEFAULT_SIGHTING = {
  id: "",
  timestamp: "",
  label: "No Threat",
  confidence: 0,
  details: "",
  image: "",
  alertLevel: "LOW",
  location: "",
  status: "active",
  coordinates: null,
  notified: false,
  smsDispatched: false,
  smsRecipientCount: 0,
};

//bounding box
export const DEFAULT_BOUNDING_BOX = {
  ymin: 0,
  xmin: 0,
  ymax: 0,
  xmax: 0,
};

//sms
export const SMS_STATUSES = [
  "delivered",
  "sent",
  "simulated",
  "failed",
];

export const SMS_RECIPIENT_ROLES = [
  ...USER_ROLES,
  "custom",
];

export const SMS_TRIGGER_TYPES = [
  "auto_detection",
  "manual_broadcast",
  "emergency_sos",
  "test",
];

export const DEFAULT_SMS_LOG = {
  id: "",
  timestamp: "",
  recipientPhone: "",
  recipientName: "",
  recipientRole: "custom",
  message: "",
  status: "simulated",
  sightingId: "",
  sector: "",
  triggerType: "test",
};

//sms configuration
export const DEFAULT_SMS_CONFIG = {
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

  defaultSenderName: "WILDGUARD",

//   twilioConfigured: false,
};

//system log
export const DEFAULT_SYSTEM_LOG = {
  id: "",
  timestamp: "",
  user: "",
  ip: "",
  action: "",
  details: "",
  isSuspicious: false,
};

//machine training

//functions
export function createUser(data = {}) {
  return {
    ...DEFAULT_USER,
    ...data,
  };
}

export function createSighting(data = {}) {
  return {
    ...DEFAULT_SIGHTING,
    ...data,
  };
}

export function createBoundingBox(data = {}) {
  return {
    ...DEFAULT_BOUNDING_BOX,
    ...data,
  };
}

export function createSmsLog(data = {}) {
  return {
    ...DEFAULT_SMS_LOG,
    ...data,
  };
}

export function createSmsConfig(data = {}) {
  return {
    ...DEFAULT_SMS_CONFIG,
    ...data,
  };
}

export function createSystemLog(data = {}) {
  return {
    ...DEFAULT_SYSTEM_LOG,
    ...data,
  };
}
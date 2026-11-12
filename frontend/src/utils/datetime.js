const TIME_OPTIONS = {
  hour: "numeric",
  minute: "2-digit",
};

const DATE_OPTIONS = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "09/11/2026" — day/month/year. Returns an empty string for bad values. */
export const formatDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-GB", DATE_OPTIONS) : "";
};

/** "Today", "Yesterday" or "Earlier" — used to group notification lists. */
export const getDayGroup = (value) => {
  const date = toDate(value);
  if (!date) return "Earlier";

  const now = new Date();
  if (isSameDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  return "Earlier";
};

/**
 * "Today at 2:34 PM", "Yesterday at 9:05 AM", "04/11/2026, 6:12 PM".
 * Returns an empty string for missing or unparseable timestamps.
 */
export const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return "";

  const now = new Date();
  const time = date.toLocaleTimeString(undefined, TIME_OPTIONS);

  if (isSameDay(date, now)) return `Today at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday at ${time}`;

  return `${formatDate(date)}, ${time}`;
};

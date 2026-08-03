const IST = { timeZone: "Asia/Kolkata" };

export const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", ...IST }) : "—";

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...IST }) : "—";

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...IST }) : "—";

export const fmtDateTimeFull = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { ...IST }) : "—";

export const toISTDateString = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

export const todayIST = () => toISTDateString(new Date());

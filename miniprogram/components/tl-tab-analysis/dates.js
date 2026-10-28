function monthAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateAnchor() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatAnalysisRangeLabel(mode, anchor, fallback = "") {
  if ((mode === "month" || mode === "calendar") && /^\d{4}-\d{2}$/.test(anchor)) {
    return `${anchor.slice(0, 4)}年${anchor.slice(5, 7)}月`;
  }
  if (mode === "year" && /^\d{4}$/.test(anchor)) return `${anchor}年`;
  return fallback;
}

function customRangeDefaults() {
  const end = dateAnchor();
  return { start: `${end.slice(0, 8)}01`, end };
}

function isCurrentMonthAnchor(anchor) {
  return anchor === monthAnchor();
}

function isCurrentYearAnchor(anchor) {
  return Number(anchor) === new Date().getFullYear();
}

function shiftMonth(anchor, delta) {
  const [year, month] = String(anchor || monthAnchor())
    .split("-")
    .map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function getCalendarSelectedDate(anchor, selectedDate) {
  if (String(selectedDate || "").startsWith(anchor + "-")) return selectedDate;
  const today = dateAnchor();
  return today.startsWith(anchor + "-") ? today : anchor + "-01";
}

function formatCalendarDateLabel(date) {
  if (!date) return "";
  const parsed = new Date(date + "T00:00:00");
  const days = [
    "\u5468\u65e5",
    "\u5468\u4e00",
    "\u5468\u4e8c",
    "\u5468\u4e09",
    "\u5468\u56db",
    "\u5468\u4e94",
    "\u5468\u516d",
  ];
  return (
    Number(date.slice(5, 7)) +
    " \u6708 " +
    Number(date.slice(8, 10)) +
    " \u65e5 \u00b7 " +
    days[parsed.getDay()]
  );
}

module.exports = {
  monthAnchor,
  dateAnchor,
  formatAnalysisRangeLabel,
  customRangeDefaults,
  isCurrentMonthAnchor,
  isCurrentYearAnchor,
  shiftMonth,
  getCalendarSelectedDate,
  formatCalendarDateLabel,
};

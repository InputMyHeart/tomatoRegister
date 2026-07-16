function formatDateLabel(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText || "未选择日期";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDateTime(dateText, timeText = "") {
  return [dateText, timeText].filter(Boolean).join(" ") || "未选择时间";
}

module.exports = { formatDateLabel, formatDateTime };

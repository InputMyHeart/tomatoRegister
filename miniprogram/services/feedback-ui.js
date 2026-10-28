const listeners = new Set();
const loadingRequests = new Map();
const TOAST_TYPES = new Set(["success", "warning", "error", "info"]);
const READONLY_MESSAGE = "当前账本为只读账本，访客仅可查看";

let nextLoadingId = 0;
let toast = null;
let toastTimer = null;

function getSnapshot() {
  const loading = Array.from(loadingRequests.values()).pop() || null;
  return {
    loading: loading ? { ...loading } : null,
    toast: toast ? { ...toast } : null,
  };
}

function notify() {
  const snapshot = getSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

function subscribe(listener) {
  listeners.add(listener);
  listener(getSnapshot());
  return () => listeners.delete(listener);
}

function showLoading(options = {}) {
  const id = ++nextLoadingId;
  const message = String(options.message || "").trim() || "处理中…";
  loadingRequests.set(id, { id, message });
  notify();
  return id;
}

function updateLoading(id, options = {}) {
  if (!loadingRequests.has(id)) return false;
  const message = String(options.message || "").trim();
  if (!message) return false;
  loadingRequests.set(id, { id, message });
  notify();
  return true;
}

function hideLoading(id) {
  if (!loadingRequests.delete(id)) return false;
  notify();
  return true;
}

function hideToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  if (!toast) return;
  toast = null;
  notify();
}

function showToast(options = {}) {
  const rawMessage = String(options.message || "").trim();
  const message = rawMessage === "READONLY_LEDGER" ? READONLY_MESSAGE : rawMessage;
  if (!message) return false;
  const type = TOAST_TYPES.has(options.type) ? options.type : "info";
  const defaultDuration = type === "warning" || type === "error" ? 3200 : 2200;
  const duration = Number.isFinite(options.duration)
    ? Math.min(6000, Math.max(1000, options.duration))
    : defaultDuration;

  if (toastTimer) clearTimeout(toastTimer);
  toast = { type, message };
  notify();
  toastTimer = setTimeout(hideToast, duration);
  return true;
}

function showReadonlyToast() {
  return showToast({ type: "warning", message: READONLY_MESSAGE });
}

function clearFeedback() {
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = null;
  toast = null;
  loadingRequests.clear();
  notify();
}

module.exports = {
  getSnapshot,
  subscribe,
  showLoading,
  updateLoading,
  hideLoading,
  showToast,
  showReadonlyToast,
  hideToast,
  clearFeedback,
};

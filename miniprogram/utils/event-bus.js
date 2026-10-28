// 轻量事件总线：微信小程序内各页面/组件解耦通知。
// 不依赖 DOM 事件，不引入外部库。仅支持同 App 生命周期内的 emit/on/off。

const listeners = new Map();

function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
}

function off(event, handler) {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(handler);
  if (!set.size) listeners.delete(event);
}

function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of Array.from(set)) {
    try {
      handler(payload);
    } catch (error) {
      console.warn(`[event-bus] handler for "${event}" failed`, error);
    }
  }
}

function clearAll() {
  listeners.clear();
}

module.exports = { on, off, emit, clearAll };

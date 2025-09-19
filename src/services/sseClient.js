const BASE = import.meta.env?.VITE_API_URL || "http://localhost:3000";

export function subscribeSSE(onMessage) {
  const ev = new EventSource(`${BASE}/events`, { withCredentials: false });

  ev.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  ev.addEventListener("ping", () => {}); // só pra manter

  return () => ev.close();
}

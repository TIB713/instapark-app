import { getItem } from "./secure";

const connections = {};
const retryTimers = {};
const retryCounts = {};

export const connectWS = async (channel, onMessage) => {
  const token = await getItem("auth_token");
  const wsUrl = token
    ? `${process.env.EXPO_PUBLIC_WS_URL}/ws${channel}?token=${token}`
    : `${process.env.EXPO_PUBLIC_WS_URL}/ws${channel}`;
  const connect = () => {
    const ws = new WebSocket(wsUrl);
    connections[channel] = ws;

    ws.onopen = () => {
      retryCounts[channel] = 0;
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      const count = retryCounts[channel] || 0;
      const delay = Math.min(1000 * Math.pow(2, count), 30000);
      retryCounts[channel] = count + 1;
      retryTimers[channel] = setTimeout(connect, delay);
    };
  };
  connect();
};

export const disconnectWS = (channel) => {
  clearTimeout(retryTimers[channel]);
  connections[channel]?.close();
  delete connections[channel];
  delete retryCounts[channel];
};

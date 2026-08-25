import { getItem } from "./secure";

const connections = {};
const retryTimers = {};
const retryCounts = {};
const generations = {};

export const connectWS = async (channel, onMessage, onOpen) => {
  const token = await getItem("auth_token");
  const wsUrl = token
    ? `${process.env.EXPO_PUBLIC_WS_URL}/ws${channel}?token=${token}`
    : `${process.env.EXPO_PUBLIC_WS_URL}/ws${channel}`;
  
  generations[channel] = (generations[channel] || 0) + 1;
  const myGeneration = generations[channel];

  const connect = () => {
    if (generations[channel] !== myGeneration) return; // superseded, stop
    const ws = new WebSocket(wsUrl);
    console.log(`[DUP_DEBUG] new WS connection opened for channel ${channel}, generation ${myGeneration}`);
    connections[channel] = ws;

    ws.onopen = () => {
      retryCounts[channel] = 0;
      if (onOpen) onOpen();
    };
    ws.onmessage = (e) => {
      if (generations[channel] !== myGeneration) return;
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      if (generations[channel] !== myGeneration) return; // don't reconnect a superseded generation
      const count = retryCounts[channel] || 0;
      const delay = Math.min(1000 * Math.pow(2, count), 30000);
      retryCounts[channel] = count + 1;
      retryTimers[channel] = setTimeout(connect, delay);
    };
  };
  connect();
};

export const disconnectWS = (channel) => {
  console.log(`[DUP_DEBUG] disconnectWS called for channel ${channel}`);
  generations[channel] = (generations[channel] || 0) + 1; // invalidate any pending reconnects
  clearTimeout(retryTimers[channel]);
  connections[channel]?.close();
  delete connections[channel];
  delete retryCounts[channel];
  delete retryTimers[channel];
};

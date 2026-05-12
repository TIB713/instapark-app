const connections = {};

export const connectWS = (path, onMessage) => {
  const url = `${process.env.EXPO_PUBLIC_WS_URL}/ws${path}`;
  if (connections[path]) {
    try {
      connections[path].close();
    } catch {}
    delete connections[path];
  }
  try {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
    ws.onerror = () => {};
    connections[path] = ws;
    return ws;
  } catch {
    return null;
  }
};

export const disconnectWS = (path) => {
  if (connections[path]) {
    try {
      connections[path].close();
    } catch {}
    delete connections[path];
  }
};

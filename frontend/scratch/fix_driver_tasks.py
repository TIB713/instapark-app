import re

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useDriverTasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 3.1: Extract websocket setup
# Find the first connectWS block
ws_setup = """    connectWS(`/event/${currentEventId}`, (msg) => {
      if (msg.type === "car_update") fetchMyCarsRef.current();
      if (msg.type === "slot_update" && fetchSlots) fetchSlots(msg.data);
    });
    connectWS(`/retrievals/${currentEventId}`, (msg) => {
      if (msg.type === "retrieval_update") {
        if (msg.data) {
          const carId = String((msg.data.car || msg.data).id);
          const status = (msg.data.car || msg.data).status;
          if (status !== "RETRIEVAL_REQUESTED") {
            clearStaleRequest(carId);
          }
          if (!["RETRIEVAL_REQUESTED", "BEING_FETCHED", "ARRIVED_AT_GATE", "AWAITING_REPARK"].includes(status)) {
            setRetrievals(prev => prev.filter(c => String(c.id) !== carId));
          } else {
            setRetrievals(prev => prev.map(c => String(c.id) === carId ? { ...c, ...(msg.data.car || msg.data) } : c));
          }
          maybeQueueNewRequestRef.current(msg.data);
        }
        fetchRetrievalsRef.current();
      }
    }, () => {
      fetchRetrievalsRef.current();
    });"""

# Because of DUP_DEBUG, we can use regex to replace it.
content = re.sub(
    r'connectWS\(`/event/\${currentEventId}`.*?fetchRetrievalsRef\.current\(\);\s*\}\);\s*\}\);',
    r'setupChannels();',
    content,
    flags=re.DOTALL
)

setup_func = """    const setupChannels = () => {
      connectWS(`/event/${currentEventId}`, (msg) => {
        if (msg.type === "car_update") fetchMyCarsRef.current();
        if (msg.type === "slot_update" && fetchSlots) fetchSlots(msg.data);
      });
      connectWS(`/retrievals/${currentEventId}`, (msg) => {
        if (msg.type === "retrieval_update") {
          if (msg.data) {
            const carId = String((msg.data.car || msg.data).id);
            const status = (msg.data.car || msg.data).status;
            if (status !== "RETRIEVAL_REQUESTED") {
              clearStaleRequest(carId);
            }
            if (!["RETRIEVAL_REQUESTED", "BEING_FETCHED", "ARRIVED_AT_GATE", "AWAITING_REPARK"].includes(status)) {
              setRetrievals(prev => prev.filter(c => String(c.id) !== carId));
            } else {
              setRetrievals(prev => prev.map(c => String(c.id) === carId ? { ...c, ...(msg.data.car || msg.data) } : c));
            }
            maybeQueueNewRequestRef.current(msg.data);
          }
          fetchRetrievalsRef.current();
        }
      }, () => {
        fetchRetrievalsRef.current();
      });
    };

    setupChannels();"""

# Inject setupChannels definition right before the first setupChannels();
content = content.replace("setupChannels();", setup_func, 1)

# Task 3.2: In fetchRetrievals, use maybeQueueNewRequestRef.current
content = content.replace("fetchedCars.forEach((car) => maybeQueueNewRequest(car));", "fetchedCars.forEach((car) => maybeQueueNewRequestRef.current(car));")

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useDriverTasks.js', 'w', encoding='utf-8') as f:
    f.write(content)

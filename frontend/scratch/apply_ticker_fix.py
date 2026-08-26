import os
import re

hook_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useDriverTasks.js"
ctx_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\context\DriverTasksContext.jsx"
idx_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\index.jsx"

def modify_hook():
    with open(hook_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove `const [nowTick, setNowTick] = useState(Date.now());`
    content = re.sub(r'\s*const \[nowTick, setNowTick\] = useState\(Date\.now\(\)\);\n', '\n', content)
    
    # Remove `setNowTick(now);`
    content = re.sub(r'\s*setNowTick\(now\);\n', '\n', content)

    # Remove `nowTick,` in return
    content = re.sub(r'\s*nowTick,\n', '\n', content)

    with open(hook_path, "w", encoding="utf-8") as f:
        f.write(content)


def modify_context():
    content = """import React, { createContext, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIncomingRequests } from '../hooks/useIncomingRequests';
import { useSOS } from '../hooks/useSOS';
import { useDriverTasks } from '../hooks/useDriverTasks';
import { useParkFlow } from '../hooks/useParkFlow';

const DriverTasksContext = createContext(null);

export function DriverTasksProvider({ children }) {
  const incomingRequests = useIncomingRequests();
  const sosHook = useSOS();
  
  const fetchSlotsRef = useRef(null);
  
  const fetchSlotsWrapper = useCallback((slotData) => {
    if (fetchSlotsRef.current) {
      fetchSlotsRef.current(slotData);
    }
  }, []);

  const driverTasks = useDriverTasks(
    incomingRequests.seenRequestIdsRef,
    incomingRequests.dismissIncomingRequest,
    incomingRequests.maybeQueueNewRequest,
    incomingRequests.hasSeededSeenRef,
    incomingRequests.clearStaleRequest,
    incomingRequests.reconcileWithServer,
    fetchSlotsWrapper,
    incomingRequests.requestSoundRef
  );

  const parkFlowHook = useParkFlow(
    driverTasks.retrievals,
    driverTasks.fetchMyCarsRef.current,
    driverTasks.fetchRetrievalsRef.current,
    driverTasks.refreshPending
  );

  // Sync fetchSlots from parkFlow to the ref
  useEffect(() => {
    fetchSlotsRef.current = parkFlowHook.fetchSlots;
  }, [parkFlowHook.fetchSlots]);

  const { state: sosState, ...sosActions } = sosHook;
  const { state: parkState, ...parkActions } = parkFlowHook;

  const value = useMemo(() => ({
    ...incomingRequests,
    sosState,
    ...sosActions,
    ...driverTasks,
    parkState,
    ...parkActions,
  }), [incomingRequests, sosState, sosActions, driverTasks, parkState, parkActions]);

  return (
    <DriverTasksContext.Provider value={value}>
      {children}
    </DriverTasksContext.Provider>
  );
}

export function useDriverTasksContext() {
  const ctx = useContext(DriverTasksContext);
  if (!ctx) {
    throw new Error('useDriverTasksContext must be used within DriverTasksProvider');
  }
  return ctx;
}
"""
    with open(ctx_path, "w", encoding="utf-8") as f:
        f.write(content)


def modify_index():
    with open(idx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove `, useDriverTasksTicker`
    content = content.replace("import { useDriverTasksContext, useDriverTasksTicker } from \"../../../context/DriverTasksContext\";", "import { useDriverTasksContext } from \"../../../context/DriverTasksContext\";")

    # Replace `const nowTick = useDriverTasksTicker();` with useState/useEffect block
    old_ticker = "const nowTick = useDriverTasksTicker();"
    new_ticker = """const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);"""

    content = content.replace(old_ticker, new_ticker)

    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(content)


if __name__ == "__main__":
    modify_hook()
    modify_context()
    modify_index()
    print("Done")

import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';
import { useIncomingRequests } from '../hooks/useIncomingRequests';
import { useSOS } from '../hooks/useSOS';
import { useDriverTasks } from '../hooks/useDriverTasks';
import { useParkFlow } from '../hooks/useParkFlow';

const DriverTasksContext = createContext(null);

export function DriverTasksProvider({ children }) {
  const incomingRequests = useIncomingRequests();
  const sosHook = useSOS();
  
  const fetchSlotsRef = useRef(null);
  
  const fetchSlotsWrapper = useCallback(() => {
    if (fetchSlotsRef.current) {
      fetchSlotsRef.current();
    }
  }, []);

  const driverTasks = useDriverTasks(
    incomingRequests.seenRequestIdsRef,
    incomingRequests.dismissIncomingRequest,
    incomingRequests.maybeQueueNewRequest,
    incomingRequests.hasSeededSeenRef,
    incomingRequests.setRequestQueue,
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

  const value = {
    ...incomingRequests,
    sosState,
    ...sosActions,
    ...driverTasks,
    parkState,
    ...parkActions,
  };

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

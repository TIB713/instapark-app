import React, { createContext, useContext, useEffect } from 'react';
import { useSupervisorEvents } from '../hooks/useSupervisorEvents';
import { useEventSOS } from '../hooks/useEventSOS';
import { connectWS, disconnectWS } from '../lib/websocket';

const SupervisorContext = createContext(null);

export function SupervisorProvider({ children }) {
  const supervisorEvents = useSupervisorEvents();
  
  // Fetch events periodically so the provider tracks the active event
  // without relying on screens to call fetchAll themselves.
  useEffect(() => {
    supervisorEvents.fetchAll();
    const interval = setInterval(() => {
      supervisorEvents.fetchAll();
    }, 20000);
    return () => clearInterval(interval);
  }, [supervisorEvents.fetchAll]);

  const activeEvent = supervisorEvents.events?.find(e => e.status === 'active');
  const activeEventId = activeEvent?.id;

  const sosState = useEventSOS(activeEventId);

  useEffect(() => {
    if (!activeEventId) return;

    connectWS(`/sos/${activeEventId}`, (msg) => {
      if (msg.type === "sos_alert" || msg.type === "sos_resolved") {
        sosState.fetchSOSAlerts();
      }
    }, () => {
      // onOpen callback
      sosState.fetchSOSAlerts();
    });

    return () => {
      disconnectWS(`/sos/${activeEventId}`);
    };
  }, [activeEventId, sosState.fetchSOSAlerts]);

  // useEmployeeManagement, useEventCars, useEventIncidents, useEventFeedback 
  // are NOT composed here because they are strictly screen-local.
  
  const value = {
    ...supervisorEvents,
    sos: sosState,
  };

  return (
    <SupervisorContext.Provider value={value}>
      {children}
    </SupervisorContext.Provider>
  );
}

export function useSupervisorContext() {
  const ctx = useContext(SupervisorContext);
  if (!ctx) {
    throw new Error('useSupervisorContext must be used within SupervisorProvider');
  }
  return ctx;
}

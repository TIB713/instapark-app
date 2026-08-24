import React, { createContext, useContext } from 'react';
import { useSupervisorEvents } from '../hooks/useSupervisorEvents';

const SupervisorContext = createContext(null);

export function SupervisorProvider({ children }) {
  const supervisorEvents = useSupervisorEvents();

  // useEmployeeManagement, useEventCars, useEventIncidents, useEventSOS, useEventFeedback 
  // are NOT composed here because they are strictly screen-local.
  // useEvent* hooks depend on a specific eventId which is only known at the event-detail screen level.
  // useEmployeeManagement is strictly for the manage-employees screen.
  
  const value = {
    ...supervisorEvents,
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

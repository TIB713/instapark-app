import os
import re

ctx_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\context\DriverTasksContext.jsx"
idx_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\index.jsx"

def modify_context():
    with open(ctx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add useMemo to imports if not there. 
    # Actually, the file has: import React, { createContext, useContext, useRef, useEffect, useCallback } from 'react';
    if "useMemo" not in content:
        content = content.replace("useCallback } from 'react';", "useCallback, useMemo } from 'react';")

    # 2. Add DriverTasksTickerContext
    ctx_def = "const DriverTasksContext = createContext(null);"
    if "DriverTasksTickerContext" not in content:
        content = content.replace(ctx_def, ctx_def + "\nconst DriverTasksTickerContext = createContext(null);")

    # 3. Replace value creation
    val_old = """  const { state: sosState, ...sosActions } = sosHook;
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
  );"""

    val_new = """  const { state: sosState, ...sosActions } = sosHook;
  const { state: parkState, ...parkActions } = parkFlowHook;

  const { nowTick, ...driverTasksRest } = driverTasks;

  const value = useMemo(() => ({
    ...incomingRequests,
    sosState,
    ...sosActions,
    ...driverTasksRest,
    parkState,
    ...parkActions,
  }), [incomingRequests, sosState, sosActions, driverTasksRest, parkState, parkActions]);

  return (
    <DriverTasksContext.Provider value={value}>
      <DriverTasksTickerContext.Provider value={nowTick}>
        {children}
      </DriverTasksTickerContext.Provider>
    </DriverTasksContext.Provider>
  );"""
    
    if val_old in content:
        content = content.replace(val_old, val_new)

    # 4. Add useDriverTasksTicker hook at the end
    ticker_hook = """
export function useDriverTasksTicker() {
  const ctx = useContext(DriverTasksTickerContext);
  if (ctx === null) {
    throw new Error('useDriverTasksTicker must be used within DriverTasksProvider');
  }
  return ctx;
}
"""
    if "useDriverTasksTicker" not in content:
        content += ticker_hook

    with open(ctx_path, "w", encoding="utf-8") as f:
        f.write(content)


def modify_index():
    with open(idx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update imports
    imp_old = "import { useDriverTasksContext } from '../../../context/DriverTasksContext';"
    imp_new = "import { useDriverTasksContext, useDriverTasksTicker } from '../../../context/DriverTasksContext';"
    if imp_old in content:
        content = content.replace(imp_old, imp_new)

    # 2. Extract nowTick differently
    # The file currently has something like:
    #   const {
    #     // ...
    #     nowTick,
    #     // ...
    #   } = useDriverTasksContext();
    # Let's remove nowTick from there and add it separately.
    
    # We can just remove "nowTick," from the text.
    content = re.sub(r'^\s*nowTick,?\s*$', '', content, flags=re.MULTILINE)
    
    # And add const nowTick = useDriverTasksTicker(); right after useDriverTasksContext()
    ctx_call_old = "} = useDriverTasksContext();"
    ctx_call_new = "} = useDriverTasksContext();\n  const nowTick = useDriverTasksTicker();"
    
    # Make sure we don't duplicate
    if "useDriverTasksTicker()" not in content:
        content = content.replace(ctx_call_old, ctx_call_new)

    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    modify_context()
    modify_index()
    print("Done")

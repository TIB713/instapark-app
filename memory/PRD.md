# InstaPark Mobile App — PRD

## Product
React Native (Expo SDK 54) mobile app for the InstaPark valet parking management system. Connects to the existing live FastAPI backend at https://instapark.docusafe.ai/api/v1. Built with NativeWind, Zustand, Expo Router (file-based routing), and Axios.

## Roles
- **Admin** (email + password): manages events, drivers, views stats.
- **Driver** (employee_id + 4-digit PIN): checks vehicles in/out, parks them, hands off to guests.

## Key Flows

### Admin
1. Login → Dashboard (greeting, stat cards, active/past events)
2. Create / Edit Event with date, time, venue, zones, gates, max cars
3. Event Detail: Cars tab (search + status filter + detail modal with photos & QR), Drivers tab (assign/unassign), Stats tab
4. All Events (filter by all/active/closed)
5. Manage Drivers (add driver with auto-generated employee_id, view per-driver stats)
6. Driver Stats: lifetime & filtered performance, event history, edit driver
7. QR Display (with Share)

### Driver
1. Login → Home (only events assigned to them)
2. Tasks screen: My Cars tab (Checked In → Mark as Parked via Zone/Slot picker; Parked status), Retrievals tab (Pickup → Handover with mandatory camera photo)
3. Check In Vehicle: plate (uppercase), color, make, notes, entry gate, 1–5 camera photos → creates car + uploads photos → navigates to QR display
4. QR Display for guest scan
5. Offline support: handover photos queued in SQLite, auto-synced on reconnect

## Real-Time Updates
- WebSockets at `wss://instapark.docusafe.ai/api/v1/ws/event/{id}`, `/ws/car/{id}`, `/ws/retrievals/{id}`
- Auto-refresh on `car_update`, `slot_update`, `retrieval_update` messages

## Persistence
- JWT in `expo-secure-store` (`auth_token`)
- Driver session in AsyncStorage (`driver_session`, `current_event_id`)
- Camera-restart safety: drafts saved to AsyncStorage before launching camera

## Stack
<!-- expo-router, nativewind, zustand, axios, expo-secure-store, @react-native-async-storage/async-storage, @react-native-community/netinfo, expo-image-picker, expo-file-system, expo-sqlite, react-native-qrcode-svg, react-native-svg, date-fns, @react-native-community/datetimepicker -->

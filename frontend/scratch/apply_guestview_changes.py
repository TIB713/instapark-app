import os
filepath = r"d:\Admin\Desktop\InstaPark-Combined\instapark\frontend\src\pages\guest\GuestView.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: State
state_target = """  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleMinutes, setScheduleMinutes] = useState(null);
  const [scheduling, setScheduling] = useState(false);"""

state_repl = """  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleMinutes, setScheduleMinutes] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [showRetrievalOptions, setShowRetrievalOptions] = useState(false);
  const [selfPickupOtp, setSelfPickupOtp] = useState(null);
  const [requestingSelfPickup, setRequestingSelfPickup] = useState(false);"""

if state_target in content:
    content = content.replace(state_target, state_repl)
else:
    print("State target not found!")

# Chunk 2: handler
handler_target = """  const handleRequestRetrieval = async () => {
    if (!car) return;
    setRequesting(true);
    try {
      const { data } = await publicApi.patch(`/cars/${car.id}/request-retrieval?retrieval_token=${car.retrieval_token}`);
      setCar(data);
    } catch { } finally { setRequesting(false); }
  };"""

handler_repl = """  const handleRequestRetrieval = async () => {
    if (!car) return;
    setRequesting(true);
    try {
      const { data } = await publicApi.patch(`/cars/${car.id}/request-retrieval?retrieval_token=${car.retrieval_token}`);
      setCar(data);
    } catch { } finally { setRequesting(false); }
  };

  const handleSelfPickupRequest = async () => {
    if (!car) return;
    setRequestingSelfPickup(true);
    try {
      const { data } = await publicApi.patch(
        `/cars/${car.id}/self-pickup-request?retrieval_token=${car.retrieval_token}`
      );
      setSelfPickupOtp(data.otp);
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not request self-pickup. Please try again.");
    } finally {
      setRequestingSelfPickup(false);
    }
  };"""

if handler_target in content:
    content = content.replace(handler_target, handler_repl)
else:
    print("Handler target not found!")

# Chunk 3: Render logic
render_target = """                {/* Screen 1: Two Buttons */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white">
                  <div className="w-16 h-16 bg-white/20 rounded-full mx-auto flex items-center justify-center backdrop-blur">
                    <CheckCircle2 className="w-9 h-9 text-white" />
                  </div>
                  <h2 className="font-heading text-xl font-bold mt-4">Your car is safely parked</h2>
                  {car.zone && <p className="text-white/90 text-sm mt-1">Zone {car.zone} · Slot {car.slot}</p>}
                  {car.no_show_count > 0 && (
                    <p className="text-white/90 text-xs mt-2 bg-white/15 rounded-xl px-3 py-2 inline-block">
                      Your car was sent back to parking because you didn't reach the gate in time. Please request it again below.
                    </p>
                  )}
                </div>
                <div className="p-6 flex flex-col gap-3">
                  {car?.gps_lat != null && car?.gps_lng != null && (
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${car.gps_lat},${car.gps_lng}`, "_blank")}
                      className="w-full rounded-2xl py-3.5 text-sm font-semibold border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      📍 See Where My Car Is Parked
                    </button>
                  )}
                  {car?.can_request_retrieval && (
                    <button
                      onClick={handleRequestRetrieval}
                      disabled={requesting}
                      data-testid="request-car-btn"
                      className="w-full btn-primary-navy rounded-2xl py-4 text-lg font-semibold disabled:opacity-70"
                    >
                      {requesting ? "Requesting…" : "🚗 Retrieve My Car Now"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowSchedulePicker(true)}
                    className="w-full rounded-2xl py-3.5 text-sm font-semibold border-2 border-[#1A3C6E] text-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white transition-all"
                  >
                    ⏰ Schedule for Later
                  </button>
                  {showSchedulePicker && (
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          How soon are you leaving?
                        </p>
                        <button
                          onClick={() => { setShowSchedulePicker(false); setScheduleMinutes(null); }}
                          className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => scheduleRetrieval(15)}
                          disabled={scheduling}
                          className="rounded-xl py-3.5 text-sm font-bold border-2 border-[#1A3C6E] text-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white transition disabled:opacity-50"
                        >
                          {scheduling && scheduleMinutes === 15 ? "Scheduling…" : "15 min"}
                        </button>
                        <button
                          onClick={() => scheduleRetrieval(30)}
                          disabled={scheduling}
                          className="rounded-xl py-3.5 text-sm font-bold bg-[#1A3C6E] text-white hover:bg-[#0F2044] transition disabled:opacity-50"
                        >
                          {scheduling && scheduleMinutes === 30 ? "Scheduling…" : "30 min"}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Your car will be ready when you walk out 🚗
                      </p>
                    </div>
                  )}
                  <p className="text-center text-xs text-gray-400">
                    Request now or schedule for later
                  </p>
                </div>"""

render_repl = """                {/* Screen 1 / 2 header */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white relative">
                  {showRetrievalOptions && (
                    <button 
                      onClick={() => {
                        setShowRetrievalOptions(false);
                        setShowSchedulePicker(false);
                        setScheduleMinutes(null);
                        setSelfPickupOtp(null);
                      }}
                      className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center bg-white/20 rounded-full backdrop-blur hover:bg-white/30 transition-all"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                  )}
                  <div className="w-16 h-16 bg-white/20 rounded-full mx-auto flex items-center justify-center backdrop-blur">
                    <CheckCircle2 className="w-9 h-9 text-white" />
                  </div>
                  <h2 className="font-heading text-xl font-bold mt-4">Your car is safely parked</h2>
                  {car.zone && <p className="text-white/90 text-sm mt-1">Zone {car.zone} · Slot {car.slot}</p>}
                  {car.no_show_count > 0 && (
                    <p className="text-white/90 text-xs mt-2 bg-white/15 rounded-xl px-3 py-2 inline-block">
                      Your car was sent back to parking because you didn't reach the gate in time. Please request it again below.
                    </p>
                  )}
                </div>
                
                {!showRetrievalOptions ? (
                  <div className="p-6 flex flex-col gap-3">
                    {car?.gps_lat != null && car?.gps_lng != null && (
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${car.gps_lat},${car.gps_lng}`, "_blank")}
                        className="w-full rounded-2xl py-3.5 text-sm font-semibold border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        📍 See Where My Car Is Parked
                      </button>
                    )}
                    <button
                      onClick={() => setShowRetrievalOptions(true)}
                      className="w-full btn-primary-navy rounded-2xl py-4 text-lg font-semibold"
                    >
                      Retrieve My Car
                    </button>
                  </div>
                ) : (
                  <div className="p-6 flex flex-col gap-3">
                    {car?.can_request_retrieval && (
                      <button
                        onClick={handleRequestRetrieval}
                        disabled={requesting}
                        data-testid="request-car-btn"
                        className="w-full btn-primary-navy rounded-2xl py-4 text-lg font-semibold disabled:opacity-70"
                      >
                        {requesting ? "Requesting…" : "🚗 Send Retrieval Now"}
                      </button>
                    )}
                    <button
                      onClick={() => setShowSchedulePicker(true)}
                      className="w-full rounded-2xl py-3.5 text-sm font-semibold border-2 border-[#1A3C6E] text-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white transition-all"
                    >
                      ⏰ Schedule Retrieval
                    </button>
                    {showSchedulePicker && (
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            How soon are you leaving?
                          </p>
                          <button
                            onClick={() => { setShowSchedulePicker(false); setScheduleMinutes(null); }}
                            className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => scheduleRetrieval(15)}
                            disabled={scheduling}
                            className="rounded-xl py-3.5 text-sm font-bold border-2 border-[#1A3C6E] text-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white transition disabled:opacity-50"
                          >
                            {scheduling && scheduleMinutes === 15 ? "Scheduling…" : "15 min"}
                          </button>
                          <button
                            onClick={() => scheduleRetrieval(30)}
                            disabled={scheduling}
                            className="rounded-xl py-3.5 text-sm font-bold bg-[#1A3C6E] text-white hover:bg-[#0F2044] transition disabled:opacity-50"
                          >
                            {scheduling && scheduleMinutes === 30 ? "Scheduling…" : "30 min"}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          Your car will be ready when you walk out 🚗
                        </p>
                      </div>
                    )}
                    <button
                      onClick={handleSelfPickupRequest}
                      disabled={requestingSelfPickup}
                      className="w-full rounded-2xl py-3.5 text-sm font-semibold border-2 border-[#1A3C6E] text-[#1A3C6E] hover:bg-[#1A3C6E] hover:text-white transition-all disabled:opacity-70"
                    >
                      🙋 Self Pickup
                    </button>
                    {selfPickupOtp && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center mt-2">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Show this code at the valet desk</p>
                        <p className="text-4xl font-extrabold text-[#0F2044] mt-2 tracking-widest">{selfPickupOtp}</p>
                        <p className="text-xs text-gray-400 mt-2">A valet supervisor has been notified you're picking up your own car.</p>
                      </div>
                    )}
                  </div>
                )}"""

if render_target in content:
    content = content.replace(render_target, render_repl)
else:
    print("Render target not found!")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("GuestView.jsx updated")

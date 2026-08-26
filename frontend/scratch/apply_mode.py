import os
import re

base_dir = r"d:\Admin\Desktop\InstaPark-Combined"
checkin_path = os.path.join(base_dir, r"instapark-app\frontend\app\(driver)\(tabs)\checkin.jsx")
scan_path = os.path.join(base_dir, r"instapark-app\frontend\app\(supervisor)\(tabs)\scan.jsx")

def modify_checkin():
    with open(checkin_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add state variables
    state_anchor = r'const \[qrCardId, setQrCardId\] = useState\(""\);'
    state_injection = """  const [qrCardId, setQrCardId] = useState("");
  const [checkinMode, setCheckinMode] = useState(null);
  const [codeInput, setCodeInput] = useState("");"""
    content = content.replace(state_anchor, state_injection)

    # Cancel scan reset
    cancel_anchor = r'setNextPhotoLabel\(null\);\n  };'
    cancel_injection = """setNextPhotoLabel(null);
    setCheckinMode(null);
    setCodeInput("");
  };"""
    content = content.replace(cancel_anchor, cancel_injection)

    # Add handleCodeSubmit before cancelScan
    handle_code_submit = """
  const handleCodeSubmit = async () => {
    if (!codeInput || codeInput.length !== 4) {
      confirmDialog.info("Invalid Code", "Please enter a 4-digit code.");
      return;
    }
    setScanLoading(true);
    try {
      const { data: card } = await api.get(`/qr-cards/lookup-by-code/${codeInput}?event_id=${currentEventId}&include_bound=true`);
      if (card.status && card.status !== "empty") {
        setAlreadyCheckedIn(card);
        setScanLoading(false);
        return;
      }
      setQrToken(card.qr_token);
      setKeyTagNumber(card.key_tag_number);
      setQrCardId(card.id);
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify code";
      confirmDialog.confirm("Invalid Code", msg, () => { setCodeInput(""); });
    } finally {
      setScanLoading(false);
    }
  };

  const cancelScan"""
    content = content.replace("const cancelScan", handle_code_submit)

    # Replace the JSX render
    jsx_target = """      {!qrToken ? (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {(!permission || !permission.granted) ? (
            <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
              <Ionicons name="camera-outline" size={64} color="#fff" />
              <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginTop: rp(16), textAlign: "center" }}>
                Camera Permission Required
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(8), marginBottom: rp(24) }}>
                Camera access is needed to scan key-tag QR cards.
              </Text>
              <TouchableOpacity onPress={requestPermission}
                style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32) }}>
                <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>GRANT PERMISSION</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={scanComplete ? undefined : handleScan}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            >
              <View style={styles.overlay}>
                <View style={styles.topOverlay} />
                <View style={{ flexDirection: "row" }}>
                  <View style={styles.sideOverlay} />
                  <View style={styles.scanBox}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                    <View style={styles.laserLine} />
                  </View>
                  <View style={styles.sideOverlay} />
                </View>
                <View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight }]}>
                  {scanLoading ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(24) }}>
                      Point camera at the key-tag QR card
                    </Text>
                  )}
                  {scanComplete && !scanLoading && (
                    <TouchableOpacity
                      onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                      style={{ marginTop: rp(16), backgroundColor: theme.colors.success, borderRadius: rp(14), paddingVertical: rp(12), paddingHorizontal: rp(32) }}>
                      <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </CameraView>
          )}
        </View>
      ) : ("""
    
    jsx_replacement = """      {!qrToken ? (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {checkinMode === null ? (
            <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
              <TouchableOpacity onPress={() => setCheckinMode("scan")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), marginBottom: rp(16), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
                <Ionicons name="qr-code-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Scan QR Card</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCheckinMode("code")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
                <Ionicons name="keypad-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
                <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Enter Code</Text>
              </TouchableOpacity>
            </View>
          ) : checkinMode === "scan" ? (
            (!permission || !permission.granted) ? (
              <View style={{ flex: 1, backgroundColor: theme.colors.primary, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
                <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, zIndex: 10 }}>
                  <TouchableOpacity onPress={() => setCheckinMode(null)} style={{ padding: rp(16) }}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                  </TouchableOpacity>
                </SafeAreaView>
                <Ionicons name="camera-outline" size={64} color="#fff" />
                <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginTop: rp(16), textAlign: "center" }}>
                  Camera Permission Required
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: rp(8), marginBottom: rp(24) }}>
                  Camera access is needed to scan key-tag QR cards.
                </Text>
                <TouchableOpacity onPress={requestPermission}
                  style={{ backgroundColor: theme.colors.success, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32) }}>
                  <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>GRANT PERMISSION</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={scanComplete ? undefined : handleScan}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              >
                <View style={styles.overlay}>
                  <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, zIndex: 10 }}>
                    <TouchableOpacity onPress={() => setCheckinMode(null)} style={{ padding: rp(16) }}>
                      <Ionicons name="chevron-back" size={28} color="#fff" />
                    </TouchableOpacity>
                  </SafeAreaView>
                  <View style={styles.topOverlay} />
                  <View style={{ flexDirection: "row" }}>
                    <View style={styles.sideOverlay} />
                    <View style={styles.scanBox}>
                      <View style={[styles.corner, styles.topLeft]} />
                      <View style={[styles.corner, styles.topRight]} />
                      <View style={[styles.corner, styles.bottomLeft]} />
                      <View style={[styles.corner, styles.bottomRight]} />
                      <View style={styles.laserLine} />
                    </View>
                    <View style={styles.sideOverlay} />
                  </View>
                  <View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight }]}>
                    {scanLoading ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(24) }}>
                        Point camera at the key-tag QR card
                      </Text>
                    )}
                    {scanComplete && !scanLoading && (
                      <TouchableOpacity
                        onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                        style={{ marginTop: rp(16), backgroundColor: theme.colors.success, borderRadius: rp(14), paddingVertical: rp(12), paddingHorizontal: rp(32) }}>
                        <Text style={{ color: "#fff", fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </CameraView>
            )
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
              <SafeAreaView edges={["top"]} />
              <View style={{ flexDirection: "row", alignItems: "center", padding: rp(16) }}>
                <TouchableOpacity onPress={() => setCheckinMode(null)} style={{ padding: rp(8), backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginLeft: rp(12) }}>Enter 4-Digit Code</Text>
              </View>
              <View style={{ padding: rp(24), alignItems: "center", flex: 1, justifyContent: "center" }}>
                <TextInput
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder="0000"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={{ fontSize: rs(48), fontWeight: "900", color: "#fff", letterSpacing: rs(8), textAlign: "center", borderBottomWidth: 2, borderBottomColor: theme.colors.accent, paddingBottom: rp(8), marginBottom: rp(24), minWidth: rp(200) }}
                />
                <TouchableOpacity onPress={handleCodeSubmit} style={{ backgroundColor: theme.colors.accent, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32), width: "100%", alignItems: "center" }}>
                  {scanLoading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>VERIFY</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : ("""
    
    if jsx_target in content:
        content = content.replace(jsx_target, jsx_replacement)
    else:
        print("JSX target not found in checkin.jsx")

    with open(checkin_path, "w", encoding="utf-8") as f:
        f.write(content)

def modify_scan():
    with open(scan_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Add state variables
    state_anchor = r'const \[loading, setLoading\] = useState\(false\);'
    state_injection = """  const [loading, setLoading] = useState(false);
  const [checkinMode, setCheckinMode] = useState(null);
  const [codeInput, setCodeInput] = useState("");"""
    content = content.replace(state_anchor, state_injection)

    # Add handleCodeSubmit before handleScan
    handle_code_submit = """
  const handleCodeSubmit = async () => {
    if (!selectedScanEventId) return;
    if (!codeInput || codeInput.length !== 4) {
      confirmDialog.info("Invalid Code", "Please enter a 4-digit code.");
      return;
    }
    setLoading(true);
    try {
      const { data: card } = await api.get(`/qr-cards/lookup-by-code/${codeInput}?event_id=${selectedScanEventId}&include_bound=true`);
      if (card.status && card.status !== "empty") {
        setAlreadyCheckedIn(card);
        setLoading(false);
        return;
      }
      router.replace({
        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
    } catch (err) {
      const msg = err.response?.data?.detail || "Could not verify code";
      confirmDialog.confirm("Invalid Code", msg, () => { setCodeInput(""); });
    } finally {
      setLoading(false);
    }
  };

  const handleScan"""
    content = content.replace("const handleScan", handle_code_submit)

    # Replace the return JSX
    jsx_target = """  return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}> 
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg) }}> 
          <TouchableOpacity onPress={() => cameFromDetail ? router.back() : router.replace("/(supervisor)/(tabs)")} 
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
            <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
          </TouchableOpacity> 
          <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
            Scan Vehicle Key-Tag Card
          </Text> 
        </View> 
      </SafeAreaView> 

      <CameraView 
        style={{ flex: 1 }} 
        facing="back" 
        onBarcodeScanned={scanComplete ? undefined : handleScan} 
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
      > 
        <View style={styles.overlay}> 
          <View style={styles.topOverlay} /> 
          <View style={{ flexDirection: "row" }}> 
            <View style={styles.sideOverlay} /> 
            <View style={styles.scanBox}> 
              <View style={[styles.corner, styles.topLeft]} /> 
              <View style={[styles.corner, styles.topRight]} /> 
              <View style={[styles.corner, styles.bottomLeft]} /> 
              <View style={[styles.corner, styles.bottomRight]} /> 
              {/* Scanner pulse line */}
              <View style={styles.laserLine} />
            </View> 
            <View style={styles.sideOverlay} /> 
          </View> 
          <View style={styles.bottomOverlay}> 
            {loading ? ( 
              <ActivityIndicator color={theme.colors.surface} size="large" /> 
            ) : ( 
              <Text style={{ color: theme.colors.surface, fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(theme.spacing.xxl) }}> 
                Point camera at the key-tag QR card
              </Text> 
            )} 
            {scanComplete && !loading && (
              <TouchableOpacity
                onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                style={{ marginTop: rp(theme.spacing.lg), backgroundColor: theme.colors.accent, borderRadius: rp(14), paddingVertical: rp(theme.spacing.md), paddingHorizontal: rp(theme.spacing.xxxl) }}> 
                <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text> 
              </TouchableOpacity> 
            )} 
          </View> 
        </View> 
      </CameraView> 

      <AlreadyCheckedInModal
        visible={!!alreadyCheckedIn}
        plate={alreadyCheckedIn?.plate}
        carType={alreadyCheckedIn?.car_type}
        onDismiss={() => {
          setAlreadyCheckedIn(null);
          setScanComplete(false);
          scanned.current = false;
          lastScannedValue.current = null;
        }}
      />
    </View> 
  );"""

    jsx_replacement = """  if (checkinMode === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
          <View style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg) }}> 
            <TouchableOpacity onPress={() => cameFromDetail ? router.back() : router.replace("/(supervisor)/(tabs)")} 
              style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
              <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
            </TouchableOpacity> 
            <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
              Check-In Vehicle
            </Text> 
          </View> 
        </SafeAreaView> 
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
          <TouchableOpacity onPress={() => setCheckinMode("scan")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), marginBottom: rp(16), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
            <Ionicons name="qr-code-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Scan QR Card</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCheckinMode("code")} style={{ backgroundColor: theme.colors.surface, borderRadius: rp(16), padding: rp(24), width: "100%", alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
            <Ionicons name="keypad-outline" size={32} color={theme.colors.textPrimary} style={{ marginRight: rp(12) }} />
            <Text style={{ color: theme.colors.textPrimary, fontSize: rs(18), fontWeight: "900" }}>Enter Code</Text>
          </TouchableOpacity>
        </View>
        <AlreadyCheckedInModal
          visible={!!alreadyCheckedIn}
          plate={alreadyCheckedIn?.plate}
          carType={alreadyCheckedIn?.car_type}
          onDismiss={() => {
            setAlreadyCheckedIn(null);
            setScanComplete(false);
            scanned.current = false;
            lastScannedValue.current = null;
          }}
        />
      </View>
    );
  }

  if (checkinMode === "code") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <SafeAreaView edges={["top"]} />
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(16) }}>
          <TouchableOpacity onPress={() => setCheckinMode(null)} style={{ padding: rp(8), backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 99 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: rs(18), fontWeight: "900", marginLeft: rp(12) }}>Enter 4-Digit Code</Text>
        </View>
        <View style={{ padding: rp(24), alignItems: "center", flex: 1, justifyContent: "center" }}>
          <TextInput
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder="0000"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="number-pad"
            maxLength={4}
            style={{ fontSize: rs(48), fontWeight: "900", color: "#fff", letterSpacing: rs(8), textAlign: "center", borderBottomWidth: 2, borderBottomColor: theme.colors.accent, paddingBottom: rp(8), marginBottom: rp(24), minWidth: rp(200) }}
          />
          <TouchableOpacity onPress={handleCodeSubmit} style={{ backgroundColor: theme.colors.accent, borderRadius: rp(16), paddingVertical: rp(14), paddingHorizontal: rp(32), width: "100%", alignItems: "center" }}>
            {loading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>VERIFY</Text>}
          </TouchableOpacity>
        </View>
        <AlreadyCheckedInModal
          visible={!!alreadyCheckedIn}
          plate={alreadyCheckedIn?.plate}
          carType={alreadyCheckedIn?.car_type}
          onDismiss={() => {
            setAlreadyCheckedIn(null);
            setScanComplete(false);
            scanned.current = false;
            lastScannedValue.current = null;
          }}
        />
      </View>
    );
  }

  return ( 
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}> 
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.colors.primary }}> 
        <View style={{ flexDirection: "row", alignItems: "center", padding: rp(theme.spacing.lg) }}> 
          <TouchableOpacity onPress={() => setCheckinMode(null)} 
            style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: rp(99), padding: rp(theme.spacing.sm) }}> 
            <Ionicons name="chevron-back" size={22} color={theme.colors.surface} /> 
          </TouchableOpacity> 
          <Text style={{ color: theme.colors.surface, fontSize: rs(18), fontWeight: "900", marginLeft: rp(theme.spacing.md) }}> 
            Scan Vehicle Key-Tag Card
          </Text> 
        </View> 
      </SafeAreaView> 

      <CameraView 
        style={{ flex: 1 }} 
        facing="back" 
        onBarcodeScanned={scanComplete ? undefined : handleScan} 
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
      > 
        <View style={styles.overlay}> 
          <View style={styles.topOverlay} /> 
          <View style={{ flexDirection: "row" }}> 
            <View style={styles.sideOverlay} /> 
            <View style={styles.scanBox}> 
              <View style={[styles.corner, styles.topLeft]} /> 
              <View style={[styles.corner, styles.topRight]} /> 
              <View style={[styles.corner, styles.bottomLeft]} /> 
              <View style={[styles.corner, styles.bottomRight]} /> 
              {/* Scanner pulse line */}
              <View style={styles.laserLine} />
            </View> 
            <View style={styles.sideOverlay} /> 
          </View> 
          <View style={styles.bottomOverlay}> 
            {loading ? ( 
              <ActivityIndicator color={theme.colors.surface} size="large" /> 
            ) : ( 
              <Text style={{ color: theme.colors.surface, fontWeight: "700", fontSize: rs(14), textAlign: "center", paddingHorizontal: rp(theme.spacing.xxl) }}> 
                Point camera at the key-tag QR card
              </Text> 
            )} 
            {scanComplete && !loading && (
              <TouchableOpacity
                onPress={() => { setScanComplete(false); scanned.current = false; lastScannedValue.current = null; }}
                style={{ marginTop: rp(theme.spacing.lg), backgroundColor: theme.colors.accent, borderRadius: rp(14), paddingVertical: rp(theme.spacing.md), paddingHorizontal: rp(theme.spacing.xxxl) }}> 
                <Text style={{ color: theme.colors.primary, fontWeight: "900", letterSpacing: rs(2) }}>SCAN AGAIN</Text> 
              </TouchableOpacity> 
            )} 
          </View> 
        </View> 
      </CameraView> 

      <AlreadyCheckedInModal
        visible={!!alreadyCheckedIn}
        plate={alreadyCheckedIn?.plate}
        carType={alreadyCheckedIn?.car_type}
        onDismiss={() => {
          setAlreadyCheckedIn(null);
          setScanComplete(false);
          scanned.current = false;
          lastScannedValue.current = null;
        }}
      />
    </View> 
  );"""

    if jsx_target in content:
        content = content.replace(jsx_target, jsx_replacement)
    else:
        print("JSX target not found in scan.jsx")

    with open(scan_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    modify_checkin()
    modify_scan()
    print("Done")

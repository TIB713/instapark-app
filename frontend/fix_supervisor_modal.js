const fs = require('fs');
let content = fs.readFileSync('d:/Admin/Desktop/InstaPark-Combined/instapark-app/frontend/app/(supervisor)/event-detail.jsx', 'utf8');

// Part 1: Incident Car search wrapper and selected tag
const oldCarSearch = `<View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: rp(6) }}>
                    <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                    <TextInput value={incidentCarSearch} onChangeText={setIncidentCarSearch} placeholder="Search plate..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: "#111827", fontWeight: "700" }} />
                  </View>
                  {incidentCarSearch.length > 1 && !incidentCar && (
                    <View style={{ backgroundColor: "#fff", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", marginBottom: rp(12), overflow: "hidden" }}>
                      {cars.filter(c => c.plate.toLowerCase().includes(incidentCarSearch.toLowerCase())).slice(0, 5).map(c => (
                        <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ fontWeight: "900", color: "#111827" }}>{c.plate}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {incidentCar && <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), padding: rp(12), marginBottom: rp(16) }}><Text style={{ color: "#059669", fontWeight: "800" }}>{incidentCar.plate} selected</Text></View>}`;

const newCarSearch = `{!incidentCar && (
                    <>
                      <View style={{ backgroundColor: "#F9FAFB", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", paddingHorizontal: rp(12), marginBottom: rp(6) }}>
                        <Ionicons name="search" size={16} color={ACCENT_COLOR} />
                        <TextInput value={incidentCarSearch} onChangeText={setIncidentCarSearch} placeholder="Search plate..." style={{ flex: 1, paddingVertical: rp(13), paddingLeft: rp(8), color: "#111827", fontWeight: "700" }} />
                      </View>
                      {incidentCarSearch.length > 1 && (
                        <View style={{ backgroundColor: "#fff", borderRadius: rp(14), borderWidth: rp(1), borderColor: "#E5E7EB", marginBottom: rp(12), overflow: "hidden" }}>
                          {cars.filter(c => c.plate.toLowerCase().includes(incidentCarSearch.toLowerCase())).slice(0, 5).map(c => (
                            <TouchableOpacity key={c.id} onPress={() => { setIncidentCar(c); setIncidentCarSearch(c.plate); }} style={{ padding: rp(14), borderBottomWidth: rp(1), borderBottomColor: "#F3F4F6", flexDirection: "row", alignItems: "center" }}>
                              <Text style={{ fontWeight: "900", color: "#111827" }}>{c.plate}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                  {incidentCar && (
                    <View style={{ backgroundColor: "#D1FAE5", borderRadius: rp(12), padding: rp(12), marginBottom: rp(16), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={{ color: "#059669", fontWeight: "800", marginLeft: rp(8) }}>{incidentCar.plate} selected</Text>
                      </View>
                      <TouchableOpacity onPress={() => { setIncidentCar(null); setIncidentCarSearch(""); }}>
                        <Ionicons name="close-circle" size={20} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  )}`;

// Part 2: Incident photo wrapper

// We need to dynamically extract the exact line since it has corrupted characters (checkmark)
const lines = content.split(/\r?\n/);
let photoBtnStartIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? "#059669" : "#E5E7EB"')) {
    photoBtnStartIdx = i;
    break;
  }
}

if (photoBtnStartIdx === -1) {
  console.log("Could not find photo button start");
  process.exit(1);
}

// Extract old photo block (3 lines for button, then conditional remove text)
let photoBlockLines = [];
let i = photoBtnStartIdx;
// capture up to "Remove Photo" closing tag
while (i < lines.length && !lines[i].includes('SUBMIT INCIDENT')) {
  if (lines[i].includes('<TouchableOpacity onPress={submitIncident}')) break;
  photoBlockLines.push(lines[i]);
  i++;
}

const oldPhotoBlock = photoBlockLines.join('\n');
const photoButtonInner1 = photoBlockLines[1]; // <Text style={{ color: incidentPhoto ? "#059669" : "#9CA3AF"...

const newPhotoBlock = `                  <View style={{ position: "relative" }}>
                    <TouchableOpacity onPress={pickIncidentPhoto} style={{ borderWidth: rp(1.5), borderColor: incidentPhoto ? "#059669" : "#E5E7EB", borderStyle: "dashed", borderRadius: rp(14), padding: rp(16), alignItems: "center", marginBottom: rp(20) }}>
${photoButtonInner1}
                    </TouchableOpacity>
                    {incidentPhoto && (
                      <TouchableOpacity onPress={() => setIncidentPhoto(null)} style={{ position: "absolute", top: rp(-6), right: rp(-6), backgroundColor: "rgba(255, 255, 255, 0.8)", borderRadius: rp(99), padding: rp(2) }}>
                        <Ionicons name="close-circle" size={20} color="#059669" />
                      </TouchableOpacity>
                    )}
                  </View>`;

let newContent = content.replace(oldCarSearch.replace(/\r\n/g, '\n'), newCarSearch.replace(/\r\n/g, '\n'));
// Normalizing line endings might be an issue so let's match with a regex or exact replace:
if (newContent === content) {
  // Try CRLF
  newContent = content.replace(oldCarSearch.replace(/\n/g, '\r\n'), newCarSearch);
}

newContent = newContent.replace(oldPhotoBlock, newPhotoBlock);

fs.writeFileSync('d:/Admin/Desktop/InstaPark-Combined/instapark-app/frontend/app/(supervisor)/event-detail.jsx', newContent, 'utf8');
console.log("Applied supervisor modal edits successfully");

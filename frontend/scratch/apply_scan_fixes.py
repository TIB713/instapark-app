import os

scan_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\scan.jsx"

def apply_fixes():
    with open(scan_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. handleCodeSubmit success path
    old_success = """        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
    } catch (err) {"""
    
    new_success = """        pathname: targetScreen,
        params: {
          prefill_qr_token: card.qr_token,
          prefill_key_tag_number: card.key_tag_number,
          prefill_qr_card_id: card.id,
        },
      });
      setCodeInput("");
    } catch (err) {"""
    
    content = content.replace(old_success, new_success)

    # 2.1 imports and tabBarHeight
    old_import = """import AlreadyCheckedInModal from "../../../components/valet/AlreadyCheckedInModal";

export default function ScanQrCard() { 
  const router = useRouter(); """
    
    new_import = """import AlreadyCheckedInModal from "../../../components/valet/AlreadyCheckedInModal";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export default function ScanQrCard() { 
  const router = useRouter(); 
  const tabBarHeight = useBottomTabBarHeight();"""
    
    content = content.replace(old_import, new_import)

    # 2.2 Mode-picker screen
    old_null_view = """<View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(24) }}>
          <TouchableOpacity onPress={() => setCheckinMode("scan")}"""
    
    new_null_view = """<View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: rp(24), paddingBottom: rp(24) + tabBarHeight }}>
          <TouchableOpacity onPress={() => setCheckinMode("scan")}"""
    
    content = content.replace(old_null_view, new_null_view)

    # 2.3 Code-entry screen
    old_code_view = """<View style={{ padding: rp(24), alignItems: "center", flex: 1, justifyContent: "center" }}>
          <TextInput"""
          
    new_code_view = """<View style={{ padding: rp(24), alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: rp(24) + tabBarHeight }}>
          <TextInput"""
          
    content = content.replace(old_code_view, new_code_view)
    
    # 2.4 Camera scan view bottom overlay
    old_camera_overlay = """<View style={styles.bottomOverlay}> 
            {loading ? ("""
            
    new_camera_overlay = """<View style={[styles.bottomOverlay, { paddingBottom: tabBarHeight }]}> 
            {loading ? ("""
            
    content = content.replace(old_camera_overlay, new_camera_overlay)

    with open(scan_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    apply_fixes()
    print("Done")

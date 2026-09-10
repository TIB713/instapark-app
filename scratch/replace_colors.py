import os
import re

files = [
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(supervisor)\(tabs)\event-detail.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\index.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\activity.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\failed-syncs.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\event-detail.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\supervisor-detail.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(admin)\(tabs)\pre-register-qr.jsx",
    r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\components\VenuePicker.jsx",
]

# Map hex to theme token
hex_to_theme = {
    # Grays -> Neutrals
    "#111827": "theme.colors.textPrimary",
    "#1f2937": "theme.colors.textPrimary",
    "#1F2937": "theme.colors.textPrimary",
    "#374151": "theme.colors.textSecondary",
    "#4B5563": "theme.colors.textSecondary",
    "#4b5563": "theme.colors.textSecondary",
    "#6B7280": "theme.colors.textMuted",
    "#6b7280": "theme.colors.textMuted",
    "#9CA3AF": "theme.colors.textMuted",
    "#9ca3af": "theme.colors.textMuted",
    "#D1D5DB": "theme.colors.border",
    "#d1d5db": "theme.colors.border",
    "#E5E7EB": "theme.colors.border",
    "#e5e7eb": "theme.colors.border",
    "#F3F4F6": "theme.colors.surfaceAlt",
    "#f3f4f6": "theme.colors.surfaceAlt",
    "#F9FAFB": "theme.colors.surfaceAlt",
    "#f9fafb": "theme.colors.surfaceAlt",
    "#FFFFFF": "theme.colors.surface",
    "#ffffff": "theme.colors.surface",
    "#FFF": "theme.colors.surface",
    "#fff": "theme.colors.surface",
    "#000000": "theme.colors.textPrimary",
    "#000": "theme.colors.textPrimary",
    
    # Purples -> Primary
    "#3F0163": "theme.colors.primary",
    "#3f0163": "theme.colors.primary",
    "#7C3AED": "theme.colors.primary",
    "#7c3aed": "theme.colors.primary",
    "#8B5CF6": "theme.colors.primary",
    "#8b5cf6": "theme.colors.primary",
    "#6366F1": "theme.colors.primary",
    "#6366f1": "theme.colors.primary",
    "#4F46E5": "theme.colors.primary",
    "#4f46e5": "theme.colors.primary",
    "#0F2044": "theme.colors.primary", # Dark blue/navy used as heading
    "#0f2044": "theme.colors.primary",
    "#EEF2FF": "theme.colors.primaryLight",
    "#eef2ff": "theme.colors.primaryLight",
    "#F5F3FF": "theme.colors.primaryLight",
    "#f5f3ff": "theme.colors.primaryLight",
    "#E0E7FF": "theme.colors.primaryLight",
    "#e0e7ff": "theme.colors.primaryLight",
    
    # Reds -> Danger
    "#DC2626": "theme.colors.danger",
    "#dc2626": "theme.colors.danger",
    "#B91C1C": "theme.colors.danger",
    "#b91c1c": "theme.colors.danger",
    "#EF4444": "theme.colors.danger",
    "#ef4444": "theme.colors.danger",
    "#F43F5E": "theme.colors.danger",
    "#f43f5e": "theme.colors.danger",
    "#FEE2E2": "theme.colors.dangerLight",
    "#fee2e2": "theme.colors.dangerLight",
    "#FBEAEA": "theme.colors.dangerLight",
    "#fbeaea": "theme.colors.dangerLight",
    "#FFE4E6": "theme.colors.dangerLight",
    "#ffe4e6": "theme.colors.dangerLight",
    
    # Yellows/Oranges -> Warning
    "#EAB308": "theme.colors.warning",
    "#eab308": "theme.colors.warning",
    "#F59E0B": "theme.colors.warning",
    "#f59e0b": "theme.colors.warning",
    "#FBBF24": "theme.colors.warning",
    "#fbbf24": "theme.colors.warning",
    "#D97706": "theme.colors.warning",
    "#d97706": "theme.colors.warning",
    "#FEF3C7": "theme.colors.warningLight",
    "#fef3c7": "theme.colors.warningLight",
    "#FEF9C3": "theme.colors.warningLight",
    "#fef9c3": "theme.colors.warningLight",
    
    # Greens -> Success
    "#10B981": "theme.colors.success",
    "#10b981": "theme.colors.success",
    "#059669": "theme.colors.success",
    "#059669": "theme.colors.success",
    "#20A464": "theme.colors.success",
    "#20a464": "theme.colors.success",
    "#D1FAE5": "theme.colors.successLight",
    "#d1fae5": "theme.colors.successLight",
    "#ECFDF5": "theme.colors.successLight",
    "#ecfdf5": "theme.colors.successLight",
    
    # Blues -> Info
    "#0EA5E9": "theme.colors.info",
    "#0ea5e9": "theme.colors.info",
    "#1D4ED8": "theme.colors.info",
    "#1d4ed8": "theme.colors.info",
    "#0891B2": "theme.colors.info",
    "#0891b2": "theme.colors.info",
    "#0284C7": "theme.colors.info",
    "#0284c7": "theme.colors.info",
    "#3B82F6": "theme.colors.info",
    "#3b82f6": "theme.colors.info",
    "#E0F2FE": "theme.colors.infoLight",
    "#e0f2fe": "theme.colors.infoLight",
    "#DBEAFE": "theme.colors.infoLight",
    "#dbeafe": "theme.colors.infoLight",
}

def replace_hex(match):
    full_match = match.group(0)
    quote = match.group(1)
    hex_val = match.group(2)
    
    if hex_val.upper() in [k.upper() for k in hex_to_theme.keys()]:
        # find the exact key or uppercase equivalent
        for k, v in hex_to_theme.items():
            if k.upper() == hex_val.upper():
                return v
    return full_match

pattern = re.compile(r'([\'"])(#[0-9a-fA-F]{3,6})\1')

for filepath in files:
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = pattern.sub(replace_hex, content)
    
    if new_content != content:
        # Check if theme needs to be imported
        if "from '../../utils/theme'" not in new_content and "from '../../../utils/theme'" not in new_content and "from '../utils/theme'" not in new_content:
            # Simple heuristic to add import at top
            if filepath.count('\\') - filepath.find('frontend\\app') > 3:
                 new_content = "import { theme } from '../../../utils/theme';\n" + new_content
            else:
                 new_content = "import { theme } from '../../utils/theme';\n" + new_content
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {os.path.basename(filepath)}")

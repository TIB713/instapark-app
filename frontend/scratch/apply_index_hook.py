import os

idx_path = r"d:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\app\(driver)\(tabs)\index.jsx"

def modify_index():
    with open(idx_path, "r", encoding="utf-8") as f:
        content = f.read()

    ctx_call_old = "const ctx = useDriverTasksContext();"
    ctx_call_new = "const ctx = useDriverTasksContext();\n  const nowTick = useDriverTasksTicker();"
    
    if "const nowTick =" not in content:
        content = content.replace(ctx_call_old, ctx_call_new)

    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    modify_index()
    print("Done")

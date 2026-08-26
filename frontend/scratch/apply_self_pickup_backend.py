import re

filepath = r"d:\Admin\Desktop\InstaPark-Combined\instapark\backend\server.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

target = """    return await _build_guest_view(updated) 


@api_router.patch("/cars/{cid}/cancel-retrieval")"""

replacement = """    return await _build_guest_view(updated) 

@api_router.patch("/cars/{cid}/self-pickup-request")
async def self_pickup_request(cid: str, retrieval_token: Optional[str] = Query(None), user=Depends(get_current_optional)):
    car = await db.cars.find_one({"id": cid}, {"_id": 0})
    if not car:
        raise HTTPException(404, "Car not found")
    if not user:
        if not retrieval_token or car.get("retrieval_token") != retrieval_token:
            raise HTTPException(403, "Invalid or missing token")
    if car.get("status") != "PARKED":
        raise HTTPException(400, f"Self-pickup cannot be requested from status '{car.get('status')}'. Must be PARKED.")

    otp = str(random.randint(100000, 999999))
    await _otp_set(f"self_pickup_{cid}", otp, {"car_id": cid})

    async def _notify_supervisors_self_pickup():
        try:
            sup_tokens = await get_event_supervisor_tokens(car["event_id"])
            await send_expo_push(
                sup_tokens,
                title="🙋 Guest Self-Pickup Request",
                body_text=f"{car.get('plate')} · Zone {car.get('zone','?')} Slot {car.get('slot','?')} — guest wants to pick up their own car.",
                data={"car_id": cid, "event_id": car["event_id"], "screen": "self-pickup"}
            )
            assignments = await db.event_supervisors.find(
                {"event_id": car["event_id"]}, {"_id": 0, "supervisor_id": 1}
            ).to_list(200)
            for a in assignments:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "recipient_role": "supervisor",
                    "recipient_id": a["supervisor_id"],
                    "type": "self_pickup_requested",
                    "title": "Guest Self-Pickup Request",
                    "message": f"Guest wants to self-pickup {car.get('plate')} (Zone {car.get('zone','?')} Slot {car.get('slot','?')}).",
                    "related_id": cid,
                    "is_read": False,
                    "created_at": now_iso()
                })
        except Exception as e:
            logger.warning(f"self-pickup supervisor notify failed for car {cid}: {e}")

    asyncio.create_task(_notify_supervisors_self_pickup())
    return {"otp": otp}


@api_router.patch("/cars/{cid}/cancel-retrieval")"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Backend updated.")
else:
    print("Target not found.")

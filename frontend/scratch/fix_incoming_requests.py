import re

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useIncomingRequests.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 3.3 Add isAlreadyTracked guard
new_func = """
  const isAlreadyTracked = useCallback((carId) => {
    if (seenRequestIdsRef.current.has(carId)) return true;
    if (incomingRequest && String(incomingRequest.id) === carId) return true;
    return false;
  }, [incomingRequest]);

  const maybeQueueNewRequest = useCallback((car) => {
    if (!car) return;

    const carData = car.car || car;
    const carId = carData.id ? String(carData.id) : null;

    if (!carId) return;
    if (carData.status !== "RETRIEVAL_REQUESTED" || carData.retrieval_driver_id) return;

    if (isAlreadyTracked(carId)) return;

    seenRequestIdsRef.current.add(carId);

    setRequestQueue((prev) => {
      if (prev.some((item) => String(item.id) === carId)) return prev;
      return [...prev, carData];
    });
  }, [isAlreadyTracked]);
"""

old_func = """  const maybeQueueNewRequest = useCallback((car) => {
    if (!car) return;

    const carData = car.car || car;
    const carId = carData.id ? String(carData.id) : null;

    if (!carId) return;
    console.log(`[DUP_DEBUG] maybeQueueNewRequest called for car ${carId}, status=${carData.status}, alreadySeen=${seenRequestIdsRef.current.has(carId)}, currentIncoming=${incomingRequest?.id}`);
    if (carData.status !== "RETRIEVAL_REQUESTED" || carData.retrieval_driver_id) return;

    // Block if already in seen set
    if (seenRequestIdsRef.current.has(carId)) return;

    // Block if currently active on screen
    if (incomingRequest && String(incomingRequest.id) === carId) return;

    seenRequestIdsRef.current.add(carId);

    // Deduplicate state queue
    setRequestQueue((prev) => {
      if (prev.some((item) => String(item.id) === carId)) return prev;
      return [...prev, carData];
    });
  }, [incomingRequest]);"""

content = content.replace(old_func, new_func)

# 3.5 Remove DUP_DEBUG from useIncomingRequests
content = re.sub(r'^\s*console\.log\(`\[DUP_DEBUG\].*\n', '', content, flags=re.MULTILINE)

with open(r'd:\Admin\Desktop\InstaPark-Combined\instapark-app\frontend\hooks\useIncomingRequests.js', 'w', encoding='utf-8') as f:
    f.write(content)

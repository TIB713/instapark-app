export function buildQueueRows(cars, drivers) {
  const driverMap = {};
  (drivers || []).forEach(d => { driverMap[d.id] = d.name; });

  const getDriverName = (car) => {
    if (["RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED"].includes(car.status)) {
      return driverMap[car.retrieval_driver_id] || driverMap[car.parked_driver_id] || "—";
    }
    if (car.status === "PARKED") return driverMap[car.parked_driver_id] || "—";
    return driverMap[car.check_in_driver_id] || "—";
  };

  const minutesAgo = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    return Math.floor(diff / 60000);
  };

  const timestampFor = (car) => {
    const status = car.status;
    if (["RETRIEVAL_REQUESTED", "ACCEPTED", "BEING_FETCHED"].includes(status)) return car.accepted_at || car.retrieval_requested_at || car.parked_at;
    if (status === "PARKED") return car.parked_at;
    if (["REGISTERED", "CHECKED_IN"].includes(status)) return car.check_in_time;
    return car.delivered_at;
  };

  return [...(cars || [])]
    .map(car => ({
      ...car,
      driverName: getDriverName(car),
      minutesInStatus: minutesAgo(timestampFor(car)),
      sortTs: timestampFor(car) || "",
    }))
    .sort((a, b) => (b.sortTs || "").localeCompare(a.sortTs || ""));
}

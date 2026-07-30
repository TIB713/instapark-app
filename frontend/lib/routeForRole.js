export function getRouteForRole(role) {
  if (role === "admin" || role === "owner" || role === "superadmin") {
    return "/(admin)/dashboard";
  } else if (role === "supervisor") {
    return "/(supervisor)/dashboard";
  } else if (role === "driver") {
    return "/(driver)";
  }
  return "/";
}

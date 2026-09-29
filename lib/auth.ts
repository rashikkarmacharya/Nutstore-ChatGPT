export function isAuthorized(request: Request): boolean {
  const token = process.env.NUTSTORE_API_TOKEN;
  if (!token) throw new Error("NUTSTORE_API_TOKEN is not configured");
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

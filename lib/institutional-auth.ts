async function configuredAdminKey() {
  const { env } = await import("cloudflare:workers");
  return (env as unknown as { BIS_INSTITUTIONAL_ADMIN_KEY?: string }).BIS_INSTITUTIONAL_ADMIN_KEY?.trim() ?? "";
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function institutionalAdminFailure(request: Request): Promise<Response | null> {
  const configured = await configuredAdminKey();
  if (!configured) {
    return Response.json(
      { error: "Institutional administration is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const provided = request.headers.get("x-bis-admin-key")?.trim() ?? "";
  if (!provided || !constantTimeEqual(provided, configured)) {
    return Response.json(
      { error: "Institutional access denied." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

export function institutionalActor(request: Request) {
  return request.headers.get("x-bis-actor")?.trim().slice(0, 180) || "institutional-admin";
}

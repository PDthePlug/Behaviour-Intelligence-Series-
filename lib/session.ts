const SESSION_COOKIE = "bis_preview_session";

export function requestCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  const found = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function sessionFromRequest(request: Request): string | null {
  return requestCookie(request, SESSION_COOKIE);
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function sessionCookie(id: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

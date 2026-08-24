let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function api<T>(url: string, o?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(o?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(o?.headers as Record<string, string> | undefined) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const r = await fetch('/api' + url, { ...o, headers });
  if (!r.ok) throw Error(await r.text());
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

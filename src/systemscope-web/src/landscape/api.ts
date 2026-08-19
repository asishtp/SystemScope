export async function api<T>(url: string, o?: RequestInit): Promise<T> {
  const r = await fetch('/api' + url, { ...o, headers: { 'Content-Type': 'application/json', ...o?.headers } });
  if (!r.ok) throw Error(await r.text());
  const text = await r.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

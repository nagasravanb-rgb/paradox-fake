export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("paradox_token");
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.code || data?.error?.message || res.statusText);
  return data as T;
}

/** Shared JSON helper for repository API consumers. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
export function asyncGet<T = unknown>(url: string) {
  return request<T>(url);
}
export function asyncPost<T = unknown>(url: string, body: object | FormData) {
  return request<T>(url, {
    method: 'POST',
    headers:
      body instanceof FormData
        ? undefined
        : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
export function asyncPatch<T = unknown>(url: string, body: object | FormData) {
  return request<T>(url, {
    method: 'PATCH',
    headers:
      body instanceof FormData
        ? undefined
        : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

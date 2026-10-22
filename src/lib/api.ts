// 受け口（/api）とのやりとり
export class LoginRequired extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (res.status === 401) throw new LoginRequired();
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || "うまくいきませんでした");
  return body as T;
}

export type Me = { email: string; name: string | null; picture: string | null };
export type Site = { id: string; name: string; kind: string; start_date: string | null; end_date: string | null; photo_count?: number; drawing_count?: number };
export type Photo = { id: string; file_name: string | null; taken_at: string | null; status: string; part: string | null };
export type Drawing = { id: string; file_name: string; stage: string; uploaded_at: string };

export const api = {
  me: () => call<Me>("/api/me"),
  sites: () => call<{ sites: Site[] }>("/api/sites"),
  site: (id: string) => call<{ site: Site; photos: Photo[]; drawings: Drawing[] }>(`/api/sites/${id}`),
  createSite: (data: Partial<Site>) =>
    call<{ id: string }>("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
  uploadPhoto: (siteId: string, form: FormData) => call<{ id: string }>(`/api/sites/${siteId}/photos`, { method: "POST", body: form }),
  uploadDrawing: (siteId: string, form: FormData) => call<{ id: string }>(`/api/sites/${siteId}/drawings`, { method: "POST", body: form }),
  logout: () => call<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

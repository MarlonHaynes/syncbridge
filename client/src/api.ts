import type { SyncEvent, SyncEventListResponse, SyncStatus, SyncDirection, EntityType } from "@syncbridge/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface EventFilters {
  status?: SyncStatus;
  direction?: SyncDirection;
  entityType?: EntityType;
  page?: number;
  pageSize?: number;
}

export function fetchEvents(filters: EventFilters): Promise<SyncEventListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.entityType) params.set("entityType", filters.entityType);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 25));
  return request(`/events?${params.toString()}`);
}

export function fetchEvent(id: string): Promise<SyncEvent> {
  return request(`/events/${id}`);
}

export function replayEvent(id: string): Promise<SyncEvent> {
  return request(`/events/${id}/replay`, { method: "POST" });
}

export function runSalesforcePoll(): Promise<{ scanned: number; eligible: number; created: number; duplicates: number }> {
  return request(`/sync/poll`, { method: "POST" });
}

export interface AdminState {
  useMockSalesforce: boolean;
  useMockNexcore: boolean;
  nexcoreFailureMode: boolean;
}

export function fetchAdminState(): Promise<AdminState> {
  return request(`/admin/state`);
}

export function seedNewOpportunity(): Promise<unknown> {
  return request(`/admin/salesforce/seed-opportunity`, { method: "POST" });
}

export function setNexCoreFailureMode(enabled: boolean): Promise<{ nexcoreFailureMode: boolean }> {
  return request(`/admin/nexcore/fail-mode`, { method: "POST", body: JSON.stringify({ enabled }) });
}

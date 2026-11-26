export type Role = "admin" | "teacher" | "parent";
export interface User { id: number; schoolId: number; role: Role; name: string }
export interface School { id: number; name: string; city: string; plan: string }
export interface ClassRow { id: number; name: string; section: string; teacher_id: number | null; teacher_name: string | null; student_count: number }
export interface Student {
  id: number; student_code: string; full_name: string; gender: string | null; birth_date: string | null;
  class_id: number | null; parent_id: number | null; class_name: string | null; section: string | null;
  parent_name: string | null; parent_phone: string | null;
}
export interface Subject { id: number; name: string; name_am: string | null }
export interface Person { id: number; name: string; email: string; phone: string | null; role: Role }
export interface Invoice {
  id: number; title: string; amount: number; due_date: string | null; student_id: number;
  full_name: string; student_code: string; class_name: string | null; paid: number;
}
export interface Payment { id: number; amount: number; paid_on: string; method: string | null; reference: string | null }
export interface Message {
  id: number; body: string; created_at: string; read: number; from_user: number; to_user: number;
  student_id: number | null; from_name: string; from_role: Role; to_name: string; student_name: string | null;
}
export interface Contact { id: number; name: string; role: Role }

const KEY = "sms_token";
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch("/api" + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") onUnauthorized();
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

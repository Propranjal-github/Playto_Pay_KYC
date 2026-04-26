/**
 * API Client — Axios instance with token auth.
 *
 * All API calls go through this client which:
 *  - Adds the auth token from localStorage
 *  - Points to the correct base URL
 *  - Provides helpers for common patterns
 */

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────

export const authAPI = {
  register: (data) => api.post("/auth/register/", data),
  login: (data) => api.post("/auth/login/", data),
  me: () => api.get("/auth/me/"),
};

// ── Merchant Submissions ─────────────────────────────

export const submissionAPI = {
  list: () => api.get("/submissions/"),
  create: (data) => api.post("/submissions/", data),
  get: (id) => api.get(`/submissions/${id}/`),
  update: (id, data) => api.patch(`/submissions/${id}/`, data),
  submit: (id) => api.post(`/submissions/${id}/submit/`),
  uploadDocument: (id, formData) =>
    api.post(`/submissions/${id}/documents/`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Reviewer Queue ───────────────────────────────────

export const queueAPI = {
  list: (status) =>
    api.get("/queue/", { params: status ? { status } : {} }),
  get: (id) => api.get(`/queue/${id}/`),
  metrics: () => api.get("/queue/metrics/"),
  startReview: (id) => api.post(`/queue/${id}/start_review/`),
  approve: (id, reason) =>
    api.post(`/queue/${id}/approve/`, { reason }),
  reject: (id, reason) =>
    api.post(`/queue/${id}/reject/`, { reason }),
  requestInfo: (id, reason) =>
    api.post(`/queue/${id}/request_info/`, { reason }),
};

export default api;

import axios from "axios";
import config from "../config";

const API_URL = `${config.API_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send cookies with requests
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach Authorization Bearer token from localStorage if present
api.interceptors.request.use(
  (reqConfig) => {
    const token = localStorage.getItem("token");
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`;
    }
    return reqConfig;
  },
  (error) => Promise.reject(error)
);

// Handle 401 Unauthorized — clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      // Only redirect if not already on login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  getMe: () => api.get("/auth/me"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (token, password) => api.post("/auth/reset-password", { token, password }),
};

// Users API
export const usersAPI = {
  getAll: () => api.get("/users"),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getSupervisors: () => api.get("/users/supervisors"),
  resetPassword: (id, newPassword) =>
    api.put(`/users/${id}/reset-password`, { newPassword }),
  // Profile APIs (for users to edit their own profile)
  updateProfile: (data) => api.put("/users/profile", data),
  updateProfileImage: (formData) =>
    api.put("/users/profile/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateSignatureImage: (formData) =>
    api.put("/users/profile/signature", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  // Import users from CSV/Excel
  importUsers: (formData) =>
    api.post("/users/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  previewImportFile: (formData) =>
    api.post("/users/import-preview", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  previewDbSync: (config) => api.post("/users/import-db-preview", config),
  executeDbSync: (config) => api.post("/users/import-db-sync", config),
  previewApiSync: (config) => api.post("/users/import-api-preview", config),
  executeApiSync: (config) => api.post("/users/import-api-sync", config),
  setupMockDb: () => api.post("/users/setup-mock-db"),
  downloadImportTemplate: () => api.get("/users/import-template", { responseType: "blob" }),
  downloadTemplate: () => api.get("/users/import-template", { responseType: "blob" }),
};

// Leave Requests API
export const leaveRequestsAPI = {
  create: (formData) =>
    api.post("/leave-requests", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getMyRequests: () => api.get("/leave-requests"),
  getAll: () => api.get("/leave-requests/all"),
  getById: (id) => api.get(`/leave-requests/${id}`),
  cancel: (id, reason) => api.put(`/leave-requests/${id}/cancel`, { reason }),
  update: (id, data) => api.put(`/leave-requests/${id}`, data),
  getTeam: () => api.get("/leave-requests/team"),
  getPending: () => api.get("/leave-requests/pending"),
  approve: (id, note) => api.put(`/leave-requests/${id}/approve`, { note }),
  reject: (id, reason) => api.put(`/leave-requests/${id}/reject`, { reason }),
};

// Leave Types API
export const leaveTypesAPI = {
  getAll: () => api.get("/leave-types"),
  create: (data) => api.post("/leave-types", data),
  update: (id, data) => api.put(`/leave-types/${id}`, data),
  delete: (id) => api.delete(`/leave-types/${id}`),
  initialize: () => api.post("/leave-types/init"),
};

// Holidays API
export const holidaysAPI = {
  getAll: (year) => api.get("/holidays", { params: { year } }),
  create: (data) => api.post("/holidays", data),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  delete: (id) => api.delete(`/holidays/${id}`),
  initialize: (year) => api.post("/holidays/init", { year }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// Reports API
export const reportsAPI = {
  getStatistics: (params) => {
    const finalParams = typeof params === "object" ? params : { year: params };
    return api.get("/reports/statistics", { params: finalParams });
  },
  exportExcel: (params) =>
    api.get("/reports/export/excel", {
      params,
      responseType: "blob",
    }),
  exportPDF: (params) =>
    api.get("/reports/export/pdf", {
      params,
      responseType: "blob",
    }),
  resetYearly: () => api.post("/reports/reset-yearly"),
  getAllRequests: (params) => api.get("/reports/all-requests", { params }),
};

// Departments API (สาขาวิชา/หน่วยงาน)
export const departmentsAPI = {
  getAll: (facultyId) => api.get("/departments", { params: { facultyId } }),
  create: (data) => api.post("/departments", data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  initialize: () => api.post("/departments/initialize"),
};

// Faculties API (คณะ/สำนัก/สถาบัน)
export const facultiesAPI = {
  getAll: () => api.get("/faculties"),
  create: (data) => api.post("/faculties", data),
  update: (id, data) => api.put(`/faculties/${id}`, data),
  delete: (id) => api.delete(`/faculties/${id}`),
  initialize: () => api.post("/faculties/initialize"),
};

export default api;

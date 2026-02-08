import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
const BASE_URL = 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string, role?: 'admin' | 'petugas' | 'peminjam') =>
    api.post('/auth/register', { name, email, password, role }),
  me: () => api.get('/auth/me'),
};

// Categories
export const categoryApi = {
  getAll: () => api.get('/categories'),
  getById: (id: number) => api.get(`/categories/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/categories', data),
  update: (id: number, data: { name: string; description?: string; is_active?: boolean }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
};

// Tools
export const toolApi = {
  getAll: (params?: { category_id?: number; status?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/tools', { params }),
  getById: (id: number) => api.get(`/tools/${id}`),
  create: (data: {
    category_id: number;
    name: string;
    asset_tag?: string;
    description?: string;
    location?: string;
    stock?: number;
    available_stock?: number;
    photo_url?: string;
    unit_codes?: string[];
  }) => api.post('/tools', data),
  update: (id: number, data: {
    category_id: number;
    name: string;
    asset_tag?: string;
    description?: string;
    location?: string;
    photo_url?: string;
  }) => api.put(`/tools/${id}`, data),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    return api.post('/tools/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getUnits: (toolId: number) => api.get(`/tools/${toolId}/units`),
  addUnits: (toolId: number, unit_codes: string[]) => api.post(`/tools/${toolId}/units`, { unit_codes }),
  updateUnitStatus: (
    toolId: number,
    unitId: number,
    data: { status?: 'available' | 'dipinjam' | 'maintenance' | 'hilang'; condition_note?: string }
  ) => api.patch(`/tools/${toolId}/units/${unitId}`, data),
  deleteUnit: (toolId: number, unitId: number) => api.delete(`/tools/${toolId}/units/${unitId}`),
  updateStatus: (id: number, status: 'available' | 'not_available') =>
    api.patch(`/tools/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/tools/${id}`),
};

// Peminjaman (UKK)
export const peminjamanApi = {
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/peminjaman', { params }),
  getById: (id: number) => api.get(`/peminjaman/${id}`),
  create: (data: {
    tool_id: number;
    qty?: number;
    tanggal_pinjam: string;
    tanggal_kembali: string;
    catatan?: string;
  }) => api.post('/peminjaman', data),
  approve: (id: number) => api.post(`/peminjaman/${id}/approve`),
  reject: (id: number, alasan?: string) => api.post(`/peminjaman/${id}/reject`, { alasan }),
  checkout: (id: number, kondisi?: string) => api.post(`/peminjaman/${id}/checkout`, { kondisi }),
  return: (id: number, kondisi?: string, keterangan?: string) =>
    api.post(`/peminjaman/${id}/return`, { kondisi, keterangan }),
  getDenda: (id: number) => api.get(`/peminjaman/${id}/denda`),
};

// Reports
export const reportApi = {
  getDashboard: () => api.get('/reports/dashboard'),
  getOverdue: () => api.get('/reports/overdue'),
  getDueSoon: (days?: number) => api.get('/reports/due-soon', { params: { days } }),
  getUtilization: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/reports/utilization', { params }),
  getAuditLogs: (params?: { action?: string; entity_type?: string; user_id?: number; page?: number; limit?: number }) =>
    api.get('/reports/audit-logs', { params }),
  getPeminjamanReport: (params?: { start_date?: string; end_date?: string; status?: string }) =>
    api.get('/reports/peminjaman', { params }),
};

export const getPublicFileUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
};

export default api;

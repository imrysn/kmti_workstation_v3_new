/// <reference types="vite/client" />
import axios from 'axios'
import type { IProject } from '../types'

export const SERVER_BASE = import.meta.env.DEV ? 'http://localhost:8000' : 'http://192.168.200.105:8000'
export const API_BASE = `${SERVER_BASE}/api`

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

/**
 * Inject the JWT token on every request.
 * The token is stored in module-level state (set by AuthContext via setApiToken).
 * This avoids needing React context inside the axios instance.
 */
let _token: string | null = null

export function setApiToken(token: string | null) {
  _token = token
}

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${_token}`
  }
  return config
})

/**
 * Global 401 handler — clears the token so the app re-renders the login screen.
 * Import and call onUnauthorized(cb) once from AuthContext.
 */
type UnauthorizedCallback = () => void
let _onUnauthorized: UnauthorizedCallback | null = null

export function onUnauthorized(cb: UnauthorizedCallback) {
  _onUnauthorized = cb
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized()
    }
    return Promise.reject(err)
  }
)

// --- Purchased Parts ---
export const partsApi = {
  getProjects: (category?: string) =>
    api.get<IProject[]>('/parts/projects', { params: { category } }),
  addProject: (name: string, rootPath: string, category: string = 'PROJECTS') =>
    api.post('/parts/projects', { name, root_path: rootPath, category }),
  deleteProject: (id: number) => api.delete(`/parts/projects/${id}`),
  deleteCategoryProjects: (category: string) =>
    api.delete(`/parts/projects/category/${category}`),
  scanProject: (id: number) => api.post(`/parts/projects/${id}/scan`),
  listParts: (
    projectId?: number,
    search?: string,
    caseSensitive?: boolean,
    cadOnly?: boolean,
    includeFolders?: boolean,
    folderPath?: string,
    recursive: boolean = true,
    limit: number = 1000,
    offset: number = 0
  ) =>
    api.get('/parts/', {
      params: {
        project_id: projectId,
        search,
        case_sensitive: caseSensitive,
        cad_only: cadOnly,
        include_folders: includeFolders,
        folder_path: folderPath,
        recursive,
        limit,
        offset
      },
    }),
  downloadPart: (fileId: number) =>
    api.get('/parts/download', { params: { file_id: fileId }, responseType: 'blob' }),
  deleteItem: (fileId: number) => api.delete(`/parts/${fileId}`),
  getTree: (projectId: number, parentPath?: string) => 
    api.get(`/parts/tree/${projectId}`, { params: { parent_path: parentPath } }),
}

// --- Character Search (Drafting Notes) ---
export const charsApi = {
  search: (q: string, limit: number = 50, offset: number = 0) =>
    api.get('/chars/', { params: { q, limit, offset } }),
  create: (data: { englishChar: string; japaneseChar: string }) =>
    api.post('/chars/', data),
  update: (id: number, data: { englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/${id}`, data),
  delete: (id: number) => api.delete(`/chars/${id}`),
  getHeatTreatmentCategories: () => api.get('/chars/heat-treatment/categories'),
  getHeatTreatment: (category?: string, q?: string, limit: number = 50, offset: number = 0) =>
    api.get('/chars/heat-treatment', { params: { category, q, limit, offset } }),
  createHeatTreatment: (data: { category: string; englishChar: string; japaneseChar: string }) =>
    api.post('/chars/heat-treatment', data),
  updateHeatTreatment: (id: number, data: { category?: string; englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/heat-treatment/${id}`, data),
  deleteHeatTreatment: (id: number) => api.delete(`/chars/heat-treatment/${id}`),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings/'),
  save: (settings: object) => api.post('/settings/', settings),
  clearCache: () => api.delete('/settings/cache'),
  updateApp: () => api.post('/settings/update-app'),
}

// --- Feature Flags ---
export const flagsApi = {
  getAll: () => api.get<Record<string, boolean>>('/flags/'),
  update: (key: string, value: boolean) => api.patch(`/flags/${key}`, { value }),
}

// --- User Management ---
export const usersApi = {
  getAll: () => api.get('/auth/users'),
  create: (data: any) => api.post('/auth/users', data),
  update: (id: number, data: any) => api.patch(`/auth/users/${id}`, data),
  delete: (id: number) => api.delete(`/auth/users/${id}`),
}

// --- Help Center (Tickets) ---
export const helpApi = {
  createTicket: (formData: FormData) => 
    api.post('/help/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getTickets: (workstation?: string) => 
    api.get('/help/tickets', { params: { workstation } }),
  getTicketDetails: (id: number) => 
    api.get(`/help/tickets/${id}`),
  reply: (id: number, formData: FormData) => 
    api.post(`/help/tickets/${id}/reply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id: number, status: string) => 
    api.patch(`/help/tickets/${id}/status`, { status }),
}
// --- Production Resiliency Interceptor ---
// Automatically retry transient errors (503, 504) once before giving up.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    
    // Only retry if it's a transient server error and hasn't been retried yet
    const isTransientError = response && [503, 504].includes(response.status);
    const hasAlreadyRetried = config && config._retry;

    if (isTransientError && !hasAlreadyRetried) {
      config._retry = true;
      console.warn(`[API] Transient error ${response.status}. Retrying request...`, config.url);
      
      // Wait 1s before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api

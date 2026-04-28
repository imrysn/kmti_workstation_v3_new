/// <reference types="vite/client" />
import axios from 'axios'
import type { IProject, IQuotation, IQuotationHistory } from '../types'

export const SERVER_BASE = (() => {
  const override = typeof localStorage !== 'undefined' ? localStorage.getItem('KMTI_SERVER_OVERRIDE') : null
  if (override) return override
  // DEV mode always uses localhost — VITE_API_PROD_URL is production-only
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return import.meta.env.VITE_API_PROD_URL || 'http://192.168.200.105:8000'
})()
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
    api.get<IProject[]>('/parts/projects', { params: { category } }).then(res => res.data),
  addProject: (name: string, rootPath: string, category: string = 'PROJECTS') =>
    api.post('/parts/projects', { name, root_path: rootPath, category }).then(res => res.data),
  deleteProject: (id: number) => api.delete(`/parts/projects/${id}`).then(res => res.data),
  deleteCategoryProjects: (category: string) =>
    api.delete(`/parts/projects/category/${category}`).then(res => res.data),
  scanProject: (id: number) => api.post(`/parts/projects/${id}/scan`).then(res => res.data),
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
    }).then(res => res.data),
  downloadPart: (fileId: number) =>
    api.get('/parts/download', { params: { file_id: fileId }, responseType: 'blob' }).then(res => res.data),
  deleteItem: (fileId: number) => api.delete(`/parts/${fileId}`).then(res => res.data),
  getTree: (projectId: number, parentPath?: string) => 
    api.get(`/parts/tree/${projectId}`, { params: { parent_path: parentPath } }).then(res => res.data),
  getSuggestions: (q: string, parentPath?: string) => 
    api.get<string[]>(`/parts/suggest`, { params: { q, parent_path: parentPath } }).then(r => r.data),
  getCategories: () => api.get<string[]>('/parts/categories').then(r => r.data),
}

// --- Character Search (Drafting Notes) ---
export const charsApi = {
  search: (q: string, limit: number = 50, offset: number = 0) =>
    api.get('/chars/', { params: { q, limit, offset } }).then(res => res.data),
  create: (data: { englishChar: string; japaneseChar: string }) =>
    api.post('/chars/', data).then(res => res.data),
  update: (id: number, data: { englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/chars/${id}`).then(res => res.data),
  getHeatTreatmentCategories: () => api.get('/chars/heat-treatment/categories').then(res => res.data),
  getHeatTreatment: (category?: string, q?: string, limit: number = 50, offset: number = 0) =>
    api.get('/chars/heat-treatment', { params: { category, q, limit, offset } }).then(res => res.data),
  createHeatTreatment: (data: { category: string; englishChar: string; japaneseChar: string }) =>
    api.post('/chars/heat-treatment', data).then(res => res.data),
  updateHeatTreatment: (id: number, data: { category?: string; englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/heat-treatment/${id}`, data).then(res => res.data),
  deleteHeatTreatment: (id: number) => api.delete(`/chars/heat-treatment/${id}`).then(res => res.data),
}

// --- Designers ---
export const designersApi = {
  getCategories: () => api.get('/designers/categories').then(res => res.data),
  list: (category?: string, q?: string, limit: number = 50, offset: number = 0) =>
    api.get('/designers', { params: { category, q, limit, offset } }).then(res => res.data),
  create: (data: { category: string; englishName: string; email: string; japaneseName: string }) =>
    api.post('/designers', data).then(res => res.data),
  update: (id: number, data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.patch(`/designers/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/designers/${id}`).then(res => res.data),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings/').then(res => res.data),
  save: (settings: object) => api.post('/settings/', settings).then(res => res.data),
  clearCache: () => api.delete('/settings/cache').then(res => res.data),
  updateApp: () => api.post('/settings/update-app').then(res => res.data),
}

// --- Feature Flags ---
export const flagsApi = {
  getAll: () => api.get<Record<string, boolean>>('/flags/').then(res => res.data),
  update: (key: string, value: boolean) => api.patch(`/flags/${key}`, { value }).then(res => res.data),
}

// --- User Management ---
export const usersApi = {
  getAll: () => api.get('/auth/users').then(res => res.data),
  create: (data: any) => api.post('/auth/users', data).then(res => res.data),
  update: (id: number, data: any) => api.patch(`/auth/users/${id}`, data).then(res => res.data),
  delete: (id: number) => api.delete(`/auth/users/${id}`).then(res => res.data),
}

// --- Help Center (Tickets) ---
export const helpApi = {
  createTicket: (formData: FormData) => 
    api.post('/help/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data),
  getTickets: (workstation?: string) => 
    api.get('/help/tickets', { params: { workstation } }).then(res => res.data),
  getTicketDetails: (id: number) => 
    api.get(`/help/tickets/${id}`).then(res => res.data),
  reply: (id: number, formData: FormData) => 
    api.post(`/help/tickets/${id}/reply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(res => res.data),
  updateStatus: (id: number, status: string) => 
    api.patch(`/help/tickets/${id}/status`, { status }).then(res => res.data),
  getUnreadCount: (workstation?: string) =>
    api.get('/help/tickets/unread_count', { params: { workstation } }).then(res => res.data),
  deleteTicket: (id: number) => api.delete(`/help/tickets/${id}`).then(res => res.data)
}
// --- Telemetry (Heartbeat) ---
export const telemetryApi = {
  heartbeat: (formData: FormData) => api.post('/telemetry/heartbeat', formData).then(res => res.data),
  getStatuses: () => api.get('/telemetry/status').then(res => res.data),
}

// --- Broadcast Messages ---
export const broadcastApi = {
  getActive: () => api.get('/broadcast/active').then(res => res.data),
  list: () => api.get('/broadcast/').then(res => res.data),
  create: (data: FormData) => api.post('/broadcast/', data).then(res => res.data),
  delete: (id: number) => api.delete(`/broadcast/${id}`).then(res => res.data),
  acknowledge: (id: number, workstation: string) => {
    const fd = new FormData();
    fd.append('workstation', workstation);
    return api.post(`/broadcast/${id}/acknowledge`, fd).then(res => res.data);
  },
  getAcks: (id: number) => api.get(`/broadcast/${id}/acks`).then(res => res.data)
}

// --- Quotations (Database-First) ---
export const quotationApi = {
  list: (params: { q?: string; designer?: string; limit?: number; offset?: number }) =>
    api.get<{ quotations: IQuotation[] }>('/quotations/', { params }).then(res => res.data),
  getSessions: () => 
    api.get<{ sessions: any[] }>('/quotations/sessions').then(res => res.data),
  get: (id: number) => 
    api.get<any>(`/quotations/${id}`).then(res => res.data),
  create: (data: any) => 
    api.post<{ success: boolean; id: number }>('/quotations/', data).then(res => res.data),
  update: (id: number, data: any) => 
    api.patch(`/quotations/${id}`, data).then(res => res.data),
  delete: (id: number, workstation?: string) => 
    api.delete(`/quotations/${id}`, { params: { workstation } }).then(res => res.data),
  getHistory: (id: number) => 
    api.get<{ history: IQuotationHistory[] }>(`/quotations/${id}/history`).then(res => res.data),
  restoreHistory: (qId: number, hId: number) => 
    api.get<any>(`/quotations/${qId}/history/${hId}`).then(res => res.data),
}

// --- Stopwatch Records ---
export const stopwatchApi = {
  list: (workstation?: string, user_name?: string, limit: number = 50) =>
    api.get<any[]>('/stopwatch/', { params: { workstation, user_name, limit } }).then(res => res.data),
  create: (data: { name: string; time: string; workstation?: string; user_name?: string }) =>
    api.post('/stopwatch/', data).then(res => res.data),
  update: (id: string, name: string) =>
    api.patch(`/stopwatch/${id}`, { name }).then(res => res.data),
  delete: (id: string) =>
    api.delete(`/stopwatch/${id}`).then(res => res.data),
}

// --- Librarian AI Assistant ---
export const librarianApi = {
  getSessions: () => api.get('/librarian/sessions').then(res => res.data),
  createSession: (title?: string) => api.post('/librarian/sessions', { title }).then(res => res.data),
  deleteSession: (id: number) => api.delete(`/librarian/sessions/${id}`).then(res => res.data),
  getHistory: (sessionId?: number) => api.get('/librarian/history', { params: { session_id: sessionId } }).then(res => res.data),
  clearHistory: () => api.delete('/librarian/history').then(res => res.data),
  submitFeedback: (data: { message_id: number; is_helpful: boolean; query: string; response: string }) => 
    api.post('/librarian/feedback', data).then(res => res.data),
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

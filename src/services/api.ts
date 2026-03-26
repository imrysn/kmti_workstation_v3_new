import axios from 'axios'
import type { IProject } from '../types'

const API_BASE = 'http://127.0.0.1:8000/api'

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
    folderPath?: string
  ) =>
    api.get('/parts/', {
      params: {
        project_id: projectId,
        search,
        case_sensitive: caseSensitive,
        cad_only: cadOnly,
        include_folders: includeFolders,
        folder_path: folderPath,
      },
    }),
  downloadPart: (fileId: number) =>
    api.get('/parts/download', { params: { file_id: fileId }, responseType: 'blob' }),
  deleteItem: (fileId: number) => api.delete(`/parts/${fileId}`),
  getTree: (projectId: number) => api.get(`/parts/tree/${projectId}`),
}

// --- Character Search ---
export const charsApi = {
  search: (q: string) => api.get('/chars/', { params: { q } }),
  getHeatTreatmentCategories: () => api.get('/chars/heat-treatment/categories'),
  getHeatTreatment: (category?: string, q?: string) =>
    api.get('/chars/heat-treatment', { params: { category, q } }),
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

export default api

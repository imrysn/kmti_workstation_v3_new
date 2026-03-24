import axios from 'axios'
import type { IProject } from '../types'

const API_BASE = 'http://127.0.0.1:8000/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// --- Purchased Parts ---
export const partsApi = {
  getProjects: () => api.get<IProject[]>('/parts/projects'),
  browseProjectFolder: () => api.get<{path: string}>('/parts/projects/browse'),
  addProject: (name: string, rootPath: string) => api.post('/parts/projects', { name, root_path: rootPath }),
  deleteProject: (id: number) => api.delete(`/parts/projects/${id}`),
  scanProject: (id: number) => api.post(`/parts/projects/${id}/scan`),
  listParts: (projectId?: number, search?: string, caseSensitive?: boolean, cadOnly?: boolean, includeFolders?: boolean, folderPath?: string) =>
    api.get('/parts/', { params: { project_id: projectId, search, case_sensitive: caseSensitive, cad_only: cadOnly, include_folders: includeFolders, folder_path: folderPath } }),
  downloadPart: (fileId: number) =>
    api.get('/parts/download', { params: { file_id: fileId }, responseType: 'blob' }),
  deleteItem: (fileId: number) => api.delete(`/parts/${fileId}`),
  getTree: (projectId: number) => api.get(`/parts/tree/${projectId}`),
  createFolder: (projectName: string, basePath?: string) => 
    api.post('/parts/folders', { project_name: projectName, base_path: basePath || '' }),
}

// --- Character Search ---
export const charsApi = {
  search: (q: string) => api.get('/chars/', { params: { q } }),
  getHeatTreatment: (category?: string, q?: string) =>
    api.get('/chars/heat-treatment', { params: { category, q } }),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings/'),
  save: (settings: object) => api.post('/settings/', settings),
  clearCache: () => api.delete('/settings/cache'),
}

export default api

import axios from 'axios'

const API_BASE = 'http://127.0.0.1:8000/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// --- Purchased Parts ---
export const partsApi = {
  getCategories: () => api.get<string[]>('/parts/categories'),
  getTypes: (category?: string) => api.get<string[]>('/parts/types', { params: { category } }),
  listParts: (category?: string, partsType?: string, search?: string) =>
    api.get('/parts/', { params: { category, parts_type: partsType, search } }),
  downloadPart: (filename: string) =>
    api.get('/parts/download', { params: { filename }, responseType: 'blob' }),
  uploadPart: (formData: FormData) =>
    api.post('/parts/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deletePart: (filename: string) => api.delete('/parts/', { params: { filename } }),
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
}

export default api

import { api } from './client'

export const adminApi = {
  // ── Stats ────────────────────────────────────────────────────────────────
  stats: () => api.get('/admin/stats'),

  // ── Users (/user/create, /user/update, /users) ───────────────────────────
  listUsers:    (page = 1, perPage = 20, filters = {}) => {
    const q = new URLSearchParams({ page, perPage, ...filters }).toString()
    return api.get(`/users?${q}`)
  },
  findUser:     (id)   => api.get(`/users/${id}`),
  createUser:   (data) => api.post('/user/create', data),
  updateUser:   (data) => api.post('/user/update', data),
  deleteUser:   (id)   => api.del(`/users/${id}`),
  reprogramTin: (data) => api.post('/user/reprogram-tin', data),

  // ── Tax config (/config/tax) ─────────────────────────────────────────────
  listTax:   ()         => api.get('/config/tax'),
  updateTax: (id, data) => api.patch(`/config/tax/${id}`, data),

  // ── Branches (/admin/branches) — read-only pull from RRA; only the local
  // device-user link is editable here (see BRANCH_MANAGEMENT_GAPS.md #1/#3)
  listBranches:  (page = 1, tin = '', perPage = 20) => api.get(`/admin/branches?page=${page}&perPage=${perPage}${tin ? `&tin=${tin}` : ''}`),
  updateBranch:  (id, data)           => api.patch(`/admin/branches/${id}`, data),
  deleteBranch:  (id)                 => api.del(`/admin/branches/${id}`),

  // ── EBM tools (/admin/ebm/...) ───────────────────────────────────────────
  syncClassifications: ()     => api.get('/item/classification/sync'),
  ebmBranchUsers:      (data) => api.post('/admin/ebm/branch/users',      data),
  ebmBranchInsurances: (data) => api.post('/admin/ebm/branch/insurances',  data),
  ebmStockItems:       (data) => api.post('/admin/ebm/stock/items',        data),
}

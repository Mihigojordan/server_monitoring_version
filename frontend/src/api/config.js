import { api } from './client'

export const configApi = {
  list:   ()         => api.get('/config/tax'),
  update: (id, data) => api.patch(`/config/tax/${id}`, data),
}

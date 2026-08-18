import { api } from './client'

export const authApi = {
  loginUser:  (email, password) => api.post('/user/login',  { email, password }),
  loginAdmin: (email, password) => api.post('/admin/login', { email, password }),
  userInfo:   ()                => api.post('/user/info',   {}),
  initDevice: ()                => api.post('/user/init',   {}),
  editUser:   (data)            => api.patch('/user/edit',  data),
  updateMrc:  (data)            => api.post('/user/mrc',    data),
}

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
})

api.interceptors.request.use((config) => {
  const access = localStorage.getItem('tanasob_access')
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

let refreshing = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config
    const refresh = localStorage.getItem('tanasob_refresh')
    if (error.response?.status !== 401 || request?._retry || !refresh) {
      return Promise.reject(error)
    }

    request._retry = true
    refreshing ??= axios
      .post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh })
      .then(({ data }) => {
        localStorage.setItem('tanasob_access', data.access)
        return data.access
      })
      .finally(() => {
        refreshing = null
      })

    const access = await refreshing
    request.headers.Authorization = `Bearer ${access}`
    return api(request)
  },
)

export const getItems = (payload) => (Array.isArray(payload) ? payload : payload.results || [])

export const errorMessage = (error) => {
  const data = error.response?.data
  if (!data) return 'اتصال به سرور برقرار نشد.'
  if (typeof data === 'string') return data
  return Object.values(data).flat().join(' ') || 'درخواست با خطا روبه‌رو شد.'
}

export default api

import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const serverBaseUrl = apiBaseUrl.replace(/\/api$/, '')

const api = axios.create({ baseURL: apiBaseUrl, headers: { Accept: 'application/json' } })

export const setAccessToken = (token) => {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

export const getErrorMessage = (error) => error.response?.data?.message || error.message || 'Something went wrong. Please try again.'

export default api

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'fox_eye_token';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 20000, // generous timeout for Render cold starts
  headers: {
    'Content-Type':     'application/json',
    'X-Fox-Eye-Client': 'mobile',
  },
});

// Request interceptor — inject Bearer token from SecureStore
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // SecureStore unavailable — proceed without auth header
  }
  return config;
});

// Response interceptor — handle auth failures and cold-start detection
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token expired or invalid — clear stored token
      try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* noop */ }
    }

    return Promise.reject(error);
  }
);

export const storeToken  = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken  = ()      => SecureStore.deleteItemAsync(TOKEN_KEY);
export const getToken    = ()      => SecureStore.getItemAsync(TOKEN_KEY);

export default api;

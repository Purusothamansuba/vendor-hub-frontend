import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

// Always use the deployed Render backend unless an explicit override is provided.
const baseURL = import.meta.env.VITE_API_URL || 'https://vendor-hub-93o2.onrender.com';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const addToast = useToastStore.getState().addToast;
    const msg = error.response?.data?.error || error.response?.data?.message || 'Something went wrong';

    if (error.response?.status !== 401) {
      addToast(msg, 'error');
    }

    return Promise.reject(error);
  }
);

export default api;


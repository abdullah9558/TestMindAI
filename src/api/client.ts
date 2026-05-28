const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let token: string | null = localStorage.getItem('token');

export function setToken(newToken: string) {
  token = newToken;
  localStorage.setItem('token', newToken);
}

export function getToken() {
  return token || localStorage.getItem('token');
}

export function clearToken() {
  token = null;
  localStorage.removeItem('token');
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiCall(endpoint: string, options: RequestOptions = {}) {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (!skipAuth) {
    const currentToken = getToken();
    if (currentToken) {
      headers.Authorization = `Bearer ${currentToken}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/';
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const API_BASE = API_BASE_URL;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  total?: number;
  page?: number;
  totalPages?: number;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('sp_token', token);
    } else {
      localStorage.removeItem('sp_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('sp_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_refresh_token');
  }

  setRefreshToken(token: string | null) {
    if (token) {
      localStorage.setItem('sp_refresh_token', token);
    } else {
      localStorage.removeItem('sp_refresh_token');
    }
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('sp_refresh_token');
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      const refreshSuccess = await this.tryRefresh();
      if (refreshSuccess) {
        throw new Error('RETRY_REQUEST');
      }
      this.clearToken();
      window.location.href = '/auth';
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data as T;
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        this.setToken(data.access_token);
        this.setRefreshToken(data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
      ...options,
    });

    try {
      return await this.handleResponse<T>(response);
    } catch (e) {
      if (e instanceof Error && e.message === 'RETRY_REQUEST') {
        const retryHeaders = await this.getHeaders();
        const retryResponse = await fetch(url, { method: 'GET', headers: retryHeaders });
        return this.handleResponse<T>(retryResponse);
      }
      throw e;
    }
  }

  async post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    try {
      return await this.handleResponse<T>(response);
    } catch (e) {
      if (e instanceof Error && e.message === 'RETRY_REQUEST') {
        const retryHeaders = await this.getHeaders();
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(retryResponse);
      }
      throw e;
    }
  }

  async put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    try {
      return await this.handleResponse<T>(response);
    } catch (e) {
      if (e instanceof Error && e.message === 'RETRY_REQUEST') {
        const retryHeaders = await this.getHeaders();
        const retryResponse = await fetch(url, {
          method: 'PUT',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(retryResponse);
      }
      throw e;
    }
  }

  async patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    try {
      return await this.handleResponse<T>(response);
    } catch (e) {
      if (e instanceof Error && e.message === 'RETRY_REQUEST') {
        const retryHeaders = await this.getHeaders();
        const retryResponse = await fetch(url, {
          method: 'PATCH',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        return this.handleResponse<T>(retryResponse);
      }
      throw e;
    }
  }

  async delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(endpoint, options?.params);
    const headers = await this.getHeaders();

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      ...options,
    });

    try {
      return await this.handleResponse<T>(response);
    } catch (e) {
      if (e instanceof Error && e.message === 'RETRY_REQUEST') {
        const retryHeaders = await this.getHeaders();
        const retryResponse = await fetch(url, { method: 'DELETE', headers: retryHeaders });
        return this.handleResponse<T>(retryResponse);
      }
      throw e;
    }
  }

  async upload<T = unknown>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async download(endpoint: string, filename: string): Promise<void> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  }
}

export const api = new ApiClient(API_BASE);
export type { ApiResponse };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function api<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  initiateGitHubLogin: () =>
    api<{ auth_url: string; state: string }>('/api/auth/github'),

  getUser: (userId: string) =>
    api<{
      id: string;
      github_username: string;
      github_email: string | null;
      github_avatar_url: string | null;
    }>('/api/auth/me', { params: { user_id: userId } }),
};

// Repos API
export const reposApi = {
  listGitHubRepos: (userId: string, page = 1, perPage = 30) =>
    api<{
      repos: Array<{
        id: number;
        full_name: string;
        name: string;
        description: string | null;
        clone_url: string;
        default_branch: string;
        private: boolean;
        updated_at: string;
      }>;
      page: number;
      per_page: number;
    }>('/api/repos', {
      params: {
        user_id: userId,
        page: page.toString(),
        per_page: perPage.toString(),
      },
    }),

  listConnectedRepos: (userId: string) =>
    api<{
      repos: Array<{
        id: string;
        github_repo_id: number;
        full_name: string;
        local_path: string;
        default_branch: string;
      }>;
    }>('/api/repos/connected', { params: { user_id: userId } }),

  connectRepo: (
    userId: string,
    data: {
      github_repo_id: number;
      full_name: string;
      clone_url: string;
      default_branch: string;
    }
  ) =>
    api<{ id: string; full_name: string; local_path: string; message: string }>(
      '/api/repos/connect',
      {
        method: 'POST',
        params: { user_id: userId },
        body: JSON.stringify(data),
      }
    ),

  disconnectRepo: (userId: string, repoId: string) =>
    api<{ message: string }>(`/api/repos/${repoId}`, {
      method: 'DELETE',
      params: { user_id: userId },
    }),

  syncRepo: (userId: string, repoId: string) =>
    api<{ message: string }>(`/api/repos/${repoId}/sync`, {
      method: 'POST',
      params: { user_id: userId },
    }),
};

// Sessions API
export const sessionsApi = {
  create: (userId: string, repoId: string, rows = 24, cols = 80) =>
    api<{
      session_id: string;
      repo_id: string;
      repo_path: string;
      status: string;
      created_at: string;
    }>('/api/sessions', {
      method: 'POST',
      params: { user_id: userId },
      body: JSON.stringify({ repo_id: repoId, rows, cols }),
    }),

  list: (userId: string) =>
    api<{
      sessions: Array<{
        id: string;
        repo_id: string;
        status: string;
        created_at: string;
      }>;
    }>('/api/sessions', { params: { user_id: userId } }),

  get: (userId: string, sessionId: string) =>
    api<{
      id: string;
      repo_id: string;
      repo_path: string;
      status: string;
      created_at: string;
      is_alive: boolean;
    }>(`/api/sessions/${sessionId}`, { params: { user_id: userId } }),

  terminate: (userId: string, sessionId: string) =>
    api<{ message: string }>(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      params: { user_id: userId },
    }),

  resize: (userId: string, sessionId: string, rows: number, cols: number) =>
    api<{ message: string }>(`/api/sessions/${sessionId}/resize`, {
      method: 'POST',
      params: { user_id: userId, rows: rows.toString(), cols: cols.toString() },
    }),
};

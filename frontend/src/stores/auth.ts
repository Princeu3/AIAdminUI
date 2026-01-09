import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  github_username: string;
  github_email: string | null;
  github_avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'ai-admin-auth',
    }
  )
);

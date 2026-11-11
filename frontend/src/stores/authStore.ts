import { create } from 'zustand';

const CLOUD_URL = 'https://app.shellcat.kz';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken?: string) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('shellius_token'),
  isAuthenticated: !!localStorage.getItem('shellius_token'),

  login: (token: string, refreshToken?: string) => {
    localStorage.setItem('shellius_token', token);
    if (refreshToken) {
      localStorage.setItem('shellius_refresh_token', refreshToken);
    }
    localStorage.removeItem('shellius_auth_skipped');
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('shellius_token');
    localStorage.removeItem('shellius_refresh_token');
    localStorage.removeItem('shellius_email');
    localStorage.removeItem('shellius_auth_skipped');
    set({ token: null, isAuthenticated: false });
  },

  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem('shellius_refresh_token');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${CLOUD_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        get().logout();
        return false;
      }

      const data = await res.json();
      localStorage.setItem('shellius_token', data.token);
      localStorage.setItem('shellius_refresh_token', data.refresh_token);
      set({ token: data.token });
      return true;
    } catch {
      return false;
    }
  },
}));

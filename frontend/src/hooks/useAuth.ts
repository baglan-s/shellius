import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

declare global {
  interface Window {
    shellius?: {
      onDeepLink: (callback: (url: string) => void) => void;
      platform: string;
    };
  }
}

export function useAuth() {
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    // Listen for OAuth deep link callbacks
    window.shellius?.onDeepLink((url: string) => {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('token');
      if (token) {
        login(token);
      }
    });
  }, [login]);
}

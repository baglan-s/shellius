import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const saved = localStorage.getItem('shellius_theme') as Theme | null;
const initial: Theme = saved === 'light' ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', initial);

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('shellius_theme', theme);
    set({ theme });
  },
  toggle: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('shellius_theme', next);
      return { theme: next };
    }),
}));

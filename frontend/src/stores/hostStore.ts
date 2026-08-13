import { create } from 'zustand';

export interface Host {
  id: string;
  label: string;
  hostname: string;
  port: number;
  username: string;
  auth_method: string;
  password_enc?: string;
  group_name: string;
}

interface HostState {
  hosts: Host[];
  selectedHostId: string | null;
  setHosts: (hosts: Host[]) => void;
  selectHost: (id: string | null) => void;
  addHost: (host: Host) => void;
  updateHost: (host: Host) => void;
  removeHost: (id: string) => void;
}

export const useHostStore = create<HostState>((set) => ({
  hosts: [],
  selectedHostId: null,

  setHosts: (hosts) => set({ hosts }),
  selectHost: (id) => set({ selectedHostId: id }),
  addHost: (host) => set((s) => ({ hosts: [...s.hosts, host] })),
  updateHost: (host) =>
    set((s) => ({
      hosts: s.hosts.map((h) => (h.id === host.id ? host : h)),
    })),
  removeHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id) })),
}));

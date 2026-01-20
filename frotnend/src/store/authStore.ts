import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Role = 'admin' | 'petugas' | 'peminjam';

interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isPetugas: () => boolean;
  isPeminjam: () => boolean;
  canManageInventory: () => boolean;
  canProcessPeminjaman: () => boolean;
  canViewReports: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      },
      isAdmin: () => get().user?.role === 'admin',
      isPetugas: () => get().user?.role === 'petugas',
      isPeminjam: () => get().user?.role === 'peminjam',
      canManageInventory: () => get().user?.role === 'admin',
      canProcessPeminjaman: () => ['admin', 'petugas'].includes(get().user?.role || ''),
      canViewReports: () => ['admin', 'petugas'].includes(get().user?.role || ''),
    }),
    {
      name: 'auth-storage',
    }
  )
);

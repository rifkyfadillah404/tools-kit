import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Package,
  ClipboardList,
  FileCheck,
  BarChart3,
  ScrollText,
  LogOut,
  ChevronLeft,
  Menu,
  Sparkles,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const navigate = useNavigate();
  const { user, logout, canManageInventory, canProcessPeminjaman, canViewReports } = useAuthStore();
  const { theme, setTheme } = useUIStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadgeClass = () => {
    if (user?.role === 'admin') return 'role-admin';
    if (user?.role === 'petugas') return 'role-petugas';
    return 'role-peminjam';
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 relative overflow-hidden ${
      isActive
        ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-lg'
        : 'text-ink-600 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-white'
    }`;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-40 animate-[fade-in_0.2s_ease-out]"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0D1117] border-r border-ink-100 dark:border-ink-800 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-ink-50 dark:border-ink-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-ink-900 to-ink-700 dark:from-brand-500 dark:to-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Wrench size={18} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-sage-500 rounded-full border-2 border-white dark:border-[#0D1117]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-ink-900 dark:text-white">ToolVault</span>
              <p className="text-[10px] font-medium text-ink-400 uppercase tracking-wider">Inventory System</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-2 text-ink-400 hover:text-ink-600 dark:hover:text-white hover:bg-ink-50 dark:hover:bg-ink-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavLink to="/" end className={navLinkClass}>
            {({ isActive }) => (
              <>
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>

          {/* Inventaris Section */}
          <div className="pt-6 pb-2">
            <p className="px-4 text-[10px] font-bold text-ink-400 uppercase tracking-[0.15em]">
              Inventaris
            </p>
          </div>

          <NavLink to="/tools" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <Package size={18} />
                <span>Daftar Alat</span>
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>

          {canManageInventory() && (
            <NavLink to="/categories" className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <ClipboardList size={18} />
                  <span>Kategori</span>
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          )}

          {/* Peminjaman Section */}
          <div className="pt-6 pb-2">
            <p className="px-4 text-[10px] font-bold text-ink-400 uppercase tracking-[0.15em]">
              Peminjaman
            </p>
          </div>

          <NavLink to="/peminjaman" className={navLinkClass}>
            {({ isActive }) => (
              <>
                <FileCheck size={18} />
                <span>Peminjaman</span>
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>

          {canProcessPeminjaman() && (
            <NavLink to="/loans" className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <ScrollText size={18} />
                  <span>Proses Pengembalian</span>
                  {isActive && (
                    <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          )}

          {/* Laporan Section */}
          {canViewReports() && (
            <>
              <div className="pt-6 pb-2">
                <p className="px-4 text-[10px] font-bold text-ink-400 uppercase tracking-[0.15em]">
                  Laporan
                </p>
              </div>

              <NavLink to="/reports" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <BarChart3 size={18} />
                    <span>Laporan & Audit</span>
                    {isActive && (
                      <div className="absolute right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* Theme Switcher */}
        <div className="px-4 pb-2">
          <div className="theme-switcher">
            <button
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'active' : ''}
              title="Light mode"
            >
              <Sun size={16} />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'active' : ''}
              title="Dark mode"
            >
              <Moon size={16} />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={theme === 'system' ? 'active' : ''}
              title="System preference"
            >
              <Monitor size={16} />
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="p-4">
          <div className="p-4 bg-gradient-to-br from-ink-50 to-ink-100/50 dark:from-ink-800 dark:to-ink-900/50 rounded-2xl border border-ink-100 dark:border-ink-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-11 h-11 bg-white dark:bg-ink-700 shadow-sm border border-ink-100 dark:border-ink-600 rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold bg-gradient-to-br from-ink-700 to-ink-900 dark:from-white dark:to-ink-200 bg-clip-text text-transparent">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900 dark:text-white truncate">{user?.name}</p>
                <span className={`role-badge ${getRoleBadgeClass()} mt-1 text-[9px] px-2 py-0.5`}>
                  <Sparkles size={10} />
                  {user?.role}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-ink-600 dark:text-ink-300 bg-white dark:bg-ink-700 border border-ink-200 dark:border-ink-600 rounded-xl hover:bg-coral-50 dark:hover:bg-coral-900/20 hover:text-coral-600 hover:border-coral-200 dark:hover:border-coral-800 transition-all duration-200 group"
            >
              <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="lg:hidden fixed top-4 left-4 z-30 p-3 bg-white dark:bg-ink-800 border border-ink-100 dark:border-ink-700 rounded-xl shadow-lg shadow-ink-900/5 hover:shadow-md transition-shadow"
        >
          <Menu size={20} className="text-ink-700 dark:text-white" />
        </button>
      )}
    </>
  );
};

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ClipboardCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Box,
  CalendarClock,
  History,
  ChevronRight,
  Zap,
  Shield,
  Users,
} from 'lucide-react';
import { reportApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

interface DashboardData {
  tools: {
    total: number;
    available: number;
    not_available: number;
    zero_available_stock: number;
  };
  peminjaman: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    dipinjam: number;
    dikembalikan: number;
    overdue: number;
  };
  denda: {
    total_denda: string;
  };
  recentActivity: any[];
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, canViewReports } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Selamat Pagi' : currentHour < 17 ? 'Selamat Siang' : 'Selamat Malam';

  useEffect(() => {
    if (canViewReports()) {
      fetchDashboard();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await reportApi.getDashboard();
      setData(data);
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-ink-100 dark:border-ink-700 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-brand-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-ink-400 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  // Admin/Petugas Dashboard
  if (canViewReports() && data) {
    return <AdminDashboard data={data} user={user} greeting={greeting} />;
  }

  // Peminjam Dashboard
  return <PeminjamDashboard user={user} greeting={greeting} navigate={navigate} />;
};

// ==================== ADMIN/PETUGAS DASHBOARD ====================
interface AdminDashboardProps {
  data: DashboardData;
  user: any;
  greeting: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ data, user, greeting }) => {
  const getRoleBadge = () => {
    if (user?.role === 'admin') return 'role-admin';
    return 'role-petugas';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Section */}
      <header className="relative overflow-hidden bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-8 animate-[reveal-up_0.5s_ease-out_both]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-50 dark:from-brand-500/10 to-transparent rounded-full blur-3xl opacity-60 -mr-48 -mt-48" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`role-badge ${getRoleBadge()}`}>
                <Shield size={12} />
                {user?.role}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-ink-900 dark:text-white tracking-tight">
              {greeting}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-ink-500 dark:text-ink-400 mt-2 font-medium">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-6 px-6 py-4 bg-ink-50 dark:bg-ink-800/50 rounded-xl">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-ink-900 dark:text-white">{data.tools.available}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 font-medium">Tersedia</p>
            </div>
            <div className="w-px h-10 bg-ink-200 dark:bg-ink-700" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-brand-500">{data.peminjaman.pending}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 font-medium">Pending</p>
            </div>
            <div className="w-px h-10 bg-ink-200 dark:bg-ink-700" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-coral-500">{data.peminjaman.overdue}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400 font-medium">Terlambat</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stat Cards Grid - Asymmetric Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 stagger-children">
        <div className="lg:col-span-3">
          <MetricCard
            title="Total Alat"
            value={data.tools.total}
            subtitle={`${data.tools.available} tersedia`}
            icon={<Package size={20} />}
            accent="brand"
            trend={data.tools.available > 0 ? 'up' : 'neutral'}
          />
        </div>
        <div className="lg:col-span-3">
          <MetricCard
            title="Aktif Dipinjam"
            value={data.peminjaman.dipinjam}
            subtitle={data.peminjaman.overdue > 0 ? `${data.peminjaman.overdue} terlambat` : 'Semua tepat waktu'}
            icon={<ClipboardCheck size={20} />}
            accent={data.peminjaman.overdue > 0 ? 'coral' : 'ocean'}
            highlight={data.peminjaman.overdue > 0}
          />
        </div>
        <div className="lg:col-span-3">
          <MetricCard
            title="Pending Review"
            value={data.peminjaman.pending}
            subtitle="Perlu tindakan"
            icon={<Clock size={20} />}
            accent="violet"
            pulse={data.peminjaman.pending > 0}
          />
        </div>
        <div className="lg:col-span-3">
          <MetricCard
            title="Total Denda"
            value={new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0
            }).format(Number(data.denda.total_denda))}
            subtitle="Belum lunas"
            icon={<AlertTriangle size={20} />}
            accent="coral"
            highlight={Number(data.denda.total_denda) > 0}
            isPrice
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden animate-[reveal-up_0.5s_ease-out_0.2s_both]">
          <div className="px-6 py-5 border-b border-ink-100 dark:border-ink-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">Aktivitas Terbaru</h2>
              <p className="text-sm text-ink-400 mt-0.5">Pemantauan real-time sistem</p>
            </div>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-500 transition-colors group">
              Semua
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="divide-y divide-ink-50 dark:divide-ink-800">
            {data.recentActivity.length > 0 ? (
              data.recentActivity.slice(0, 5).map((activity, idx) => (
                <ActivityItem key={activity.id} activity={activity} index={idx} />
              ))
            ) : (
              <EmptyActivity />
            )}
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Quick Stats Card */}
          <div className="relative bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 rounded-2xl p-6 text-white overflow-hidden animate-[reveal-up_0.5s_ease-out_0.3s_both]">
            <div className="absolute inset-0 bg-grid opacity-10" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-brand-400" />
                <span className="text-sm font-semibold text-ink-300">Ringkasan Cepat</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <p className="text-3xl font-extrabold">{data.peminjaman.approved}</p>
                  <p className="text-xs text-ink-300 mt-1">Disetujui</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <p className="text-3xl font-extrabold">{data.peminjaman.dikembalikan}</p>
                  <p className="text-xs text-ink-300 mt-1">Dikembalikan</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-300">Tingkat pengembalian</span>
                  <span className="text-sm font-bold text-sage-400">
                    {data.peminjaman.total > 0
                      ? Math.round((data.peminjaman.dikembalikan / data.peminjaman.total) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sage-400 to-sage-500 rounded-full transition-all duration-1000"
                    style={{
                      width: `${data.peminjaman.total > 0
                        ? (data.peminjaman.dikembalikan / data.peminjaman.total) * 100
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alerts Card */}
          {(data.peminjaman.overdue > 0 || data.tools.zero_available_stock > 0) && (
            <div className="bg-coral-50 dark:bg-coral-900/20 border border-coral-100 dark:border-coral-800 rounded-2xl p-5 animate-[reveal-up_0.5s_ease-out_0.4s_both]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-coral-100 dark:bg-coral-900/40 rounded-lg">
                  <AlertTriangle size={18} className="text-coral-600 dark:text-coral-400" />
                </div>
                <div>
                  <h3 className="font-bold text-coral-900 dark:text-coral-300">Perhatian Diperlukan</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-coral-700 dark:text-coral-400">
                    {data.peminjaman.overdue > 0 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-coral-500 rounded-full" />
                        {data.peminjaman.overdue} peminjaman terlambat
                      </li>
                    )}
                    {data.tools.zero_available_stock > 0 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-coral-500 rounded-full" />
                        {data.tools.zero_available_stock} alat habis stok
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Server Status */}
          <div className="bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-2xl p-5 animate-[reveal-up_0.5s_ease-out_0.5s_both]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-500 dark:text-ink-400">Status Sistem</span>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sage-500"></span>
                </span>
                <span className="text-sm font-bold text-sage-600 dark:text-sage-400">Operasional</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== PEMINJAM DASHBOARD ====================
interface PeminjamDashboardProps {
  user: any;
  greeting: string;
  navigate: any;
}

const PeminjamDashboard: React.FC<PeminjamDashboardProps> = ({ user, greeting, navigate }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden bg-white dark:bg-ink-900 rounded-3xl border border-ink-100 dark:border-ink-800 p-8 lg:p-12 animate-[reveal-up_0.5s_ease-out_both]">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-brand-100 dark:from-brand-500/20 via-brand-50 dark:via-brand-500/5 to-transparent rounded-full blur-3xl opacity-40 -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-sage-100 dark:from-sage-500/20 to-transparent rounded-full blur-3xl opacity-40 -ml-32 -mb-32" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 rounded-full text-sm font-semibold mb-4">
            <Sparkles size={14} />
            <span>Selamat datang kembali</span>
          </div>

          <h1 className="text-3xl lg:text-5xl font-extrabold text-ink-900 dark:text-white tracking-tight text-balance">
            {greeting}, <span className="text-brand-500">{user?.name?.split(' ')[0]}</span>
          </h1>

          <p className="mt-4 text-lg text-ink-500 dark:text-ink-400 max-w-xl font-medium leading-relaxed">
            Jelajahi katalog alat kami dan ajukan peminjaman dengan mudah.
            Semua proses dilakukan secara digital.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/tools')}
              className="btn-primary group"
            >
              <span className="flex items-center gap-2">
                <Box size={18} />
                Lihat Katalog Alat
                <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
            </button>
            <button
              onClick={() => navigate('/peminjaman')}
              className="btn-secondary"
            >
              <History size={18} />
              Riwayat Peminjaman
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="stagger-children">
        <h2 className="text-sm font-bold text-ink-400 uppercase tracking-wider mb-4 px-1">
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickActionCard
            icon={<Box size={24} />}
            title="Katalog Alat"
            description="Lihat semua alat tersedia"
            onClick={() => navigate('/tools')}
          />
          <QuickActionCard
            icon={<CalendarClock size={24} />}
            title="Ajukan Peminjaman"
            description="Buat permintaan baru"
            onClick={() => navigate('/tools')}
            accent
          />
          <QuickActionCard
            icon={<History size={24} />}
            title="Riwayat Saya"
            description="Pantau status peminjaman"
            onClick={() => navigate('/peminjaman')}
          />
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger-children">
        <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 p-6 animate-[reveal-up_0.5s_ease-out_0.3s_both]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-ocean-50 dark:bg-ocean-900/30 rounded-xl">
              <Users size={22} className="text-ocean-500 dark:text-ocean-400" />
            </div>
            <div>
              <h3 className="font-bold text-ink-900 dark:text-white">Profil Anda</h3>
              <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{user?.email}</p>
              <div className="mt-3">
                <span className="role-badge role-peminjam">
                  <Sparkles size={12} />
                  Peminjam
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl p-6 text-white animate-[reveal-up_0.5s_ease-out_0.4s_both]">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-bold">Tips Peminjaman</h3>
              <p className="text-sm text-brand-100 mt-1 leading-relaxed">
                Pastikan mengecek ketersediaan alat dan tentukan durasi peminjaman dengan tepat
                untuk menghindari denda keterlambatan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== COMPONENTS ====================

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'brand' | 'sage' | 'coral' | 'ocean' | 'violet';
  highlight?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  pulse?: boolean;
  isPrice?: boolean;
}

const accentStyles = {
  brand: {
    bg: 'bg-brand-50 dark:bg-brand-900/30',
    text: 'text-brand-600 dark:text-brand-400',
    border: 'border-brand-100',
    glow: 'shadow-glow-brand',
  },
  sage: {
    bg: 'bg-sage-50 dark:bg-sage-900/30',
    text: 'text-sage-600 dark:text-sage-400',
    border: 'border-sage-100',
    glow: 'shadow-glow-sage',
  },
  coral: {
    bg: 'bg-coral-50 dark:bg-coral-900/30',
    text: 'text-coral-600 dark:text-coral-400',
    border: 'border-coral-100',
    glow: 'shadow-glow-coral',
  },
  ocean: {
    bg: 'bg-ocean-50 dark:bg-ocean-900/30',
    text: 'text-ocean-600 dark:text-ocean-400',
    border: 'border-ocean-100',
    glow: '',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-900/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-100',
    glow: '',
  },
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accent,
  highlight,
  pulse,
  isPrice,
}) => {
  const styles = accentStyles[accent];

  return (
    <div
      className={`stat-card group ${highlight ? 'ring-2 ring-coral-200 dark:ring-coral-800' : ''}`}
      style={{ '--stat-accent': accent === 'coral' ? '#F43F5E' : accent === 'brand' ? '#F97316' : accent === 'sage' ? '#22C55E' : accent === 'ocean' ? '#0EA5E9' : '#8B5CF6' } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${styles.bg} ${styles.text} transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        {pulse && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
          </span>
        )}
        {highlight && !pulse && (
          <span className="px-2 py-0.5 bg-coral-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
            Alert
          </span>
        )}
      </div>

      <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1">{title}</p>
      <p className={`${isPrice ? 'text-xl' : 'text-3xl'} font-extrabold text-ink-900 dark:text-white tracking-tight metric-value`}>
        {value}
      </p>
      <p className="text-xs text-ink-500 dark:text-ink-400 mt-1.5 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${highlight ? 'bg-coral-500' : 'bg-ink-300 dark:bg-ink-600'}`} />
        {subtitle}
      </p>
    </div>
  );
};

interface ActivityItemProps {
  activity: any;
  index: number;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, index }) => {
  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('buat')) return <Package size={16} />;
    if (action.includes('approve') || action.includes('setuju')) return <ClipboardCheck size={16} />;
    if (action.includes('return') || action.includes('kembali')) return <History size={16} />;
    return <TrendingUp size={16} />;
  };

  return (
    <div
      className="activity-item group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 group-hover:text-brand-500 transition-all">
        {getActionIcon(activity.action)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-700 dark:text-ink-300">
          <span className="font-bold text-ink-900 dark:text-white">{activity.user_name || 'System'}</span>
          {' '}
          <span className="text-ink-500 dark:text-ink-400">{activity.action}</span>
          {' '}
          <span className="font-semibold">{activity.entity_type}</span>
          {activity.entity_id && (
            <span className="text-ink-400 font-mono text-xs ml-1">#{activity.entity_id}</span>
          )}
        </p>
        <p className="text-xs text-ink-400 mt-1">
          {new Date(activity.created_at).toLocaleString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short'
          })}
        </p>
      </div>
      <ChevronRight size={16} className="text-ink-300 dark:text-ink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

const EmptyActivity: React.FC = () => (
  <div className="px-6 py-16 text-center">
    <div className="w-16 h-16 bg-ink-50 dark:bg-ink-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <Clock size={24} className="text-ink-300 dark:text-ink-600" />
    </div>
    <p className="text-ink-500 dark:text-ink-400 font-medium">Belum ada aktivitas tercatat</p>
    <p className="text-sm text-ink-400 dark:text-ink-500 mt-1">Aktivitas sistem akan muncul di sini</p>
  </div>
);

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon, title, description, onClick, accent }) => (
  <button
    onClick={onClick}
    className={`quick-action text-left w-full ${accent ? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
  >
    <div className={`quick-action-icon mb-3 ${accent ? 'text-brand-500' : 'text-ink-400'}`}>
      {icon}
    </div>
    <h3 className="font-bold text-ink-900 dark:text-white">{title}</h3>
    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{description}</p>
  </button>
);

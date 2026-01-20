import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 flex">
      <div className="hidden lg:flex lg:w-[55%] bg-ink-900 dark:bg-ink-900 relative overflow-hidden items-center justify-center p-16">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] -ml-48 -mb-48" />

        <div className="relative z-10 w-full max-w-lg">
          <div className="flex items-center gap-3 mb-12 animate-slide-up">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Wrench size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">ToolVault</span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.15] text-white mb-8 animate-slide-up [animation-delay:100ms]">
            Kelola Peminjaman<br />Alat dengan <span className="text-blue-500">Presisi.</span>
          </h1>

          <div className="space-y-6 animate-slide-up [animation-delay:200ms]">
            <div className="flex gap-4">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-blue-500" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Manajemen Inventaris Real-time</h3>
                <p className="text-ink-400 text-sm leading-relaxed">Pantau ketersediaan alat secara akurat di setiap workshop dan lab.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-blue-500" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Alur Kerja Peminjaman Digital</h3>
                <p className="text-ink-400 text-sm leading-relaxed">Proses request dan pengembalian yang cepat tanpa ribet administrasi manual.</p>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-white/10 animate-slide-up [animation-delay:300ms]">
            <p className="text-ink-500 text-sm">
              &copy; 2026 ToolVault. Enterprise Resource Planning for Makers.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Wrench size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight text-ink-900 dark:text-white">ToolVault</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-ink-900 dark:text-white mb-3">Selamat Datang</h2>
            <p className="text-ink-500 dark:text-ink-400">Masukkan kredensial Anda untuk melanjutkan ke dashboard.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl text-sm font-medium flex gap-3 items-center animate-shake">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Alamat Email"
              type="email"
              name="email"
              placeholder="nama@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                label="Kata Sandi"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[38px] text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Button type="submit" loading={loading} className="w-full h-12 text-base mt-4 shadow-lg shadow-blue-500/20">
              Masuk Sekarang
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-500 dark:text-ink-400 font-medium">
            Belum memiliki akses?{' '}
            <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold transition-colors">
              Daftar Akun
            </Link>
          </p>

          <div className="mt-12 p-6 bg-ink-50 dark:bg-ink-900 rounded-3xl border border-ink-100 dark:border-ink-700">
            <p className="text-[11px] text-ink-400 font-bold uppercase tracking-wider mb-3">Akun Demo (Akses Cepat):</p>
            <div className="grid grid-cols-1 gap-2 text-xs text-ink-600 dark:text-ink-300 font-mono">
              <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-ink-800 border border-ink-100 dark:border-ink-700">
                <span>admin@example.com</span>
                <span className="text-ink-400">admin123</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-ink-800 border border-ink-100 dark:border-ink-700">
                <span>petugas@example.com</span>
                <span className="text-ink-400">petugas123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
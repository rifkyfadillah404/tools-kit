import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Eye, EyeOff, ArrowRight, ShieldCheck, Gauge, Sparkles } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

type AuthMode = 'login' | 'register';

interface LoginPageProps {
  initialMode?: AuthMode;
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = useMemo(() => {
    if (password.length === 0) return { level: 0, text: '' };
    if (password.length < 6) return { level: 1, text: 'Terlalu pendek' };
    if (password.length < 8) return { level: 2, text: 'Cukup' };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 4, text: 'Kuat' };
    return { level: 3, text: 'Baik' };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } =
        mode === 'login'
          ? await authApi.login(email, password)
          : await authApi.register(name, email, password);

      setAuth(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          (mode === 'login'
            ? 'Login gagal. Periksa kembali email dan password Anda.'
            : 'Registrasi gagal. Periksa data Anda.')
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError('');
  };

  return (
    <div className="h-screen overflow-hidden bg-ink-950 relative">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-ocean-500/15 blur-3xl" />

      <div className="relative h-full w-full flex items-center justify-center p-3 sm:p-5 lg:p-8">
        <div className="w-full max-w-5xl h-[min(94vh,760px)] rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40 grid lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden lg:flex flex-col justify-between p-9 xl:p-11 bg-gradient-to-br from-ink-900/95 via-ink-900 to-ink-800/90 border-r border-white/10">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white">
                  <Wrench size={18} />
                </div>
                <div>
                  <p className="text-white font-display font-bold text-lg tracking-tight">ToolVault</p>
                  <p className="text-ink-500 text-xs uppercase tracking-wider">Inventory Command Center</p>
                </div>
              </div>

              <div className="mt-10">
                <p className="text-brand-400 font-mono text-xs uppercase tracking-[0.2em] mb-3">/ Equipment Intelligence</p>
                <h1 className="text-4xl xl:text-5xl font-display font-bold leading-tight text-white">
                  Satu Portal,
                  <br />
                  Semua Alur
                  <span className="text-brand-500"> Peminjaman</span>
                </h1>
                <p className="mt-5 text-ink-400 leading-relaxed max-w-md">
                  Masuk atau daftar dalam satu halaman yang ringkas, cepat, dan siap pakai untuk operasional harian.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-ink-200">
                  <ShieldCheck size={16} className="text-sage-400" />
                  <span className="text-sm">Akses aman dengan role-based permission</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-ink-200">
                  <Gauge size={16} className="text-ocean-400" />
                  <span className="text-sm">Proses auth cepat untuk tim workshop</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-ink-300">
                <Sparkles size={14} className="text-brand-400" />
                <p className="text-xs uppercase tracking-wider">Demo Access</p>
              </div>
              <p className="mt-2 text-sm text-white font-mono">admin@example.com / admin123</p>
            </div>
          </section>

          <section className="h-full flex flex-col justify-center p-5 sm:p-7 lg:p-8 xl:p-9 bg-ink-50 dark:bg-ink-950/70">
            <div className="lg:hidden flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white">
                <Wrench size={18} />
              </div>
              <div>
                <p className="text-ink-900 dark:text-white font-display font-bold tracking-tight">ToolVault</p>
                <p className="text-xs text-ink-500">Auth Portal</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-mono uppercase tracking-wider text-brand-500 mb-2">Secure Authentication</p>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-900 dark:text-white">
                {mode === 'login' ? 'Selamat Datang Kembali' : 'Buat Akun Baru'}
              </h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                {mode === 'login'
                  ? 'Masukkan kredensial untuk lanjut ke dashboard.'
                  : 'Lengkapi data untuk mulai menggunakan sistem.'}
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-1 mb-4">
              <button
                type="button"
                onClick={() => switchMode('login')}
                aria-pressed={mode === 'login'}
                className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'bg-ink-900 text-white dark:bg-brand-600'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                aria-pressed={mode === 'register'}
                className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'register'
                    ? 'bg-ink-900 text-white dark:bg-brand-600'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-coral-200 dark:border-coral-500/20 bg-coral-50 dark:bg-coral-500/10 px-3 py-2 text-sm text-coral-600 dark:text-coral-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <Input
                  label="Nama Lengkap"
                  type="text"
                  name="name"
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

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
                  placeholder={mode === 'register' ? 'Minimal 6 karakter' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-[38px] text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {mode === 'register' && strength.text && (
                <div className="-mt-1 space-y-1">
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 rounded-full ${
                          level <= strength.level
                            ? level <= 1
                              ? 'bg-coral-500'
                              : level <= 2
                              ? 'bg-brand-500'
                              : level === 3
                              ? 'bg-ocean-500'
                              : 'bg-sage-500'
                            : 'bg-ink-200 dark:bg-ink-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Kekuatan password: {strength.text}</p>
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                icon={<ArrowRight size={18} />}
                className="w-full h-11 mt-1 !bg-gradient-to-r !from-brand-500 !to-brand-600 hover:!from-brand-600 hover:!to-brand-700 !flex-row-reverse"
              >
                {mode === 'login' ? 'Masuk ke Dashboard' : 'Daftar Akun'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-ink-500 dark:text-ink-400">
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="font-semibold text-brand-500 hover:text-brand-600"
              >
                {mode === 'login' ? 'Daftar sekarang' : 'Masuk sekarang'}
              </button>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

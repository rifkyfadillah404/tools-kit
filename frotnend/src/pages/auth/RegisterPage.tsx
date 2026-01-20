import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
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
      const { data } = await authApi.register(name, email, password);
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Wrench size={22} />
          </div>
          <span className="text-xl font-semibold tracking-tight text-ink-900 dark:text-white">ToolVault</span>
        </div>

        <h2 className="text-2xl font-bold text-ink-900 dark:text-white mb-2">Buat Akun Baru</h2>
        <p className="text-ink-500 dark:text-ink-400 mb-8">Daftar untuk mulai meminjam alat</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nama Lengkap"
            type="text"
            name="name"
            placeholder="Masukkan nama lengkap"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-6">
            Daftar
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
};

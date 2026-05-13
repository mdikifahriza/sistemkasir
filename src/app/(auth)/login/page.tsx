'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Input, Typography, App } from 'antd';
import { useConnectivity } from '@/components/providers/ConnectivityProvider';
import { useAuthStore } from '@/store/authStore';

const { Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const { isOnline, offlineMessage } = useConnectivity();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { message: messageApi } = App.useApp();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isOnline) {
      messageApi.error('Login tidak bisa dilakukan saat internet terputus.');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Masuk gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-slate-50 px-4 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#303030] dark:bg-[#141414] sm:p-8">
        <div className="mb-6 space-y-2 text-center">
          <p className="m-0 text-xs uppercase tracking-[0.3em] text-slate-500">POS PRO</p>
          <Title level={4} className="m-0 text-slate-900 dark:text-slate-100">
            Masuk ke akun Anda
          </Title>
          <p className="m-0 text-sm text-slate-500">
            Aplikasi ini berjalan full online dan membutuhkan koneksi internet aktif.
          </p>
        </div>

        {!isOnline ? (
          <Alert
            type="error"
            showIcon
            title="Internet tidak tersedia"
            description={offlineMessage}
            className="mb-4"
          />
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Nama Pengguna
            </label>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="owner / manager / kasir1 / kasir2"
              required
              size="large"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Kata Sandi
            </label>
            <Input.Password
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="123"
              required
              size="large"
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            className="w-full bg-[#10b981] hover:bg-[#059669]"
            size="large"
            loading={loading}
            disabled={!isOnline}
          >
            Masuk
          </Button>
        </form>

        <div className="mt-6 space-y-2 text-xs text-slate-500">
          <p className="m-0 font-semibold text-slate-700 dark:text-slate-300">Akun Demo:</p>
          <div className="grid grid-cols-2 gap-2">
            <span>owner</span>
            <span>manager</span>
            <span>kasir1</span>
            <span>kasir2</span>
            <span className="col-span-2">password: 123</span>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Input, Button, Typography } from 'antd';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-slate-50 px-4 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-[#303030] dark:bg-[#141414] sm:p-8">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 m-0">Atur Ulang Kata Sandi</p>
          <Title level={4} className="m-0 text-slate-900 dark:text-slate-100">Lupa kata sandi</Title>
          <p className="text-sm text-slate-500 m-0">Masukkan email Anda, kami akan mengirim tautan atur ulang.</p>
        </div>

        <form className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Email</label>
            <Input type="email" placeholder="nama@tokomu.com" size="large" />
          </div>
          <Button type="primary" className="w-full bg-[#10b981] hover:bg-[#059669]" size="large">
            Kirim tautan atur ulang
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link className="text-sm text-[#10b981] hover:underline" href="/login">
            Kembali ke masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

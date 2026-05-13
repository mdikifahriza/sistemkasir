export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="text-2xl font-semibold text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-muted">Periksa kembali alamat yang Anda tuju.</p>
      </div>
    </div>
  );
}

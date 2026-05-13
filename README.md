# Resto POS System - Dashboard & POS

Pusat kendali operasional restoran berbasis Next.js, Ant Design, dan Prisma.

## Fitur Utama
- **POS (Point of Sale)**: Dine-in, Takeaway, Platform Online.
- **Shift Management**: Rekonsiliasi 2-Arah (Cash & Digital).
- **Keuangan**: Pencatatan pengeluaran & HPP (Food Cost).
- **KDS**: Kitchen Display System real-time.
- **Reporting**: Laba rugi dan tren penjualan.

## Setup
1. `npm install`
2. Configure `.env`
3. `npx prisma db push`
4. `npm run dev`

## Environment penting

- `DATABASE_URL`
- `PAYMENT_GATEWAY_BASE_URL`
- `PAYMENT_GATEWAY_API_KEY`
- `GATEWAY_INTERNAL_API_KEY` bila dipakai sebagai fallback internal key
- `ORDERING_APP_BASE_URL`

## Catatan integrasi Xendit

- `sistemkasir` tidak lagi membuat pembayaran Xendit langsung.
- Saat kasir memilih `Xendit`, POS membuat transaksi dan order dengan status `pending`.
- Backend lalu meminta `payment-gateway` membuat Xendit Payment Session hosted checkout.
- Halaman pilihan QRIS/VA/e-wallet muncul di hosted checkout Xendit, bukan di iframe `sistemkasir`.
- Webhook Xendit harus masuk ke `payment-gateway`, lalu `payment-gateway` melakukan callback ke `POST /api/internal/gateway/payment-events`.
- Transaksi di `sistemkasir` baru boleh berubah `completed` setelah callback/status gateway mengonfirmasi pembayaran sukses.

## Akun Default
- User: `admin`
- Password: `admin123`

---
*Built with ❤️ for professional restaurant operations.*

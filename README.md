# 🎓 AfterSchola LMS

AfterSchola adalah platform **Learning Management System (LMS)** berbasis web untuk pembelajaran interaktif dan gamifikasi.  
Dibangun dengan **Next.js**, **TypeScript**, **Supabase**, dan **Mantine UI**.

---

## 🚀 Fitur Utama

- Manajemen Pengguna (Admin, Instructor, Student)
- Manajemen Kursus dan Transaksi
- Integrasi Pembayaran Xendit dan Cetak Struk
- Sistem Gamifikasi (XP, Level, Badge)
- Modul Coding Interaktif (Blockly)
- Dashboard Statistik Real-time
- Forum Diskusi dan Komentar
- Sertifikat Otomatis (PDF Generator)

---

## 🛠️ Teknologi

| Komponen | Teknologi |
|-----------|------------|
| Frontend | Next.js 15 (App Router), TypeScript |
| UI Library | Mantine UI, Tabler Icons |
| Database & Auth | Supabase (PostgreSQL) |
| Payment Gateway | Xendit API |
| File Storage | Supabase Storage |
| Deployment | Vercel |
| Styling | Tailwind + Mantine Theme |
| PDF Generator | jsPDF / pdf-lib |

---

## 📂 Struktur Direktori

```
afterschola/
├─ app/
│  ├─ admin/
│  ├─ instructor/
│  ├─ user/
│  ├─ api/
│  └─ (auth pages, dashboards)
├─ components/
│  ├─ ui/
│  ├─ ImageCarousel.tsx
│  └─ CertificateThumbnail.tsx
├─ hooks/
│  └─ useAuth.ts
├─ lib/
│  ├─ supabaseClient.ts
│  ├─ supabaseServer.ts
│  └─ utils.ts
├─ public/
│  ├─ logo.png
│  └─ favicon.ico
├─ styles/
│  └─ globals.css
└─ README.md
```

---

## ⚙️ Instalasi

```bash
# 1. Clone repository
git clone https://github.com/mfajarjati/lms-afterschola.git
cd afterschola

# 2. Install dependencies
npm install

# 3. Buat file .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
XENDIT_SECRET_KEY=xxx

# 4. Jalankan server development
npm run dev

# 5. Akses di browser
http://localhost:3000
```

---

## 🧩 Fitur Tambahan

- **RLS Policies Supabase** – Keamanan per role pengguna  
- **Trigger PostgreSQL** – Otomatis update point dan waktu  
- **Custom Theme Mantine**  
  ```
  --primary-color: #1e386a;
  --secondary-color: #f6d457;
  ```

---

## 🧾 Modul Penting

| Modul | Deskripsi |
|--------|------------|
| `/api/user/certificates` | Generate sertifikat otomatis |
| `/api/transactions` | Proses dan validasi pembayaran |
| `/api/instructor/discussions` | Forum dan komentar |
| `/app/user/profile` | Profil dan pencapaian siswa |
| `/app/admin/dashboard` | Statistik keuangan dan pengguna |

---

## 👨‍💻 Pengembang

**Ichwan, Cahya, Fajar, Albab**  
Universitas Pendidikan Indonesia (UPI) - Teknik Komputer  
Fokus: *Education platform & gamified learning system.*

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah **MIT License**  
Bebas digunakan untuk pengembangan non-komersial dan edukasi.

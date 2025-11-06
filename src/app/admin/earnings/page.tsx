"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Container,
  Stack,
  Title,
  Group,
  Text,
  Badge,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  Paper,
  ActionIcon,
  Tooltip,
  Pagination,
  Card,
  Loader,
  Alert,
  Skeleton,
} from "@mantine/core";
import {
  IconReportMoney,
  IconCash,
  IconTrendingUp,
  IconEye,
  IconPrinter,
  IconArrowUp,
  IconArrowDown,
  IconReceipt2,
  IconFileTypeCsv,
  IconX,
  IconCalendar,
} from "@tabler/icons-react";
import { DatePickerInput } from "@mantine/dates";
import "dayjs/locale/id";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../../hooks/useAuth";

// Thermal receipt constants
const RECEIPT_INFO = {
  addressLines: [
    "Jl. Cisaranten Wetan No.167 A, Cisaranten Wetan,",
    "Kec. Cinambo, Kota Bandung, Jawa Barat 40294",
    "Telp: +62 823-3808-9915",
  ],
  footer: [
    "Terima kasih atas kepercayaan Anda",
    "www.afterschola.com",
    "support@afterschola.com",
  ],
};

type TxRow = {
  id: string;
  date: string;
  user_id?: string | null;
  user_name: string;
  course_id: string;
  course_title: string;
  amount: number;
  method: string;
  status: string;
};

// Animated counter component
function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const stepValue = value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep <= steps) {
        setDisplayValue(Math.floor(stepValue * currentStep));
      } else {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString("id-ID")}</>;
}

// Reusable StatCard
function StatCard({
  label,
  value,
  Icon,
  isLoading,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  isLoading?: boolean;
}) {
  const bg = "var(--primary-color)";
  const iconBadgeBg = "var(--secondary-color)";
  const textColor = "#ffffff";

  return (
    <Card
      withBorder
      padding="lg"
      radius="md"
      shadow="sm"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: bg,
        minHeight: 170,
        transition: "transform .25s, box-shadow .25s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 22px -6px rgba(0,0,0,.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--mantine-shadow-sm)";
      }}
    >
      <Text size="xs" c={textColor} fw={600} tt="uppercase" mb={4}>
        {label}
      </Text>
      <div
        style={{
          margin: 16,
          width: 56,
          height: 56,
          borderRadius: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: iconBadgeBg,
        }}
      >
        <Icon size={32} color="#1e3769" />
      </div>
      {isLoading ? (
        <Loader size="sm" color="white" />
      ) : (
        <Title order={2} style={{ lineHeight: 1 }} c={textColor}>
          {value}
        </Title>
      )}
    </Card>
  );
}

export default function AdminEarningsPage() {
  const { user } = useAuth();

  // Filter states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [totals, setTotals] = useState<{
    gross: number;
    commission: number;
    net: number;
  }>({ gross: 0, commission: 0, net: 0 });
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [commissionPercent] = useState(10);

  // Transaction list
  const [tx, setTx] = useState<{
    items: TxRow[];
    total: number;
    page: number;
    limit: number;
  }>({ items: [], total: 0, page: 1, limit: 10 });

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "date" | "course_title" | "user_name" | "status" | "amount"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [opened, setOpened] = useState(false);
  const [activeTx, setActiveTx] = useState<TxRow | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((tx.total || 0) / (tx.limit || 10))),
    [tx.total, tx.limit]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (d: string | Date) => {
    const dt = typeof d === "string" ? new Date(d) : d;
    const day = dt.getDate().toString().padStart(2, "0");
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const month = monthNames[dt.getMonth()];
    const year = dt.getFullYear();
    const dayName = dayNames[dt.getDay()];
    return `${dayName}, ${day} ${month} ${year}`;
  };

  const fetchData = useCallback(
    async (page = 1, limit = tx.limit || 10) => {
      if (!user?.id) return;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          userId: user.id,
          page: String(page),
          limit: String(limit),
          sortBy,
          sortDir,
        });

        if (search) params.set("q", search);
        if (startDate) {
          const dateStr =
            typeof startDate === "string" ? startDate : startDate.toISOString();
          params.set("startDate", dateStr);
        }
        if (endDate) {
          const dateStr =
            typeof endDate === "string" ? endDate : endDate.toISOString();
          params.set("endDate", dateStr);
        }

        const res = await fetch(`/api/admin/earnings?${params.toString()}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Gagal memuat data");
        }

        setTx({
          items: json.items || [],
          total: json.total || 0,
          page,
          limit,
        });

        setTotals({
          gross: json.summary?.totalRevenue || 0,
          commission:
            (json.summary?.totalRevenue || 0) * (commissionPercent / 100),
          net: json.summary?.totalRevenue || 0,
        });

        setTotalTransactions(json.summary?.totalOrders || 0);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err instanceof Error ? err.message : "Gagal memuat data");
        notifications.show({
          title: "Error",
          message: err instanceof Error ? err.message : "Gagal memuat data",
          color: "red",
        });
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [
      user?.id,
      search,
      startDate,
      endDate,
      sortBy,
      sortDir,
      commissionPercent,
      tx.limit,
    ]
  );

  useEffect(() => {
    fetchData(1);
  }, [user?.id, search, startDate, endDate, sortBy, sortDir]);
  // Initial full-page overlay loader (only on first navigation)
  if (loading && initialLoad) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              width="64"
              height="64"
              viewBox="0 0 64 64"
              style={{
                animation: "spinDiamond 1.2s linear infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            >
              <rect
                x="12"
                y="12"
                width="40"
                height="40"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="8"
                rx="4"
                ry="4"
                transform="rotate(45 32 32)"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f6d457" />
                  <stop offset="100%" stopColor="#1e3769" />
                </linearGradient>
              </defs>
            </svg>
          ))}
        </div>
        <style>{`
          @keyframes spinDiamond {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  // Fetch ALL transactions (for export/print)
  const fetchAllTransactions = async (): Promise<TxRow[]> => {
    if (!user?.id) return [];

    try {
      const params = new URLSearchParams({
        userId: user.id,
        page: "1",
        limit: "10000", // Fetch all
        sortBy,
        sortDir,
      });

      if (search) params.set("q", search);
      if (startDate) {
        const dateStr =
          typeof startDate === "string" ? startDate : startDate.toISOString();
        params.set("startDate", dateStr);
      }
      if (endDate) {
        const dateStr =
          typeof endDate === "string" ? endDate : endDate.toISOString();
        params.set("endDate", dateStr);
      }

      const res = await fetch(`/api/admin/earnings?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat data");
      }

      return json.items || [];
    } catch (err) {
      console.error("Fetch all error:", err);
      notifications.show({
        title: "Error",
        message: "Gagal memuat data untuk export",
        color: "red",
      });
      return [];
    }
  };

  // Export functions
  const toCSV = (rows: TxRow[]) => {
    const headers = [
      "Tanggal",
      "Siswa",
      "Kursus",
      "Metode",
      "Status",
      "Jumlah",
    ];
    const data = rows.map((r) => [
      formatDate(r.date),
      r.user_name,
      r.course_title,
      displayMethod(r.method),
      statusLabel(r.status),
      r.amount.toString(),
    ]);
    return [headers, ...data].map((row) => row.join(",")).join("\n");
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportList = async (type: "csv" | "pdf") => {
    // Fetch all transactions based on current filters
    const allRows = await fetchAllTransactions();

    if (allRows.length === 0) {
      notifications.show({
        title: "Tidak Ada Data",
        message: "Tidak ada transaksi untuk diekspor",
        color: "yellow",
      });
      return;
    }

    if (type === "csv") {
      const csv = toCSV(allRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `pendapatan-admin-${Date.now()}.csv`);
      notifications.show({
        title: "Berhasil!",
        message: "Data berhasil diekspor ke CSV",
        color: "green",
      });
    } else {
      // Print thermal receipts for all rows
      printAllThermalReceipts(allRows);
    }
  };

  const tableHTML = (rows: TxRow[]) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan Pendapatan - Admin</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; }
        h2 { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #1e3769; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .total { font-weight: bold; background-color: #e3f2fd; }
      </style>
    </head>
    <body>
      <h2>Laporan Pendapatan - AfterSchola (Admin)</h2>
      <p>Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}</p>
      ${
        startDate || endDate
          ? `<p>Periode: ${startDate ? formatDate(startDate) : "Awal"} - ${
              endDate ? formatDate(endDate) : "Sekarang"
            }</p>`
          : ""
      }
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Siswa</th>
            <th>Kursus</th>
            <th>Metode</th>
            <th>Status</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${formatDate(r.date)}</td>
              <td>${r.user_name}</td>
              <td>${r.course_title}</td>
              <td>${displayMethod(r.method)}</td>
              <td>${statusLabel(r.status)}</td>
              <td>${formatCurrency(r.amount)}</td>
            </tr>
          `
            )
            .join("")}
          <tr class="total">
            <td colspan="6" style="text-align: right;">Total:</td>
            <td>${formatCurrency(
              rows.reduce((sum, r) => sum + r.amount, 0)
            )}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  const displayMethod = (method: string) => {
    if (!method) return method;
    const key = method.toLowerCase();
    const map: Record<string, string> = {
      bca: "BCA",
      bni: "BNI",
      bri: "BRI",
      mandiri: "Mandiri",
      bca_va: "BCA VA",
      bni_va: "BNI VA",
      bri_va: "BRI VA",
      mandiri_va: "Mandiri VA",
      gopay: "GoPay",
      ovo: "OVO",
      dana: "DANA",
      shopeepay: "ShopeePay",
      qris: "QRIS",
      credit_card: "Kartu Kredit",
      debit_card: "Kartu Debit",
    };
    return map[key] || method.toUpperCase();
  };

  const statusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "paid" || s === "completed") return "Selesai";
    if (s === "pending") return "Menunggu";
    if (s === "failed") return "Gagal";
    return status;
  };

  const statusLabelUI = (status: string) => {
    const s = status.toLowerCase();
    if (s === "paid" || s === "completed")
      return (
        <Badge color="green" variant="light">
          Selesai
        </Badge>
      );
    if (s === "pending")
      return (
        <Badge color="yellow" variant="light">
          Menunggu
        </Badge>
      );
    if (s === "failed")
      return (
        <Badge color="red" variant="light">
          Gagal
        </Badge>
      );
    return <Badge variant="light">{status}</Badge>;
  };

  const printThermalReceipt = (t: TxRow) => {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;

    const now = new Date();
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk Pembayaran</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            color: #000;
          }
          .logo { text-align: center; margin-bottom: 8px; }
          h1 { font-size: 14px; text-align: center; margin: 6px 0; font-weight: bold; }
          .addr, .ftr { text-align: center; font-size: 10px; margin: 4px 0; line-height: 1.3; }
          .sep { text-align: center; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .lbl { font-weight: bold; }
          .total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; }
          @media print {
            body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="logo">
          <img src="/logo-text.png" style="width: 80px; height: auto;" alt="AfterSchola" />
        </div>
        <h1>AFTERSCHOLA</h1>
        <div class="addr">
          ${RECEIPT_INFO.addressLines.join("<br>")}
        </div>
        <div class="sep">========================================</div>
        <div class="row">
          <span class="lbl">No. Transaksi:</span>
          <span>${t.id.slice(0, 12)}</span>
        </div>
        <div class="row">
          <span class="lbl">Tanggal:</span>
          <span>${formatDate(t.date)} ${new Date(t.date).toLocaleTimeString(
      "id-ID",
      { hour: "2-digit", minute: "2-digit" }
    )}</span>
        </div>
        <div class="row">
          <span class="lbl">Cetak:</span>
          <span>${now.toLocaleString("id-ID", {
            dateStyle: "short",
            timeStyle: "short",
          })}</span>
        </div>
        <div class="sep">========================================</div>
        <div class="row">
          <span class="lbl">Siswa:</span>
          <span>${t.user_name}</span>
        </div>
        <div class="row">
          <span class="lbl">Kursus:</span>
          <span style="text-align: right; max-width: 60%;">${
            t.course_title
          }</span>
        </div>
        <div class="row">
          <span class="lbl">Metode:</span>
          <span>${displayMethod(t.method)}</span>
        </div>
        <div class="row">
          <span class="lbl">Status:</span>
          <span>${statusLabel(t.status)}</span>
        </div>
        <div class="sep">========================================</div>
        <div class="row total">
          <span>TOTAL:</span>
          <span>${formatCurrency(t.amount)}</span>
        </div>
        <div class="sep">========================================</div>
        <div class="ftr">
          ${RECEIPT_INFO.footer.join("<br>")}
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  const printAllThermalReceipts = async (rowsToUse?: TxRow[]) => {
    // If no rows provided, fetch all transactions
    const rows = rowsToUse || (await fetchAllTransactions());

    if (rows.length === 0) {
      notifications.show({
        title: "Tidak Ada Data",
        message: "Tidak ada transaksi untuk dicetak",
        color: "yellow",
      });
      return;
    }

    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) {
      notifications.show({
        title: "Gagal",
        message: "Popup diblokir oleh browser",
        color: "red",
      });
      return;
    }

    const now = new Date();
    const day = now.getDate().toString().padStart(2, "0");
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const dateStr = `${day} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const totalAmount = rows.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = rows.length;

    const transactionRows = rows
      .map((t, idx) => {
        const tDate = new Date(t.date);
        const tDay = tDate.getDate().toString().padStart(2, "0");
        const tMonth = monthNames[tDate.getMonth()].substring(0, 3);
        return `
      <tr>
        <td>${idx + 1}</td>
        <td>${tDay} ${tMonth}</td>
        <td>${t.user_name.substring(0, 15)}</td>
        <td>${t.course_title.substring(0, 20)}</td>
        <td style="text-align:right;">${formatCurrency(t.amount)}</td>
      </tr>
    `;
      })
      .join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan Transaksi Admin</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          margin: 0;
          padding: 10mm;
          color: #000;
        }
        .logo { text-align: center; margin-bottom: 8px; }
        .logo img { width: 100px; height: auto; }
        h1 { font-size: 18px; text-align: center; margin: 8px 0; }
        .addr { text-align: center; margin-bottom: 12px; line-height: 1.4; }
        .info { margin: 12px 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
        }
        th, td {
          border: 1px solid #333;
          padding: 6px;
          text-align: left;
        }
        th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .summary {
          margin-top: 12px;
          padding: 8px;
          background: #f9f9f9;
          border: 1px solid #333;
        }
        .ftr { text-align: center; margin-top: 16px; font-size: 10px; }
        @media print {
          header, footer { display: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="logo"><img src="/logo-text.png" alt="Logo" /></div>
      <h1>LAPORAN TRANSAKSI ADMIN</h1>
      <div class="addr">
        ${RECEIPT_INFO.addressLines.join("<br>")}
      </div>
      <div class="info">
        <div><b>Tanggal Cetak:</b> ${dateStr}, ${timeStr}</div>
        <div><b>Periode:</b> ${
          startDate && endDate
            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
            : "Semua Data"
        }</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Siswa</th>
            <th>Kursus</th>
            <th style="text-align:right;">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRows}
        </tbody>
      </table>
      <div class="summary">
        <div><b>Total Transaksi:</b> ${transactionCount}</div>
        <div style="font-size:14px;margin-top:6px;"><b>TOTAL PENDAPATAN:</b> ${formatCurrency(
          totalAmount
        )}</div>
      </div>
      <div class="ftr">
        ${RECEIPT_INFO.footer.join("<br>")}
      </div>
      <script>window.print();</script>
    </body>
    </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}> Total pendapatan</Title>
            <Text size="sm" c="dimmed">
              Kelola semua pendapatan platform
            </Text>
          </div>
        </Group>

        {/* Stats Cards */}
        <Group grow>
          <StatCard
            label="Total Pendapatan"
            value={
              loading ? (
                <Loader size="sm" color="white" />
              ) : (
                formatCurrency(totals.gross)
              )
            }
            Icon={IconReportMoney}
            isLoading={loading}
          />
          <StatCard
            label="Total Transaksi"
            value={
              loading ? (
                <Loader size="sm" color="white" />
              ) : (
                <AnimatedCounter value={totalTransactions} />
              )
            }
            Icon={IconCash}
            isLoading={loading}
          />
          <StatCard
            label="Rata-rata per Order"
            value={
              loading ? (
                <Loader size="sm" color="white" />
              ) : (
                formatCurrency(
                  totalTransactions > 0 ? totals.gross / totalTransactions : 0
                )
              )
            }
            Icon={IconTrendingUp}
            isLoading={loading}
          />
        </Group>

        {/* Filters */}
        <Paper withBorder p="md">
          <Stack gap="md">
            <Text fw={600} size="sm">
              Filter & Pencarian
            </Text>
            <Group grow>
              <TextInput
                placeholder="Cari siswa atau kursus..."
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <DatePickerInput
                placeholder="Tanggal Mulai"
                value={startDate}
                onChange={(val) => setStartDate(val as Date | null)}
                clearable
                leftSection={<IconCalendar size={16} />}
                locale="id"
                valueFormat="DD MMMM YYYY"
              />
              <DatePickerInput
                placeholder="Tanggal Akhir"
                value={endDate}
                onChange={(val) => setEndDate(val as Date | null)}
                clearable
                leftSection={<IconCalendar size={16} />}
                locale="id"
                valueFormat="DD MMMM YYYY"
              />
            </Group>
            {(startDate || endDate || search) && (
              <Group>
                {startDate && (
                  <Badge
                    rightSection={
                      <ActionIcon
                        size="xs"
                        color="blue"
                        radius="xl"
                        variant="transparent"
                        onClick={() => setStartDate(null)}
                      >
                        <IconX size={10} />
                      </ActionIcon>
                    }
                  >
                    Dari: {formatDate(startDate)}
                  </Badge>
                )}
                {endDate && (
                  <Badge
                    rightSection={
                      <ActionIcon
                        size="xs"
                        color="blue"
                        radius="xl"
                        variant="transparent"
                        onClick={() => setEndDate(null)}
                      >
                        <IconX size={10} />
                      </ActionIcon>
                    }
                  >
                    Sampai: {formatDate(endDate)}
                  </Badge>
                )}
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Action Buttons */}
        <Group>
          <Button
            leftSection={<IconFileTypeCsv size={18} />}
            variant="light"
            onClick={() => exportList("csv")}
            disabled={tx.items.length === 0}
          >
            Export CSV
          </Button>
          <Button
            leftSection={<IconReceipt2 size={18} />}
            variant="light"
            color="green"
            onClick={() => exportList("pdf")}
            disabled={tx.items.length === 0}
          >
            Cetak PDF
          </Button>
        </Group>

        {/* Transactions Table */}
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {!loading && tx.items.length === 0 ? (
          <Alert color="blue" title="Tidak ada data">
            Belum ada transaksi yang sesuai dengan filter
          </Alert>
        ) : (
          <Paper withBorder style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 800 }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => toggleSort('date')}>
                        <Text size="sm" fw={600}>Tanggal</Text>
                        {sortBy === 'date' && (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => toggleSort('user_name')}>
                        <Text size="sm" fw={600}>Siswa</Text>
                        {sortBy === 'user_name' && (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => toggleSort('course_title')}>
                        <Text size="sm" fw={600}>Kursus</Text>
                        {sortBy === 'course_title' && (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                      </Group>
                    </Table.Th>
                    <Table.Th>Metode</Table.Th>
                    <Table.Th>
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                        <Text size="sm" fw={600}>Status</Text>
                        {sortBy === 'status' && (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                      </Group>
                    </Table.Th>
                    <Table.Th>
                      <Group gap={4} style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>
                        <Text size="sm" fw={600}>Jumlah</Text>
                        {sortBy === 'amount' && (sortDir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />)}
                      </Group>
                    </Table.Th>
                    <Table.Th>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loading && !initialLoad
                    ? Array.from({ length: tx.limit || 10 }).map((_, idx) => (
                        <Table.Tr key={`skeleton-${idx}`}>
                          <Table.Td><Skeleton height={12} width={140} /></Table.Td>
                          <Table.Td><Skeleton height={12} width={160} /></Table.Td>
                          <Table.Td><Skeleton height={12} width={200} /></Table.Td>
                          <Table.Td><Skeleton height={12} width={90} /></Table.Td>
                          <Table.Td><Skeleton height={22} width={70} radius="xl" /></Table.Td>
                          <Table.Td><Skeleton height={12} width={110} /></Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Skeleton height={28} width={28} circle />
                              <Skeleton height={28} width={28} circle />
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    : tx.items.map((t) => (
                        <Table.Tr key={t.id}>
                          <Table.Td><Text size="sm">{formatDate(t.date)}</Text></Table.Td>
                          <Table.Td><Text size="sm" fw={500}>{t.user_name}</Text></Table.Td>
                          <Table.Td><Text size="sm" lineClamp={1}>{t.course_title}</Text></Table.Td>
                          <Table.Td><Text size="sm">{displayMethod(t.method)}</Text></Table.Td>
                          <Table.Td>{statusLabelUI(t.status)}</Table.Td>
                          <Table.Td><Text size="sm" fw={600}>{formatCurrency(t.amount)}</Text></Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Tooltip label="Lihat Detail">
                                <ActionIcon variant="light" color="blue" onClick={() => { setActiveTx(t); setOpened(true); }}>
                                  <IconEye size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Print Struk">
                                <ActionIcon variant="light" color="green" onClick={() => printThermalReceipt(t)}>
                                  <IconReceipt2 size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                </Table.Tbody>
              </Table>
            </div>
            <Group justify="space-between" p="md" wrap="wrap">
              <Text size="sm" c="dimmed">
                {loading ? 'Memuat…' : `Menampilkan ${tx.items.length} dari ${tx.total} transaksi`}
              </Text>
              <Pagination
                value={tx.page}
                onChange={(p) => fetchData(p)}
                total={totalPages}
              />
            </Group>
          </Paper>
        )}
      </Stack>

      {/* Detail Modal */}
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Detail Transaksi"
        size="md"
      >
        {activeTx && (
          <Stack gap="md">
            <Paper withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    No. Transaksi
                  </Text>
                  <Text size="sm" fw={500} style={{ fontFamily: "monospace" }}>
                    {activeTx.id.slice(0, 16)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Tanggal
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatDate(activeTx.date)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Siswa
                  </Text>
                  <Text size="sm" fw={500}>
                    {activeTx.user_name}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Kursus
                  </Text>
                  <Text
                    size="sm"
                    fw={500}
                    style={{ maxWidth: "60%", textAlign: "right" }}
                  >
                    {activeTx.course_title}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Metode Pembayaran
                  </Text>
                  <Text size="sm" fw={500}>
                    {displayMethod(activeTx.method)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Status
                  </Text>
                  {statusLabelUI(activeTx.status)}
                </Group>
                <Paper withBorder p="sm" bg="#f0f9ff">
                  <Group justify="space-between">
                    <Text fw={600}>Total</Text>
                    <Text fw={700} size="lg" c="blue">
                      {formatCurrency(activeTx.amount)}
                    </Text>
                  </Group>
                </Paper>
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => printThermalReceipt(activeTx)}
                leftSection={<IconPrinter size={18} />}
              >
                Print Struk
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}

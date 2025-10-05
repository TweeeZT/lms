"use client";

import {
  Container,
  Title,
  Text,
  Grid,
  Card,
  Stack,
  Group,
  Badge,
  Table,
  Button,
  Skeleton,
  TextInput,
  Modal,
  ActionIcon,
  Divider,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import {
  IconWallet,
  IconArrowsSort,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconDownload,
  IconPrinter,
  IconReceipt,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { notifications } from "@mantine/notifications";

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
    const duration = 1000; // 1 detik
    const steps = 60;
    const stepValue = value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(stepValue * currentStep));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <>{displayValue.toLocaleString("id-ID")}</>;
}

// Reusable StatCard (vertical) dengan animasi
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
        position: "relative",
        overflow: "hidden",
        transition: "transform .25s, box-shadow .25s",
        background: bg,
        minHeight: 170,
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
      <Title order={2} style={{ lineHeight: 1 }} c={textColor}>
        {isLoading ? "..." : value}
      </Title>
    </Card>
  );
}

export default function InstructorEarningsPage() {
  const { user } = useAuth();
  // date range states (default empty)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // no trend UI currently
  const [totals, setTotals] = useState<{
    gross: number;
    commission: number;
    net: number;
  }>({ gross: 0, commission: 0, net: 0 });
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [commissionPercent, setCommissionPercent] = useState(10);
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
    return dt.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const fetchData = async (page = 1, limit = tx.limit || 10) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        instructorId: user.id,
        page: String(page),
        limit: String(limit),
        search,
        sortBy,
        sortDir,
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/instructor/earnings?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat data");

      setTotals(json.totals);
      setTotalTransactions(
        json.totalTransactions || json.transactions?.total || 0
      );
      setCommissionPercent(Number(json.commissionPercent || 10));
      setTx(json.transactions);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // trigger fetch when filters change
  useEffect(() => {
    if (!user) return;

    fetchData(1, tx.limit || 10);
  }, [user, startDate, endDate, search, sortBy, sortDir]);

  // sorting toggle
  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  // exports
  const toCSV = (rows: TxRow[]) => {
    const header = [
      "ID",
      "Tanggal",
      "Nama Siswa",
      "Kursus",
      "Jumlah",
      "Status",
    ].join(",");
    const body = rows
      .map((r) =>
        [
          r.id,
          formatDate(r.date),
          r.user_name,
          r.course_title,
          String(r.amount),
          statusLabelUI(r.status),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    return header + "\n" + body;
  };
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportList = (type: "csv" | "pdf") => {
    if (tx.items.length === 0) {
      notifications.show({
        title: "Tidak Ada Data",
        message: "Tidak ada transaksi untuk diekspor",
        color: "yellow",
      });
      return;
    }

    const dateRange =
      startDate && endDate ? `${startDate}_hingga_${endDate}` : "semua_data";

    if (type === "csv") {
      const csv = toCSV(tx.items);
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8;" }),
        `transaksi_${dateRange}.csv`
      );
      notifications.show({
        title: "Berhasil",
        message: "CSV berhasil diunduh",
        color: "green",
      });
    } else {
      const html = `<!doctype html><title>Transaksi</title><style>body{font:12px system-ui} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} th{text-align:left}</style><h3>Transaksi (${
        startDate && endDate ? `${startDate} - ${endDate}` : "Semua Data"
      })</h3>${tableHTML(tx.items)}</body>`;
      const w = window.open("", "_blank");
      if (!w) {
        notifications.show({
          title: "Gagal",
          message: "Popup diblokir oleh browser",
          color: "red",
        });
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };
  const tableHTML = (rows: TxRow[]) => {
    const head = `<thead><tr><th>Tanggal</th><th>Kursus</th><th>Nama Siswa</th><th>Status</th><th>Jumlah</th></tr></thead>`;
    const body = rows
      .map(
        (r) =>
          `<tr><td>${formatDate(r.date)}</td><td>${r.course_title}</td><td>${
            r.user_name
          }</td><td>${statusLabelUI(r.status)}</td><td>${formatCurrency(
            r.amount
          )}</td></tr>`
      )
      .join("");
    return `<table>${head}<tbody>${body}</tbody></table>`;
  };
  const downloadSingleCSV = (r: TxRow) => {
    const csv = toCSV([r]);
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `transaction_${r.id}.csv`
    );
  };

  const printSingle = (r: TxRow) => {
    const html = `<!doctype html><title>Transaksi #${
      r.id
    }</title><style>body{font:12px system-ui} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} th{text-align:left}</style><h3>Detail Transaksi</h3>${tableHTML(
      [r]
    )}`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  // Thermal Receipt Print
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

  const displayMethod = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes("qris")) return "QRIS";
    if (m.includes("bca")) return "BCA Virtual Account";
    if (m.includes("mandiri")) return "Mandiri Virtual Account";
    if (m.includes("bni")) return "BNI Virtual Account";
    if (m.includes("bri")) return "BRI Virtual Account";
    if (m.includes("gopay")) return "GoPay";
    if (m.includes("ovo")) return "OVO";
    if (m.includes("dana")) return "DANA";
    return method;
  };

  const statusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "paid") return "Berhasil";
    if (s === "pending") return "Menunggu";
    if (s === "cancelled" || s === "failed") return "Gagal";
    return status;
  };

  const statusLabelUI = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "paid") return "Berhasil";
    if (s === "pending") return "Menunggu";
    if (s === "cancelled" || s === "failed") return "Gagal";
    if (s === "processing") return "Diproses";
    return status;
  };

  const printThermalReceipt = (t: TxRow) => {
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
    const dateStr = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const line = (text = "") => `<div class="ln">${text}</div>`;
    const hr = `<pre style="margin:0;text-align:center;">------------------------------------------</pre>`;
    const pad = (label: string, value: string) => {
      const max = 40;
      const raw = `${label}${value}`;
      return raw.length > max ? raw.slice(0, max) : raw;
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Struk Pembayaran</title>
      <style>
        @page {
          size: A5;
          margin: 0;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          width: 80mm;
          margin: 0 auto;
          padding: 10mm;
          color: #000;
        }
        .logo { text-align: center; margin-bottom: 8px; }
        .logo img { width: 90px; height: auto; }
        h1 { font-size: 16px; text-align: center; margin: 6px 0; }
        .addr, .ftr { text-align: center; white-space: pre-line; margin-bottom: 6px; }
        .sep {
          text-align: center;
          font-size: 12px;
          margin: 0;
          line-height: 1;
        }
        .ln { display: block; }
        .center { text-align: center; }
        @media print {
          header, footer { display: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="logo"><img src="/logo-text.png" alt="Logo" /></div>
      <h1>STRUK PEMBAYARAN</h1>
      <div class="addr">${RECEIPT_INFO.addressLines.join("<br>")}</div>
      ${hr}
      ${line(pad("ID Transaksi: ", t.id))}
      ${line(pad("Tanggal: ", dateStr))}
      ${line(pad("Waktu: ", timeStr))}
      ${line(pad("Nama: ", t.user_name))}
      ${line(pad("Kursus: ", t.course_title))}
      ${line(pad("Metode: ", displayMethod(t.method)))}
      ${line(pad("Status: ", statusLabel(t.status)))}
      ${hr}
      ${line(pad("Total Bayar: ", formatCurrency(t.amount)))}
      ${hr}
      <div class="ftr">${RECEIPT_INFO.footer.join("<br>")}</div>
      <div class="center" style="margin-top:16px;font-size:10px;">Dicetak: ${dateStr} ${timeStr}</div>
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  // Print all transactions (thermal style)
  const printAllThermalReceipts = () => {
    if (tx.items.length === 0) {
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
    const dateStr = now.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const hr = `<pre style="margin:0;text-align:center;">------------------------------------------</pre>`;

    const totalAmount = tx.items.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = tx.items.length;

    const transactionRows = tx.items
      .map(
        (t, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${new Date(t.date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
        })}</td>
        <td>${t.user_name.substring(0, 15)}</td>
        <td>${t.course_title.substring(0, 20)}</td>
        <td style="text-align:right;">${formatCurrency(t.amount)}</td>
      </tr>
    `
      )
      .join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Laporan Transaksi</title>
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
      <h1>LAPORAN TRANSAKSI INSTRUKTUR</h1>
      <div class="addr">
        ${RECEIPT_INFO.addressLines.join("<br>")}
      </div>
      ${hr}
      <div class="info">
        <strong>Periode:</strong> ${
          startDate && endDate ? `${startDate} s/d ${endDate}` : "Semua Data"
        }<br>
        <strong>Dicetak:</strong> ${dateStr} ${timeStr}<br>
        <strong>Total Transaksi:</strong> ${transactionCount} transaksi
      </div>
      
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Tanggal</th>
            <th>Nama Siswa</th>
            <th>Kursus</th>
            <th>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRows}
        </tbody>
      </table>

      <div class="summary">
        <strong>RINGKASAN</strong><br>
        Total Transaksi: ${transactionCount} transaksi<br>
        <strong>Total Pendapatan: ${formatCurrency(totalAmount)}</strong>
      </div>

      ${hr}
      <div class="ftr">${RECEIPT_INFO.footer.join("<br>")}</div>
      
      <script>
        window.onload = () => {
          window.print();
          window.onafterprint = () => window.close();
        };
      </script>
    </body>
    </html>
    `;

    w.document.write(html);
    w.document.close();
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>Penghasilan Instruktur</Title>
          <Text size="sm" c="dimmed">
            Total Pendapatan anda dari kursus yang diikuti siswa
          </Text>
        </div>

        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="end" wrap="wrap">
              <Button
                leftSection={<IconPrinter size={16} />}
                variant="light"
                color="blue"
                onClick={printAllThermalReceipts}
                disabled={tx.items.length === 0}
              >
                Export PDF
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="default"
                onClick={() => exportList("csv")}
                disabled={tx.items.length === 0}
              >
                Export CSV
              </Button>
            </Group>
            <Divider my={4} />
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="sm" wrap="wrap">
                <DateInput
                  label="Tanggal Mulai"
                  placeholder="Pilih tanggal mulai"
                  value={startDate ? new Date(startDate) : null}
                  onChange={(d) =>
                    setStartDate(
                      d ? new Date(d).toISOString().slice(0, 10) : ""
                    )
                  }
                  clearable
                />
                <DateInput
                  label="Tanggal Akhir"
                  placeholder="Pilih tanggal akhir"
                  value={endDate ? new Date(endDate) : null}
                  onChange={(d) =>
                    setEndDate(d ? new Date(d).toISOString().slice(0, 10) : "")
                  }
                  clearable
                />
              </Group>
              <Group gap="sm">
                <Button
                  variant="default"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setTotals({ gross: 0, commission: 0, net: 0 });
                    setTx({ items: [], total: 0, page: 1, limit: tx.limit });
                  }}
                  disabled={loading || (!startDate && !endDate)}
                >
                  Reset
                </Button>
                <Button
                  className="btn-primary"
                  onClick={() => fetchData(1, tx.limit)}
                  disabled={loading || !startDate || !endDate}
                >
                  Terapkan
                </Button>
              </Group>
            </Group>
          </Stack>
        </Card>

        {error && (
          <Card radius="md" padding="md" withBorder>
            <Text c="red" size="sm">
              {error}
            </Text>
          </Card>
        )}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <StatCard
              label="Total Pendapatan"
              value={
                <>
                  Rp <AnimatedCounter value={totals.gross} />
                </>
              }
              Icon={IconWallet}
              isLoading={loading}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <StatCard
              label="Jumlah Transaksi"
              value={<AnimatedCounter value={totalTransactions} />}
              Icon={IconReceipt}
              isLoading={loading}
            />
          </Grid.Col>
        </Grid>

        <Card padding="lg" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Transaksi</Title>
            <TextInput
              placeholder="Cari nama siswa atau judul kursus"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              miw={260}
            />
          </Group>
          <Table highlightOnHover withTableBorder withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Group gap={6} wrap="nowrap">
                    <span>Tanggal</span>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleSort("date")}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Group gap={6} wrap="nowrap">
                    <span>Kursus</span>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleSort("course_title")}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Group gap={6} wrap="nowrap">
                    <span>Nama Siswa</span>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleSort("user_name")}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Group gap={6} wrap="nowrap">
                    <span>Status</span>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleSort("status")}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
                <Table.Th ta="right">
                  <Group gap={6} justify="right" wrap="nowrap">
                    <span>Jumlah</span>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => toggleSort("amount")}
                    >
                      <IconArrowsSort size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Th>
                <Table.Th ta="right">Aksi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading && tx.items.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Skeleton height={24} />
                  </Table.Td>
                </Table.Tr>
              )}
              {tx.items.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td>{formatDate(t.date)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {t.course_title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{t.user_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        t.status === "completed"
                          ? "green"
                          : t.status === "pending"
                          ? "orange"
                          : "red"
                      }
                      variant="light"
                    >
                      {statusLabelUI(t.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700}>{formatCurrency(t.amount)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={6} justify="right">
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="blue"
                        onClick={() => printThermalReceipt(t)}
                        title="Print Thermal"
                      >
                        <IconPrinter size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        onClick={() => {
                          setActiveTx(t);
                          setOpened(true);
                        }}
                        title="Lihat Detail"
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => downloadSingleCSV(t)}
                        title="Download CSV"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {tx.items.length === 0 && !loading && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed">
                      Belum ada transaksi.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">
              Hal {tx.page} dari {totalPages}
            </Text>
            <Group gap={4}>
              <ActionIcon
                variant="light"
                disabled={tx.page <= 1 || loading}
                onClick={() => fetchData(tx.page - 1, tx.limit)}
              >
                <IconArrowLeft size={16} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                disabled={tx.page >= totalPages || loading}
                onClick={() => fetchData(tx.page + 1, tx.limit)}
              >
                <IconArrowRight size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Card>

        <Modal
          opened={opened}
          onClose={() => setOpened(false)}
          title="Detail Transaksi"
          centered
        >
          {activeTx ? (
            <Stack gap="xs">
              <Text size="sm">
                <b>Tanggal:</b> {formatDate(activeTx.date)}
              </Text>
              <Text size="sm">
                <b>Kursus:</b> {activeTx.course_title}
              </Text>
              <Text size="sm">
                <b>Nama Siswa:</b> {activeTx.user_name}
              </Text>
              <Text size="sm">
                <b>Status:</b> {statusLabelUI(activeTx.status)}
              </Text>
              <Text size="sm">
                <b>Jumlah:</b> {formatCurrency(activeTx.amount)}
              </Text>
              <Group mt="sm">
                <Button
                  leftSection={<IconDownload size={16} />}
                  onClick={() => downloadSingleCSV(activeTx)}
                >
                  Unduh CSV
                </Button>
                <Button
                  variant="light"
                  onClick={() => printThermalReceipt(activeTx)}
                >
                  Cetak PDF
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text size="sm">Tidak ada data.</Text>
          )}
        </Modal>
      </Stack>
    </Container>
  );
}

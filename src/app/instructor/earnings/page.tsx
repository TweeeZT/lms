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
  IconCash,
  IconTrendingUp,
  IconWallet,
  IconArrowsSort,
  IconArrowLeft,
  IconArrowRight,
  IconEye,
  IconDownload,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";

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

// Reusable StatCard (vertical) as requested
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
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
        {value}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      "id",
      "date",
      "user_name",
      "course_title",
      "amount",
      "status",
    ].join(",");
    const body = rows
      .map((r) =>
        [r.id, r.date, r.user_name, r.course_title, String(r.amount), r.status]
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
    if (type === "csv") {
      const csv = toCSV(tx.items);
      downloadBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8;" }),
        `transactions_${startDate}_${endDate}.csv`
      );
    } else {
      const html = `<!doctype html><title>Transaksi</title><style>body{font:12px system-ui} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} th{text-align:left}</style><h3>Transaksi (${startDate} - ${endDate})</h3>${tableHTML(
        tx.items
      )}</body>`;
      const w = window.open("", "_blank");
      if (!w) return;
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
          }</td><td>${r.status}</td><td>${formatCurrency(r.amount)}</td></tr>`
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

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>Penghasilan Instruktur</Title>
          <Text size="sm" c="dimmed">
            Komisi admin {commissionPercent}%. Pendapatan instruktur sudah
            dipotong komisi.
          </Text>
        </div>

        <Card withBorder padding="md" radius="md">
          <Stack gap="xs">
            <Group justify="end" wrap="wrap">
              <Button
                leftSection={<IconDownload size={16} />}
                variant="default"
                onClick={() => exportList("csv")}
                disabled={tx.items.length === 0 || !startDate || !endDate}
              >
                Export CSV
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="default"
                onClick={() => exportList("pdf")}
                disabled={tx.items.length === 0 || !startDate || !endDate}
              >
                Export PDF
              </Button>
            </Group>
            <Divider my={4} />
            <Group justify="space-between" align="center" wrap="wrap">
              <Group gap="sm" wrap="wrap">
                <DateInput
                  label="Sebelum (Mulai dari)"
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
                  label="Sesudah (hingga)"
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
          <Grid.Col span={{ base: 12, md: 12 }}>
            <StatCard
              label="Pendapatan Instruktur"
              value={formatCurrency(totals.net)}
              Icon={IconWallet}
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
                      {t.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700}>{formatCurrency(t.amount)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Group gap={6} justify="right">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEye size={14} />}
                        onClick={() => {
                          setActiveTx(t);
                          setOpened(true);
                        }}
                      >
                        Lihat
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconDownload size={14} />}
                        onClick={() => downloadSingleCSV(t)}
                      >
                        Unduh
                      </Button>
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
                <b>Status:</b> {activeTx.status}
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
                <Button variant="light" onClick={() => printSingle(activeTx)}>
                  Cetak/PDF
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

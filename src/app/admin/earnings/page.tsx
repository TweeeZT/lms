"use client";
import { useState, useEffect } from "react";
import {
  Container,
  Stack,
  Title,
  Grid,
  Group,
  Text,
  Badge,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  Divider,
  Paper,
  Collapse,
  ActionIcon,
  Tooltip,
  Pagination,
  Card,
} from "@mantine/core";
import {
  IconReportMoney,
  IconCash,
  IconTrendingUp,
  IconEye,
  IconPrinter,
  IconChevronDown,
  IconChevronUp,
  IconArrowUp,
  IconArrowDown,
  IconReceipt2,
} from "@tabler/icons-react";
import { useAuth } from "../../../hooks/useAuth";

// Added constants for thermal receipt (monospaced 300px style)
const RECEIPT_INFO = {
  header: "AFTERSCHOLA",
  // Could map campus/company info; using placeholders derived from landing/user profile
  addressLines: [
    "Jl. Cisaranten Wetan No.167 A, Cisaranten Wetan,",
    "Kec. Cinambo, Kota Bandung, Jawa Barat 40294",
    "Telp: +62 823-3808-9915",
  ],
  footer: [
    "Terima kasih telah belajar di",
    "Afterschola",
    "Terus tingkatkan skill dan kemampuan Anda!",
  ],
  width: 300,
};

// Types
interface FinanceTransaction {
  id: string;
  date: string; // ISO string
  userId?: string | null;
  userName: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  method: string;
  status: string; // paid | pending | failed
}

interface PayoutRow {
  id: string;
  instructorName: string;
  amount: number;
  status: string; // paid | pending
  date: string;
}

interface SummaryData {
  totalRevenue: number;
  totalOrders: number;
  avgOrder: number;
  activeInstructors: number;
}

// Reusable StatCard (vertical) similar style to admin
function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  // Use brand gradient and soft frosted icon badge
  const bg = "var(--primary-color)"; // defined in globals.css
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

// Helpers
function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function displayMethod(m: string) {
  if (!m) return m;
  const key = m.toLowerCase();
  const map: Record<string, string> = {
    bca: "BCA",
    bni: "BNI",
    bri: "BRI",
    mandiri: "Mandiri",
    permata: "Permata",
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
  if (map[key]) return map[key];
  // Fallback: prettify underscores
  if (key.includes("_")) {
    return key
      .split("_")
      .map((p) => (p.length ? p[0].toUpperCase() + p.slice(1) : p))
      .join(" ");
  }
  return /^[a-z0-9]+$/.test(key) ? key.toUpperCase() : m;
}

function statusLabel(id: string) {
  const s = id.toLowerCase();
  if (s === "paid") return "Selesai";
  if (s === "pending") return "Menunggu";
  if (s === "failed") return "Gagal";
  return id;
}

// NEW: Thermal receipt printer (simple window.print approach)
function printThermalReceipt(t: FinanceTransaction) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID");
  const timeStr = now
    .toLocaleTimeString("id-ID", { hour12: false })
    .replace(/\.\d+$/, "");
  const line = (text: string = "") => `<div class="ln">${text}</div>`;
  const hr = `<div class="sep">--------------------------------</div>`;
  const pad = (label: string, value: string) => {
    const max = 30; // width reference
    const raw = `${label}${value}`;
    return raw.length > max ? raw.slice(0, max) : raw;
  };
  const html = `<!DOCTYPE html><html><head><title>Struk ${t.id}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size:12px; width:${
      RECEIPT_INFO.width
    }px; margin:0 auto; padding:8px; color:#000; }
    h1 { font-size:14px; text-align:center; margin:0 0 4px; letter-spacing:1px; }
    .addr, .ftr { text-align:center; white-space:pre-line; }
    .sep { text-align:center; font-size:12px; }
    .ln { display:block; }
    .row { display:flex; justify-content:space-between; }
    .amt { font-weight:700; }
    .center { text-align:center; }
    @media print { body { width:${RECEIPT_INFO.width}px; } }
  </style></head><body>
  <h1>${RECEIPT_INFO.header}</h1>
  <div class="addr">${RECEIPT_INFO.addressLines.join("\n")}</div>
  ${hr}
  ${line(pad("ID: ", t.id))}
  ${line(pad("Tanggal: ", dateStr))}
  ${line(pad("Waktu: ", timeStr))}
  ${line(pad("User: ", t.userName))}
  ${line(pad("Kursus: ", t.courseTitle))}
  ${line(pad("Metode: ", displayMethod(t.method)))}
  ${line(pad("Status: ", statusLabel(t.status)))}
  ${hr}
  ${line(pad("Jumlah: ", rupiah(t.amount)))}
  ${hr}
  <div class="ftr">${RECEIPT_INFO.footer.join("\n")}</div>
  <div class="center" style="margin-top:6px;font-size:10px;">Dicetak: ${dateStr} ${timeStr}</div>
  <script>window.print(); window.onafterprint = () => window.close();</script>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}

export default function AdminEarningsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [, setPayouts] = useState<PayoutRow[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrder: 0,
    activeInstructors: 0,
  });
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [methodOptions, setMethodOptions] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewItem, setViewItem] = useState<FinanceTransaction | null>(null);

  type SortCol =
    | "date"
    | "userName"
    | "courseTitle"
    | "method"
    | "status"
    | "amount";
  const [sortBy, setSortBy] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pageSize = 5;
  const [page, setPage] = useState(1);

  async function fetchData() {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("userId", user.id); // optional context
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (method) params.set("method", method);
      params.set(
        "sortBy",
        sortBy === "userName"
          ? "user_name"
          : sortBy === "courseTitle"
          ? "course_title"
          : sortBy
      );
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/admin/earnings?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (res.status === 403) throw new Error("Akses ditolak (bukan admin)");
        throw new Error(json.error || "Gagal memuat data");
      }
      const mapped: FinanceTransaction[] = (json.items || []).map(
        (r: {
          id: string;
          date: string;
          user_id?: string | null;
          user_name: string;
          course_id: string;
          course_title: string;
          amount?: number | string;
          method: string;
          status: string;
        }) => ({
          id: r.id,
          date: r.date,
          userId: r.user_id,
          userName: r.user_name,
          courseId: r.course_id,
          courseTitle: r.course_title,
          amount: Number(r.amount || 0),
          method: r.method,
          status: r.status,
        })
      );
      setTransactions(mapped);
      setSummary(
        json.summary || {
          totalRevenue: 0,
          totalOrders: 0,
          avgOrder: 0,
          activeInstructors: 0,
        }
      );
      setPayouts(json.instructorTotals || []);
      setMethodOptions(Array.isArray(json.methods) ? json.methods : []);
      setTotalPages(Math.max(1, Math.ceil((json.total || 0) / pageSize)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
      setTransactions([]);
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, q, status, method, sortBy, sortDir, page]);

  function changeSort(col: SortCol) {
    setPage(1);
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function printTransaction(t: FinanceTransaction) {
    const w = window.open("", "_blank", "width=600,height=720");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${t.id}</title>
      <style>
        body { font-family: system-ui, Arial, sans-serif; padding:24px; }
        h1 { font-size:18px; margin:0 0 12px; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        td { padding:6px 4px; vertical-align:top; }
        tr:nth-child(even){ background:#f5f7fa; }
        .total { font-weight:700; }
      </style></head><body>
      <h1>Struk Transaksi</h1>
      <div>ID: <strong>${t.id}</strong></div>
      <div>Tanggal: ${new Date(t.date).toLocaleString("id-ID")}</div>
      <table><tbody>
        <tr><td>User</td><td>${t.userName}</td></tr>
        <tr><td>Kursus</td><td>${t.courseTitle}</td></tr>
        <tr><td>Metode</td><td>${displayMethod(t.method)}</td></tr>
  <tr><td>Status</td><td>${statusLabel(t.status)}</td></tr>
        <tr><td class="total">Jumlah</td><td class="total">${rupiah(
          t.amount
        )}</td></tr>
      </tbody></table>
      <p style="margin-top:24px;font-size:12px;color:#666">Dokumen ini dicetak otomatis dari sistem.</p>
      <script>window.print();</script>
      </body></html>`);
    w.document.close();
  }

  const paged = transactions; // already paginated by server

  return (
    <Container size="xl">
      <style>{`@media print { button, [role=button], input, select { display:none !important;} .mantine-Modal-root, header, nav {display:none !important;} body {background:#fff;} }`}</style>
      <Stack gap="lg">
        <Title order={2}>Keuangan</Title>
        {/* Summary */}
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              label="Total Pendapatan"
              value={rupiah(summary.totalRevenue)}
              Icon={IconReportMoney}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              label="Total Order"
              value={summary.totalOrders}
              Icon={IconTrendingUp}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              label="Rerata Order"
              value={rupiah(summary.avgOrder)}
              Icon={IconCash}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              label="Instruktur Aktif"
              value={summary.activeInstructors}
              Icon={IconCash}
            />
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Text fw={600}>Filter</Text>
              <ActionIcon
                variant="subtle"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-label={
                  filtersOpen ? "Sembunyikan filter" : "Tampilkan filter"
                }
              >
                {filtersOpen ? (
                  <IconChevronUp size={16} />
                ) : (
                  <IconChevronDown size={16} />
                )}
              </ActionIcon>
            </Group>
            <Tooltip label="Cetak semua transaksi">
              <ActionIcon
                variant="light"
                color="blue"
                onClick={() => window.print()}
                aria-label="Print halaman"
              >
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Collapse in={filtersOpen}>
            <Grid gutter="md" mb="xs">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput
                  placeholder="Cari id/user/kursus..."
                  value={q}
                  onChange={(e) => setQ(e.currentTarget.value)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Select
                  placeholder="Status"
                  data={[
                    { value: "paid", label: "Selesai" },
                    { value: "pending", label: "Menunggu" },
                    { value: "failed", label: "Gagal" },
                  ]}
                  value={status}
                  onChange={setStatus}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Select
                  placeholder="Metode"
                  data={methodOptions.map((m) => ({
                    value: m,
                    label: displayMethod(m),
                  }))}
                  value={method}
                  onChange={setMethod}
                  clearable
                />
              </Grid.Col>
            </Grid>
          </Collapse>
        </Paper>

        {/* Transactions */}
        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ position: "relative", overflow: "hidden" }}
        >
          <Group justify="space-between" align="center" mb="md">
            <Title order={3}>Transaksi</Title>
          </Group>
          <div
            style={{
              borderRadius: 8,
              border: "1px solid var(--mantine-color-gray-3)",
              overflowX: "auto",
            }}
          >
            <Table
              striped
              highlightOnHover
              withTableBorder
              withColumnBorders
              horizontalSpacing="md"
              verticalSpacing={6}
              style={{ fontSize: 13, minWidth: 920 }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    onClick={() => changeSort("date")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>Tanggal</span>
                      {sortBy === "date" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("userName")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>User</span>
                      {sortBy === "userName" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("courseTitle")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>Kursus</span>
                      {sortBy === "courseTitle" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("method")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>Metode</span>
                      {sortBy === "method" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("status")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>Status</span>
                      {sortBy === "status" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("amount")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                    align="right"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 6,
                        width: "100%",
                      }}
                    >
                      <span style={{ lineHeight: 1 }}>Jumlah</span>
                      {sortBy === "amount" &&
                        (sortDir === "asc" ? (
                          <IconArrowUp size={12} />
                        ) : (
                          <IconArrowDown size={12} />
                        ))}
                    </div>
                  </Table.Th>
                  <Table.Th>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paged.map((t) => (
                  <Table.Tr key={t.id}>
                    <Table.Td>
                      {new Date(t.date).toLocaleString("id-ID")}
                    </Table.Td>
                    <Table.Td>{t.userName}</Table.Td>
                    <Table.Td style={{ minWidth: 160 }}>
                      {t.courseTitle}
                    </Table.Td>
                    <Table.Td>{displayMethod(t.method)}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          t.status.toLowerCase() === "paid"
                            ? "green"
                            : t.status.toLowerCase() === "pending"
                            ? "yellow"
                            : "red"
                        }
                        variant="light"
                      >
                        {statusLabel(t.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td align="right">{rupiah(t.amount)}</Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEye size={14} />}
                          onClick={() => setViewItem(t)}
                        >
                          Lihat
                        </Button>
                        <Tooltip label="Cetak detail" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={() => printTransaction(t)}
                            aria-label="Print transaksi"
                          >
                            <IconPrinter size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Struk thermal" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={() => printThermalReceipt(t)}
                            aria-label="Print struk thermal"
                          >
                            <IconReceipt2 size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!paged.length && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" size="sm">
                        Tidak ada data
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </div>
          {transactions.length > 0 && (
            <Group justify="space-between" mt="sm" className="no-print">
              <Text size="xs" c="dimmed">
                Halaman {page} dari {totalPages}
              </Text>
              <Pagination
                total={totalPages}
                value={page}
                onChange={setPage}
                size="sm"
                radius="md"
              />
            </Group>
          )}
        </Paper>

        {/* Detail modal */}
        <Modal
          opened={!!viewItem}
          onClose={() => setViewItem(null)}
          title="Detail Transaksi"
          centered
        >
          {viewItem && (
            <Stack gap="xs">
              <Text fw={600}>{viewItem.courseTitle}</Text>
              <Text size="sm" c="dimmed">
                {viewItem.userName} •{" "}
                {new Date(viewItem.date).toLocaleString("id-ID")}
              </Text>
              <Divider />
              <Group justify="space-between">
                <Text>Metode</Text>
                <Text>{displayMethod(viewItem.method)}</Text>
              </Group>
              <Group justify="space-between">
                <Text>Status</Text>
                <Badge
                  color={
                    viewItem.status.toLowerCase() === "paid"
                      ? "green"
                      : viewItem.status.toLowerCase() === "pending"
                      ? "yellow"
                      : "red"
                  }
                >
                  {statusLabel(viewItem.status)}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text>Jumlah</Text>
                <Text fw={700}>{rupiah(viewItem.amount)}</Text>
              </Group>
              <Group justify="end" mt="xs">
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => setViewItem(null)}
                >
                  Tutup
                </Button>
                <Button
                  size="xs"
                  leftSection={<IconPrinter size={14} />}
                  onClick={() => printTransaction(viewItem)}
                >
                  Print
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {error && (
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{ borderColor: "var(--mantine-color-red-5)" }}
          >
            <Text c="red" size="sm">
              {error}
            </Text>
          </Paper>
        )}
        {loading && (
          <Paper p="sm" radius="md" withBorder>
            <Text size="sm" c="dimmed">
              Memuat data...
            </Text>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}

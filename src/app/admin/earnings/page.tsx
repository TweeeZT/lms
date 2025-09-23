"use client";

import { useMemo, useState, useEffect } from "react";
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
  ThemeIcon,
  Pagination,
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
} from "@tabler/icons-react";
import { FinanceTransaction, Payout } from "../../../types";
import {
  computeFinanceSummary,
  payoutsSeed,
  transactionsSeed,
} from "../../../data/finance";

// Reusable StatCard component
function StatCard({
  title,
  value,
  icon,
  accent = "blue",
  footer,
  footerColor,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent?: string;
  footer?: React.ReactNode;
  footerColor?: string;
}) {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg,var(--mantine-color-${accent}-0),var(--mantine-color-${accent}-1))`,
        minHeight: 124,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Group justify="space-between" align="center" ta="center" mb={4}>
        <ThemeIcon variant="light" color={accent} size={42} radius="md">
          {icon}
        </ThemeIcon>
        {footer && (
          <Badge color={footerColor || accent} variant="light">
            {footer}
          </Badge>
        )}
      </Group>
      <div>
        <Text size="xs" tt="uppercase" c="dimmed" fw={600} mb={4} ta="center">
          {title}
        </Text>
        <Text fw={700} style={{ fontSize: 26, lineHeight: 1 }} ta="center">
          {value}
        </Text>
      </div>
    </Paper>
  );
}

function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminEarningsPage() {
  const [transactions] = useState<FinanceTransaction[]>(transactionsSeed);
  const [payouts, setPayouts] = useState<Payout[]>(payoutsSeed);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);

  const [viewItem, setViewItem] = useState<FinanceTransaction | null>(null);

  // sorting & pagination
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

  const summary = useMemo(
    () => computeFinanceSummary(transactions, payouts),
    [transactions, payouts]
  );

  const [filtersOpen, setFiltersOpen] = useState(true);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchQ =
        !q ||
        t.userName.toLowerCase().includes(q.toLowerCase()) ||
        t.courseTitle.toLowerCase().includes(q.toLowerCase()) ||
        t.id.toLowerCase().includes(q.toLowerCase());
      const matchStatus = !status || t.status === status;
      const matchMethod = !method || t.method === method;
      return matchQ && matchStatus && matchMethod;
    });
  }, [transactions, q, status, method]);

  const sorted = useMemo(() => {
    type SortValue = number | string;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: SortValue;
      let vb: SortValue;
      switch (sortBy) {
        case "date":
          va = new Date(a.date).getTime();
          vb = new Date(b.date).getTime();
          break;
        case "amount":
          va = a.amount;
          vb = b.amount;
          break;
        case "userName":
          va = a.userName;
          vb = b.userName;
          break;
        case "courseTitle":
          va = a.courseTitle;
          vb = b.courseTitle;
          break;
        case "method":
          va = a.method;
          vb = b.method;
          break;
        case "status":
          va = a.status;
          vb = b.status;
          break;
        default:
          va = 0;
          vb = 0;
      }
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  useEffect(() => {
    setPage(1);
  }, [q, status, method, sortBy, sortDir]);

  function changeSort(col: SortCol) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function markPayoutPaid(id: string) {
    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "paid" } : p))
    );
  }

  function displayMethod(m: string) {
    if (m.toLowerCase() === "midtrans") return "Bank Transfer";
    if (m.toLowerCase() === "xendit") return "Virtual Account";
    if (m.toLowerCase() === "manual") return "Manual";
    return m;
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
        .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:12px; background:#eee; }
      </style></head><body>
      <h1>Struk Transaksi</h1>
      <div>ID: <strong>${t.id}</strong></div>
      <div>Tanggal: ${new Date(t.date).toLocaleString("id-ID")}</div>
      <table>
        <tbody>
          <tr><td>User</td><td>${t.userName}</td></tr>
          <tr><td>Kursus</td><td>${t.courseTitle}</td></tr>
          <tr><td>Metode</td><td>${displayMethod(t.method)}</td></tr>
          <tr><td>Status</td><td>${t.status}</td></tr>
          <tr><td class="total">Jumlah</td><td class="total">${rupiah(
            t.amount
          )}</td></tr>
        </tbody>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#666">Dokumen ini dicetak otomatis dari sistem.</p>
      <script>window.print();</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <Container size="xl">
      <style>{`
        @media print {
          button, [role=button], input, select { display: none !important; }
          .mantine-Modal-root, .mantine-ActionIcon-root { display:none !important; }
          header, nav { display:none !important; }
          body { background:#fff; }
          .mantine-Table-table { font-size:11px; }
          .no-print { display:none !important; }
        }
      `}</style>
      <Stack gap="lg">
        <Title order={2}>Keuangan</Title>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Pendapatan"
              value={rupiah(summary.totalRevenue)}
              icon={<IconReportMoney size={32} />}
              accent="teal"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Order"
              value={summary.totalOrders}
              icon={<IconTrendingUp size={32} />}
              accent="blue"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Rerata Order"
              value={rupiah(summary.avgOrder)}
              icon={<IconCash size={32} />}
              accent="orange"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Payout Pending"
              value={rupiah(summary.pendingPayouts)}
              icon={<IconCash size={32} />}
              accent="grape"
            />
          </Grid.Col>
        </Grid>

        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Text fw={600}>Filter</Text>
              <ActionIcon
                variant="subtle"
                onClick={() => setFiltersOpen((o) => !o)}
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
                  data={["paid", "pending", "failed"]}
                  value={status}
                  onChange={setStatus}
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 6, md: 3 }}>
                <Select
                  placeholder="Metode"
                  data={["Midtrans", "Xendit", "Manual"]}
                  value={method}
                  onChange={setMethod}
                  clearable
                />
              </Grid.Col>
            </Grid>
          </Collapse>
        </Paper>

        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ position: "relative", overflow: "hidden" }}
        >
          <Group justify="space-between" align="center" mb="md">
            <Title order={3}>Transaksi</Title>
          </Group>

          {/* Duplicate filter form removed (already present above) */}

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
                          t.status === "paid"
                            ? "teal"
                            : t.status === "pending"
                            ? "yellow"
                            : "red"
                        }
                        variant="light"
                      >
                        {t.status}
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
                        <Tooltip label="Cetak" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={() => printTransaction(t)}
                          >
                            <IconPrinter size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {paged.length === 0 && (
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
          <Group
            justify="space-between"
            mt="sm"
            className="no-print"
            style={{ display: sorted.length ? "flex" : "none" }}
          >
            <Text size="xs" c="dimmed">
              Menampilkan {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, sorted.length)} dari {sorted.length}{" "}
              transaksi
            </Text>
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              size="sm"
              radius="md"
            />
          </Group>
        </Paper>

        <Paper
          p="md"
          radius="md"
          withBorder
          style={{ position: "relative", overflow: "hidden" }}
        >
          <Group justify="space-between" mb="md">
            <Title order={3}>Payout Instruktur</Title>
          </Group>

          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--mantine-color-gray-3)",
            }}
          >
            <Table
              striped
              highlightOnHover
              withTableBorder
              withColumnBorders
              horizontalSpacing="md"
              verticalSpacing={6}
              style={{ fontSize: 13 }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tanggal</Table.Th>
                  <Table.Th>Instruktur</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th align="right">Jumlah</Table.Th>
                  <Table.Th>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payouts.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      {new Date(p.date).toLocaleDateString("id-ID")}
                    </Table.Td>
                    <Table.Td>{p.instructorName}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={p.status === "paid" ? "teal" : "yellow"}
                        variant="light"
                      >
                        {p.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td align="right">{rupiah(p.amount)}</Table.Td>
                    <Table.Td>
                      {p.status === "pending" && (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => markPayoutPaid(p.id)}
                        >
                          Tandai Dibayar
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>

        {/* Modal LIHAT (view & print only) */}
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
                    viewItem.status === "paid"
                      ? "teal"
                      : viewItem.status === "pending"
                      ? "yellow"
                      : "red"
                  }
                >
                  {viewItem.status}
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
      </Stack>
    </Container>
  );
}

// Edit / Add forms removed per requirement (view + print only)

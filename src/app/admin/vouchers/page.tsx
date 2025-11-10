"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Group,
  Stack,
  Title,
  ActionIcon,
  Badge,
  Card,
} from "@mantine/core";
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function VoucherAdminPage() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Pagination states
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [editVoucher, setEditVoucher] = useState<any | null>(null);
  // Search/filter states
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  // Sorting state
  const [sortCreated, setSortCreated] = useState<'asc' | 'desc'>('asc');

  // Form states
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    max_uses: 1,
    start_date: "",
    end_date: "",
    is_active: true,
    courses_id: "",
  });

  // Fetch vouchers from Supabase
  useEffect(() => {
    const fetchVouchers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });
      let result: any[] = [];
      if (data && data.length > 0) {
        result = data;
      } else {
        // Dummy data for preview
        result = [
          {
            id: "1",
            code: "DISKON50",
            discount_type: "percentage",
            discount_value: 50,
            max_uses: 100,
            used_count: 10,
            start_date: "2025-11-01",
            end_date: "2025-12-01",
            is_active: true,
            created_by: "admin",
            created_at: "2025-11-01T10:00:00Z",
            courses_id: "C001",
          },
          {
            id: "2",
            code: "VOUCHER100K",
            discount_type: "fixed",
            discount_value: 100000,
            max_uses: 50,
            used_count: 5,
            start_date: "2025-11-05",
            end_date: "2025-12-31",
            is_active: false,
            created_by: "admin",
            created_at: "2025-11-05T09:00:00Z",
            courses_id: "C002",
          },
          {
            id: "3",
            code: "EARLYBIRD",
            discount_type: "percentage",
            discount_value: 20,
            max_uses: 200,
            used_count: 50,
            start_date: "2025-10-15",
            end_date: "2025-11-30",
            is_active: true,
            created_by: "admin",
            created_at: "2025-10-15T08:00:00Z",
            courses_id: "C003",
          },
        ];
      }
      setVouchers(result);
      setLoading(false);
    };
    fetchVouchers();
  }, []);

  // Filter & sort vouchers whenever search/filter/sort changes or vouchers change
  useEffect(() => {
    let filtered = vouchers;
    if (search) {
      filtered = filtered.filter((v) =>
        v.code.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filterStatus !== null) {
      filtered = filtered.filter((v) =>
        filterStatus === "active"
          ? v.is_active
          : !v.is_active
      );
    }
    if (filterType !== null) {
      filtered = filtered.filter((v) => v.discount_type === filterType);
    }
    // Sorting by created_at
    filtered = filtered.slice().sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return sortCreated === 'asc' ? aDate - bDate : bDate - aDate;
    });
    setFilteredVouchers(filtered);
    setPage(1); // Reset ke halaman pertama jika filter berubah
  }, [search, filterStatus, filterType, vouchers, sortCreated]);

  // Handle form change
  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Open modal for add/edit
  const openModal = (voucher?: any) => {
    if (voucher) {
      setEditVoucher(voucher);
      setForm({
        code: voucher.code,
        discount_type: voucher.discount_type,
        discount_value: voucher.discount_value,
        max_uses: voucher.max_uses,
        start_date: voucher.start_date?.slice(0, 16) || "",
        end_date: voucher.end_date?.slice(0, 16) || "",
        is_active: voucher.is_active,
        courses_id: voucher.courses_id || "",
      });
    } else {
      setEditVoucher(null);
      setForm({
        code: "",
        discount_type: "percentage",
        discount_value: 0,
        max_uses: 1,
        start_date: "",
        end_date: "",
        is_active: true,
        courses_id: "",
      });
    }
    setModalOpen(true);
  };

  // Save voucher (add or update)
  const saveVoucher = async () => {
    setLoading(true);
    if (editVoucher) {
      // Update
      await supabase
        .from("vouchers")
        .update({
          ...form,
        })
        .eq("id", editVoucher.id);
    } else {
      // Create
      await supabase.from("vouchers").insert([
        {
          ...form,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setModalOpen(false);
    setLoading(false);
    location.reload();
  };

  // Delete voucher
  const deleteVoucher = async (id: string) => {
    setLoading(true);
    await supabase.from("vouchers").delete().eq("id", id);
    setLoading(false);
    location.reload();
  };

  return (
    <Stack p="xl" gap="md">
      <Group justify="space-between" mb="md" align="center">
        <Title order={2}>Manajemen Voucher</Title>
        <Button
          leftSection={<IconPlus />}
          onClick={() => openModal()}
          style={{ minWidth: 140, fontWeight: 500 }}
        >
          Tambah Voucher
        </Button>
      </Group>
      {/* Baris filter/sorting di bawah tombol tambah voucher dihapus agar tidak duplikat */}
      <Card shadow="sm" radius="md" p="md" withBorder>
        <Group gap="md" mb="sm" wrap="wrap">
          <TextInput
            placeholder="Cari kode voucher..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ minWidth: 180 }}
          />
          <Select
            placeholder="Status"
            data={[
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Nonaktif" },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
            style={{ minWidth: 120 }}
          />
          <Select
            placeholder="Jenis Diskon"
            data={[
              { value: "percentage", label: "Persentase (%)" },
              { value: "fixed", label: "Nominal (Rp)" },
            ]}
            value={filterType}
            onChange={setFilterType}
            clearable
            style={{ minWidth: 140 }}
          />
        </Group>
        <div style={{ overflowX: "auto", width: "100%" }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: 800 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 80, textAlign: 'center', paddingRight: 0 }}>
                  <span style={{ fontWeight: 500, fontSize: 13, marginRight: 2 }}>Tanggal</span>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => setSortCreated(sortCreated === 'asc' ? 'desc' : 'asc')}
                    aria-label="sort-created"
                    style={{ verticalAlign: 'middle', marginLeft: 2 }}
                  >
                    {sortCreated === 'asc' ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </ActionIcon>
                </Table.Th>
                <Table.Th style={{ minWidth: 90 }}>Kode</Table.Th>
                <Table.Th style={{ minWidth: 80 }}>Jenis</Table.Th>
                <Table.Th style={{ minWidth: 80 }}>Nilai</Table.Th>
                <Table.Th style={{ minWidth: 70 }}>Kuota</Table.Th>
                <Table.Th style={{ minWidth: 70 }}>Terpakai</Table.Th>
                <Table.Th style={{ minWidth: 70 }}>Aktif</Table.Th>
                <Table.Th style={{ minWidth: 120 }}>Periode</Table.Th>
                <Table.Th style={{ minWidth: 80 }}>Kursus</Table.Th>
                <Table.Th style={{ minWidth: 80 }}>Aksi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredVouchers.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} style={{ textAlign: "center" }}>
                    Tidak ada voucher ditemukan.
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredVouchers
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((v) => (
                    <Table.Tr key={v.id}>
                      <Table.Td style={{ textAlign: 'center', fontSize: 13 }}>
                        {v.created_at ? new Date(v.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                      </Table.Td>
                      <Table.Td>
                        <Badge color="blue" size="md" radius="sm">
                          {v.code}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={v.discount_type === "percentage" ? "yellow" : "grape"}>
                          {v.discount_type === "percentage" ? "Persentase" : "Nominal"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {v.discount_type === "percentage"
                          ? `${v.discount_value}%`
                          : `Rp ${v.discount_value.toLocaleString("id-ID")}`}
                      </Table.Td>
                      <Table.Td>{v.max_uses}</Table.Td>
                      <Table.Td>{v.used_count}</Table.Td>
                      <Table.Td>
                        <Badge color={v.is_active ? "green" : "red"}>
                          {v.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {v.start_date
                          ? new Date(v.start_date).toLocaleDateString("id-ID")
                          : "-"}
                        {" - "}
                        {v.end_date
                          ? new Date(v.end_date).toLocaleDateString("id-ID")
                          : "-"}
                      </Table.Td>
                      <Table.Td>{v.courses_id}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon
                            color="blue"
                            onClick={() => openModal(v)}
                            aria-label="edit"
                            variant="light"
                          >
                            <IconEdit size={18} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            onClick={() => deleteVoucher(v.id)}
                            aria-label="delete"
                            variant="light"
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
              )}
            </Table.Tbody>
          </Table>
        </div>
        {/* Pagination Controls */}
        <Group justify="space-between" mt="md" style={{ alignItems: "center" }}>
          {/* Info halaman di kiri */}
          <span style={{ fontSize: 13, color: "#888", marginLeft: 2 }}>
            Halaman {page} dari {Math.max(1, Math.ceil(filteredVouchers.length / pageSize))}
          </span>

          {/* Pagination di kanan */}
          <Group gap={4} style={{ marginRight: 2 }}>
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={page === 1 || filteredVouchers.length <= pageSize}
              onClick={() => setPage(page - 1)}
              aria-label="prev"
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            {/* Nomor halaman */}
            {Array.from({ length: Math.max(1, Math.ceil(filteredVouchers.length / pageSize)) }, (_, i) => i + 1).map((num) => (
              <ActionIcon
                key={num}
                variant={num === page ? "filled" : "subtle"}
                color={num === page ? "blue" : undefined}
                size="sm"
                onClick={() => setPage(num)}
                aria-label={`page-${num}`}
                disabled={filteredVouchers.length <= pageSize}
                style={{ fontSize: 13 }}
              >
                {num}
              </ActionIcon>
            ))}
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={page * pageSize >= filteredVouchers.length || filteredVouchers.length <= pageSize}
              onClick={() => setPage(page + 1)}
              aria-label="next"
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>

      {/* Modal Add/Edit */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editVoucher ? "Edit Voucher" : "Tambah Voucher"}
        centered
      >
        <Stack>
          <TextInput
            label="Kode Voucher"
            value={form.code}
            onChange={(e) => handleChange("code", e.currentTarget.value)}
            required
          />
          <Select
            label="Jenis Diskon"
            data={[
              { value: "percentage", label: "Persentase (%)" },
              { value: "fixed", label: "Nominal (Rp)" },
            ]}
            value={form.discount_type}
            onChange={(v) => handleChange("discount_type", v)}
            required
          />
          <NumberInput
            label="Nilai Diskon"
            value={form.discount_value}
            onChange={(v) => handleChange("discount_value", v ?? 0)}
            required
            min={1}
          />
          <NumberInput
            label="Kuota Penggunaan"
            value={form.max_uses}
            onChange={(v) => handleChange("max_uses", v ?? 1)}
            required
            min={1}
          />
          <TextInput
            label="ID Kursus (opsional)"
            value={form.courses_id}
            onChange={(e) => handleChange("courses_id", e.currentTarget.value)}
          />
          <TextInput
            label="Tanggal Mulai"
            type="date"
            value={form.start_date}
            onChange={(e) => handleChange("start_date", e.currentTarget.value)}
          />
          <TextInput
            label="Tanggal Berakhir"
            type="date"
            value={form.end_date}
            onChange={(e) => handleChange("end_date", e.currentTarget.value)}
          />
          <Checkbox
            label="Aktif"
            checked={form.is_active}
            onChange={(e) => handleChange("is_active", e.currentTarget.checked)}
          />
          <Group justify="end" mt="md">
            <Button onClick={saveVoucher} loading={loading}>
              {editVoucher ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

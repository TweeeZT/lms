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
  Alert,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconPlus, IconEdit, IconTrash, IconChevronLeft, IconChevronRight, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
// Using internal API routes for all CRUD operations

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
  const [sortCreated, setSortCreated] = useState<'asc' | 'desc'>('desc');

  // Form states
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: undefined as number | undefined, // undefined so placeholder shows
    max_uses: 1,
    start_date: "",
    end_date: "",
    is_active: true,
    courses_id: "",
  });

  // Validation error states
  const [errors, setErrors] = useState<Record<string, string | null>>({
    code: null,
    discount_type: null,
    discount_value: null,
    max_uses: null,
    start_date: null,
    end_date: null,
    courses_id: null,
  });
  const [apiError, setApiError] = useState<string | null>(null);

  // Courses options
  const [courses, setCourses] = useState<Array<{ value: string; label: string }>>([]);
  // Quick id->title map for rendering in table
  const courseTitle = (id?: string) => courses.find((c) => c.value === id)?.label || id || "-";

  // Helpers for date inputs (YYYY-MM-DD)
  const toDateInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const todayStr = toDateInputValue(new Date());
  const minEndDate = form.start_date ? form.start_date : todayStr;

  // Fetch vouchers from API
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/voucher', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
        setVouchers(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error(e);
        setVouchers([]);
      } finally {
        setLoading(false);
      }
    };
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses/brief', { cache: 'no-store' });
        const json = await res.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        const opts = items
          .map((c: any) => ({ value: c.id, label: c.title }))
          .filter((c: any) => c.value && c.label);
        setCourses(opts);
      } catch (e) {
        console.error('Gagal memuat courses', e);
        setCourses([]);
      }
    };
    fetchVouchers();
    fetchCourses();
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
  const getFieldError = (field: string, next: typeof form): string | null => {
    switch (field) {
      case "code":
        return next.code.trim() ? null : "Kode wajib diisi";
      case "discount_type":
        return ["percentage", "nominal"].includes(next.discount_type)
          ? null
          : "Jenis diskon tidak valid";
      case "discount_value": {
        if (next.discount_value === undefined || next.discount_value === null || Number.isNaN(Number(next.discount_value))) {
          return "Nilai diskon wajib diisi";
        }
        const dv = Number(next.discount_value);
        if (next.discount_type === "percentage") {
          if (dv < 1 || dv > 100) return "Diskon persen harus 1-100";
        } else {
          if (dv < 1) return "Diskon nominal minimal 1";
        }
        return null;
      }
      case "max_uses": {
        if (next.max_uses === undefined || next.max_uses === null) return "Kuota wajib diisi";
        const mu = Number(next.max_uses);
        if (!Number.isFinite(mu) || mu < 1) return "Kuota penggunaan minimal 1";
        return null;
      }
      case "courses_id":
        return next.courses_id ? null : "Kursus wajib dipilih";
      case "start_date":
        return next.start_date ? null : "Tanggal mulai wajib diisi";
      case "end_date": {
        if (!next.end_date) return "Tanggal berakhir wajib diisi";
        if (next.start_date && next.end_date < next.start_date) return "Tidak boleh sebelum tanggal mulai";
        return null;
      }
      default:
        return null;
    }
  };

  const validateAll = (next: typeof form) => {
    const nextErrors: Record<string, string | null> = {
      code: getFieldError("code", next),
      discount_type: getFieldError("discount_type", next),
      discount_value: getFieldError("discount_value", next),
      max_uses: getFieldError("max_uses", next),
      start_date: getFieldError("start_date", next),
      end_date: getFieldError("end_date", next),
      courses_id: getFieldError("courses_id", next),
    };
    const hasError = Object.values(nextErrors).some((e) => !!e);
    return { nextErrors, hasError };
  };

  const handleChange = (field: string, value: any) => {
    setApiError(null);
    setForm((prev) => {
      const next = { ...prev, [field]: value } as typeof form;
      // Cross-field fixes
      if (field === "start_date" && next.end_date && next.start_date > next.end_date) {
        // Keep end_date at least start_date
        next.end_date = next.start_date;
      }
      // Validate changed field
      const fieldError = getFieldError(field, next);
      // Also revalidate dependent fields
      const deps: string[] = [];
      if (field === "discount_type" || field === "discount_value") deps.push("discount_value");
      if (field === "start_date" || field === "end_date") deps.push("start_date", "end_date");
      setErrors((prevErr) => ({
        ...prevErr,
        [field]: fieldError,
        ...deps.reduce((acc, f) => ({ ...acc, [f]: getFieldError(f, next) }), {} as Record<string, string | null>),
      }));
      return next;
    });
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
        start_date: voucher.start_date ? new Date(voucher.start_date).toISOString().slice(0, 10) : "",
        end_date: voucher.end_date ? new Date(voucher.end_date).toISOString().slice(0, 10) : "",
        is_active: voucher.is_active,
        courses_id: voucher.courses_id || "",
      });
    } else {
      setEditVoucher(null);
      setForm({
        code: "",
        discount_type: "percentage",
        discount_value: undefined,
        max_uses: 1,
        start_date: todayStr, // default to today
        end_date: "",
        is_active: true,
        courses_id: "",
      });
    }
    setErrors({ code: null, discount_type: null, discount_value: null, max_uses: null, start_date: null, end_date: null, courses_id: null });
    setApiError(null);
    setModalOpen(true);
  };

  // Save voucher (add or update)
  const saveVoucher = async () => {
    setApiError(null);
    // Validate all fields first
    const { nextErrors, hasError } = validateAll(form);
    setErrors(nextErrors);
    if (hasError) {
      setApiError("Periksa input yang ditandai merah");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        courses_id: form.courses_id || null,
      };
      let res: Response;
      if (editVoucher) {
        res = await fetch('/api/admin/voucher', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editVoucher.id, ...payload }),
        });
      } else {
        res = await fetch('/api/admin/voucher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error || (json.errors ? json.errors.join(', ') : 'Gagal menyimpan');
        setApiError(msg);
        return;
      }
      // Refresh list
      const listRes = await fetch('/api/admin/voucher', { cache: 'no-store' });
      const listJson = await listRes.json();
      if (listRes.ok) setVouchers(Array.isArray(listJson.data) ? listJson.data : []);
      setModalOpen(false);
    } catch (e: any) {
      console.error(e);
      setApiError(e?.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  // Delete voucher
  const deleteVoucher = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/voucher`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menghapus');
      // Refresh list
      const listRes = await fetch('/api/admin/voucher', { cache: 'no-store' });
      const listJson = await listRes.json();
      if (listRes.ok) setVouchers(Array.isArray(listJson.data) ? listJson.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
              { value: "nominal", label: "Nominal (Rp)" },
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
                          : `Rp ${Number(v.discount_value).toLocaleString("id-ID")}`}
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
                      <Table.Td>{courseTitle(v.courses_id)}</Table.Td>
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
          {apiError && (
            <Alert color="red" variant="light">
              {apiError}
            </Alert>
          )}
          <TextInput
            label="Kode Voucher"
            value={form.code}
            onChange={(e) => handleChange("code", e.currentTarget.value)}
            withAsterisk
            error={errors.code || undefined}
            onBlur={() => setErrors((prev) => ({ ...prev, code: getFieldError("code", form) }))}
          />
          <Select
            label="Jenis Diskon"
            data={[
              { value: "percentage", label: "Persentase (%)" },
              { value: "nominal", label: "Nominal (Rp)" },
            ]}
            value={form.discount_type}
            onChange={(v) => handleChange("discount_type", v)}
            withAsterisk
            error={errors.discount_type || undefined}
          />
          <NumberInput
            label="Nilai Diskon"
            placeholder="Misal 10 untuk 10% atau 50000 untuk Rp 50.000"
            value={form.discount_value}
            onChange={(v) => handleChange("discount_value", v === null ? undefined : v)}
            withAsterisk
            min={1}
            max={form.discount_type === 'percentage' ? 100 : undefined}
            error={errors.discount_value || undefined}
            onBlur={() => setErrors((prev) => ({ ...prev, discount_value: getFieldError("discount_value", form) }))}
          />
          <NumberInput
            label="Kuota Penggunaan"
            value={form.max_uses}
            onChange={(v) => handleChange("max_uses", v ?? 1)}
            withAsterisk
            min={1}
            error={errors.max_uses || undefined}
            onBlur={() => setErrors((prev) => ({ ...prev, max_uses: getFieldError("max_uses", form) }))}
          />
          <Select
            label="ID Kursus"
            placeholder="Pilih kursus"
            data={courses}
            value={form.courses_id}
            onChange={(v) => handleChange("courses_id", v)}
            searchable
            withAsterisk
            error={errors.courses_id || undefined}
          />
          <DatePickerInput
            label="Tanggal Mulai"
            placeholder="Pilih tanggal"
            value={form.start_date ? new Date(form.start_date) : null}
            valueFormat="YYYY-MM-DD"
            onChange={(val: any) => {
              const date = val ? new Date(val) : null;
              const str = date ? toDateInputValue(date as Date) : "";
              handleChange("start_date", str);
              if (form.end_date && str > form.end_date) {
                handleChange("end_date", str);
              }
            }}
            minDate={new Date(todayStr)}
            popoverProps={{ withinPortal: true }}
            withAsterisk
            error={errors.start_date || undefined}
          />
          <DatePickerInput
            label="Tanggal Berakhir"
            placeholder="Pilih tanggal"
            value={form.end_date ? new Date(form.end_date) : null}
            valueFormat="YYYY-MM-DD"
            onChange={(val: any) => {
              const date = val ? new Date(val) : null;
              const str = date ? toDateInputValue(date as Date) : "";
              handleChange("end_date", str);
            }}
            minDate={new Date(minEndDate)}
            popoverProps={{ withinPortal: true }}
            withAsterisk
            error={errors.end_date || undefined}
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

"use client";

import React, { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconEdit,
  IconPlus,
  IconTrash,
  IconUser,
  IconSearch,
} from "@tabler/icons-react";

type StatusAlat = "tersedia" | "terpakai" | "rusak" | "hilang";

type Alat = {
  id: string;
  kode: string;
  nama: string;
  serial: string;
  deskripsi?: string;
  status: StatusAlat;
  pemilikId?: string;
  pemilikNama?: string;
  assignedAt?: string; // ISO
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

type FormState = {
  id?: string;
  kode: string;
  nama: string;
  serial: string;
  deskripsi?: string;
  status: StatusAlat;
  pemilikId?: string;
};

const mockUsers = [
  { id: "u1", name: "Budi Santoso", email: "budi@example.com" },
  { id: "u2", name: "Siti Aminah", email: "siti@example.com" },
  { id: "u3", name: "Andi Wijaya", email: "andi@example.com" },
  { id: "u4", name: "Admin (contoh)", email: "admin@example.com" },
];

const statusLabel: Record<StatusAlat, string> = {
  tersedia: "Tersedia",
  terpakai: "Terpakai",
  rusak: "Rusak",
  hilang: "Hilang",
};

function statusColor(s: StatusAlat): string {
  switch (s) {
    case "tersedia":
      return "green";
    case "terpakai":
      return "blue";
    case "rusak":
      return "red";
    case "hilang":
      return "orange";
    default:
      return "gray";
  }
}

function nowISO() {
  return new Date().toISOString();
}

export default function ManajemenAlatPage() {
  const [alat, setAlat] = useState<Alat[]>([
    {
      id: "a-1001",
      kode: "RBX-1001",
      nama: "Kit Robotik Dasar",
      serial: "SN-001-AX",
      deskripsi: "Paket robotik untuk kelas pemula",
      status: "terpakai",
      pemilikId: "u1",
      pemilikNama: "Budi Santoso",
      assignedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "a-1002",
      kode: "RBX-1002",
      nama: "Sensor Ultrasonik",
      serial: "SN-002-BX",
      deskripsi: "Sensor jarak untuk kendaraan otonom",
      status: "tersedia",
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      id: "a-1003",
      kode: "RBX-1003",
      nama: "Kontroler Motor",
      serial: "SN-003-CX",
      deskripsi: "Driver motor DC 2 kanal",
      status: "rusak",
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [openedForm, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [openedDelete, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [form, setForm] = useState<FormState>({
    kode: "",
    nama: "",
    serial: "",
    deskripsi: "",
    status: "tersedia",
    pemilikId: undefined,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const userSelectData = mockUsers.map((u) => ({
    value: u.id,
    label: `${u.name} – ${u.email}`,
  }));

  const filtered = useMemo(() => {
    return alat.filter((a) => {
      const q = search.trim().toLowerCase();
      const matchQ = !q
        ? true
        : [a.kode, a.nama, a.serial, a.pemilikNama, a.deskripsi]
            .filter(Boolean)
            .some((x) => String(x).toLowerCase().includes(q));
      const matchStatus = !statusFilter ? true : a.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [alat, search, statusFilter]);

  function resetForm() {
    setForm({ kode: "", nama: "", serial: "", deskripsi: "", status: "tersedia" });
  }

  function onCreate() {
    resetForm();
    openForm();
  }

  function onEdit(row: Alat) {
    setForm({
      id: row.id,
      kode: row.kode,
      nama: row.nama,
      serial: row.serial,
      deskripsi: row.deskripsi,
      status: row.status,
      pemilikId: row.pemilikId,
    });
    openForm();
  }

  function handleSubmit() {
    const owner = mockUsers.find((u) => u.id === form.pemilikId);
    if (form.id) {
      // update
      setAlat((prev) =>
        prev.map((a) =>
          a.id === form.id
            ? {
                ...a,
                kode: form.kode.trim(),
                nama: form.nama.trim(),
                serial: form.serial.trim(),
                deskripsi: form.deskripsi?.trim() || undefined,
                status: form.status,
                pemilikId: form.pemilikId || undefined,
                pemilikNama: owner?.name,
                assignedAt: form.pemilikId ? (a.assignedAt || nowISO()) : undefined,
                updatedAt: nowISO(),
              }
            : a
        )
      );
    } else {
      // create
      const id = `a-${Math.random().toString(36).slice(2, 8)}`;
      const ts = nowISO();
      setAlat((prev) => [
        ...prev,
        {
          id,
          kode: form.kode.trim(),
          nama: form.nama.trim(),
          serial: form.serial.trim(),
          deskripsi: form.deskripsi?.trim() || undefined,
          status: form.status,
          pemilikId: form.pemilikId || undefined,
          pemilikNama: owner?.name,
          assignedAt: form.pemilikId ? ts : undefined,
          createdAt: ts,
          updatedAt: ts,
        },
      ]);
    }
    closeForm();
  }

  function onDelete(row: Alat) {
    setDeleteId(row.id);
    openDelete();
  }

  function confirmDelete() {
    if (!deleteId) return;
    setAlat((prev) => prev.filter((a) => a.id !== deleteId));
    setDeleteId(null);
    closeDelete();
  }

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={700} size="xl">
            Manajemen Alat Peraga Robotik
          </Text>
          <Text size="sm" c="dimmed">
            UI saja (mock). Kelola daftar alat untuk kursus robotik: tambah, edit/assign pemilik, dan hapus.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={onCreate}>
          Tambah Alat
        </Button>
      </Group>

      <Card withBorder radius="lg" shadow="xs">
        <Stack gap="sm">
          <Group wrap="wrap" gap="sm">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Cari kode/nama/serial/pemilik..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={360}
            />
            <Select
              w={220}
              placeholder="Filter status"
              data={[
                { value: "tersedia", label: statusLabel["tersedia"] },
                { value: "terpakai", label: statusLabel["terpakai"] },
                { value: "rusak", label: statusLabel["rusak"] },
                { value: "hilang", label: statusLabel["hilang"] },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
            />
          </Group>

          <Table highlightOnHover withTableBorder stickyHeader stickyHeaderOffset={1}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kode</Table.Th>
                <Table.Th>Nama</Table.Th>
                <Table.Th>Serial</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Pemilik</Table.Th>
                <Table.Th>Assign</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th style={{ width: 120 }}>Aksi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text fw={600}>{row.kode}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>{row.nama}</Text>
                    {row.deskripsi && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {row.deskripsi}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray">
                      {row.serial}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(row.status)} variant="light">
                      {statusLabel[row.status]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {row.pemilikNama ? (
                      <Group gap={6} wrap="nowrap">
                        <IconUser size={16} />
                        <Text size="sm">{row.pemilikNama}</Text>
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {row.assignedAt ? new Date(row.assignedAt).toLocaleDateString() : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Edit / Assign Pemilik">
                        <ActionIcon variant="light" color="blue" onClick={() => onEdit(row)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Hapus">
                        <ActionIcon variant="light" color="red" onClick={() => onDelete(row)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {filtered.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text c="dimmed" ta="center">
                      Tidak ada data yang cocok.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>

      {/* Form Modal */}
      <Modal opened={openedForm} onClose={closeForm} title={form.id ? "Edit Alat" : "Tambah Alat"} centered>
        <Stack>
          <Group grow>
            <TextInput
              label="Kode Alat"
              placeholder="mis. RBX-2025-001"
              value={form.kode}
              onChange={(e) => setForm((f) => ({ ...f, kode: e.currentTarget.value }))}
              required
            />
            <TextInput
              label="Nama Alat"
              placeholder="mis. Kit Robotik Dasar"
              value={form.nama}
              onChange={(e) => setForm((f) => ({ ...f, nama: e.currentTarget.value }))}
              required
            />
          </Group>

          <Group grow>
            <TextInput
              label="Serial Number"
              placeholder="mis. SN-XYZ-001"
              value={form.serial}
              onChange={(e) => setForm((f) => ({ ...f, serial: e.currentTarget.value }))}
              required
            />
            <Select
              label="Status"
              data={[
                { value: "tersedia", label: statusLabel["tersedia"] },
                { value: "terpakai", label: statusLabel["terpakai"] },
                { value: "rusak", label: statusLabel["rusak"] },
                { value: "hilang", label: statusLabel["hilang"] },
              ]}
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: (v as StatusAlat) || "tersedia" }))}
              required
            />
          </Group>

          <Textarea
            label="Deskripsi (opsional)"
            minRows={2}
            value={form.deskripsi}
            onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.currentTarget.value }))}
          />

          <Select
            label="Pemilik (opsional)"
            placeholder="Pilih user pemilik alat"
            data={userSelectData}
            value={form.pemilikId || null}
            onChange={(v) => setForm((f) => ({ ...f, pemilikId: v || undefined }))}
            searchable
            clearable
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeForm}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.kode.trim() || !form.nama.trim() || !form.serial.trim()}
            >
              {form.id ? "Simpan Perubahan" : "Tambah"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Modal */}
      <Modal opened={openedDelete} onClose={closeDelete} title="Hapus Alat" centered>
        <Stack>
          <Text>
            Apakah Anda yakin ingin menghapus data alat ini? Tindakan ini tidak dapat dibatalkan.
          </Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeDelete}>
              Batal
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Hapus
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  NumberInput,
  Tooltip,
  Skeleton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconEdit, IconPlus, IconTrash, IconSearch } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

type Tool = {
  id: string;
  courses_id: string;
  title: string;
  text_content: string;
  price: number;
  created_at: string;
  courses?: {
    id: string;
    title: string;
  };
};

type FormState = {
  id?: string;
  courses_id: string;
  title: string;
  text_content: string;
  price: number;
};

export default function InstructorToolsPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [courses, setCourses] = useState<{ value: string; label: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false); // untuk form/delete/create
  const [toolsLoading, setToolsLoading] = useState(false); // untuk loading data tools
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string | null>(null);

  const [openedForm, { open: openForm, close: closeForm }] =
    useDisclosure(false);
  const [openedDelete, { open: openDelete, close: closeDelete }] =
    useDisclosure(false);
  const [form, setForm] = useState<FormState>({
    courses_id: "",
    title: "",
    text_content: "",
    price: 0,
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const fetchCourses = async () => {
    if (!user?.id) return;
    try {
      console.log("Fetching instructor courses...");
      const res = await fetch(
        "/api/instructor/courses?instructorId=" + user.id + "&limit=1000"
      );
      const json = await res.json();
      console.log("Instructor courses API response:", json);

      if (json.success && (json.data || json.items)) {
        // API bisa return 'data' atau 'items' tergantung endpoint
        const coursesData = json.data || json.items || [];
        const courseOptions = coursesData.map((course: any) => ({
          value: course.id,
          label: course.title,
        }));
        console.log("Instructor course options:", courseOptions);
        setCourses(courseOptions);
      } else {
        console.error("Failed to fetch instructor courses:", json);
        notifications.show({
          title: "Error",
          message: "Gagal memuat daftar kursus",
          color: "red",
        });
      }
    } catch (err) {
      console.error("Error fetching courses:", err);
      notifications.show({
        title: "Error",
        message: "Gagal memuat daftar kursus",
        color: "red",
      });
    }
  };

  const fetchTools = async () => {
    if (!user?.id) return;
    setToolsLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        instructorId: user.id,
      });
      if (search) params.set("search", search);
      if (courseFilter) params.set("courseId", courseFilter);

      const res = await fetch("/api/instructor/tools?" + params.toString());
      const json = await res.json();
      if (json.success) {
        setTools(json.data || []);
      } else {
        notifications.show({
          title: "Error",
          message: json.error || "Failed to fetch tools",
          color: "red",
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to fetch tools",
        color: "red",
      });
    } finally {
      setToolsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchCourses();
      fetchTools();
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!initialLoading) {
      fetchTools();
    }
  }, [search, courseFilter]);

  const resetForm = () => {
    setForm({ courses_id: "", title: "", text_content: "", price: 0 });
  };

  const onCreate = () => {
    resetForm();
    openForm();
  };

  const onEdit = (row: Tool) => {
    setForm({
      id: row.id,
      courses_id: row.courses_id,
      title: row.title || "",
      text_content: row.text_content,
      price: row.price,
    });
    openForm();
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!form.courses_id || !form.title || !form.text_content) {
      notifications.show({
        title: "Validation Error",
        message: "Course, title, and description are required",
        color: "red",
      });
      return;
    }

    setLoading(true);
    try {
      const url = form.id
        ? "/api/instructor/tools/" + form.id
        : "/api/instructor/tools";

      const method = form.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courses_id: form.courses_id,
          title: form.title,
          text_content: form.text_content,
          price: form.price,
          instructorId: user.id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        notifications.show({
          title: "Success",
          message: form.id
            ? "Alat berhasil diperbarui"
            : "Alat berhasil dibuat",
          color: "green",
        });
        closeForm();
        fetchTools();
      } else {
        notifications.show({
          title: "Error",
          message: json.error || "Failed to save tool",
          color: "red",
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to save tool",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = (row: Tool) => {
    setDeleteId(row.id);
    openDelete();
  };

  const confirmDelete = async () => {
    if (!deleteId || !user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        "/api/instructor/tools/" + deleteId + "?instructorId=" + user.id,
        {
          method: "DELETE",
        }
      );
      const json = await res.json();
      if (json.success) {
        notifications.show({
          title: "Success",
          message: "Alat Berhasil dihapus",
          color: "green",
        });
        setDeleteId(null);
        closeDelete();
        fetchTools();
      } else {
        notifications.show({
          title: "Error",
          message: json.error || "Failed to delete tool",
          color: "red",
        });
      }
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.message || "Failed to delete tool",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading overlay hanya untuk proses form/delete/create, bukan filter/search
  // Untuk loading filter/search, gunakan skeleton pada tabel saja

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="wrap" gap="md" style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 200, flex: 1 }}>
          <Text fw={700} size="xl">
            Manajemen Alat Peraga Robotik
          </Text>
          <Text size="sm" c="dimmed">
            Kelola alat untuk kursus robotik
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={onCreate} style={{ marginTop: 8, minWidth: 120 }}>
          Tambah Alat
        </Button>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <Stack gap="sm" style={{ width: '100%' }}>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Cari judul alat..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ minWidth: 160, width: '100%' }}
            />
            <Select
              style={{ minWidth: 140, width: '100%' }}
              placeholder="Filter kursus"
              data={courses}
              value={courseFilter}
              onChange={setCourseFilter}
              clearable
              searchable
            />
          </Stack>

          {/* Tabel responsif dengan scroll horizontal di mobile */}
          <div style={{ overflowX: "auto", width: "100%" }}>
            <Table style={{ minWidth: 600, width: '100%' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 120 }}>Kursus</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Judul Alat</Table.Th>
                  <Table.Th style={{ minWidth: 80 }}>Harga</Table.Th>
                  <Table.Th style={{ minWidth: 80 }}>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {toolsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Table.Tr key={`sk-${i}`}>
                      <Table.Td><Skeleton height={14} width={120} /></Table.Td>
                      <Table.Td><Skeleton height={14} width={120} /></Table.Td>
                      <Table.Td><Skeleton height={14} width={80} /></Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Skeleton height={30} width={30} radius="md" />
                          <Skeleton height={30} width={30} radius="md" />
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : tools.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4} style={{ textAlign: "center" }}>
                      <Text size="sm" c="dimmed">Tidak ada alat ditemukan.</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  tools.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text fw={600} size="sm" style={{ wordBreak: 'break-word' }}>
                          {row.courses?.title || "-"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" style={{ wordBreak: 'break-word' }}>{row.title || "-"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{formatCurrency(row.price)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="wrap">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => onEdit(row)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => onDelete(row)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
        </Stack>
      </Card>

      <Modal
        opened={openedForm}
        onClose={closeForm}
        title={form.id ? "Edit Alat" : "Tambah Alat"}
        size="lg"
      >
        <Stack>
          <Select
            label="Kursus"
            placeholder="Pilih kursus"
            data={courses}
            value={form.courses_id}
            onChange={(v) => setForm((f) => ({ ...f, courses_id: v || "" }))}
            searchable
            required
            nothingFoundMessage="Tidak ada kursus ditemukan"
          />

          <TextInput
            label="Judul Alat"
            placeholder="contoh: Arduino KIT, Sensor Ultrasonik, dll"
            value={form.title}
            onChange={(e) => {
              const value = e?.currentTarget?.value || "";
              setForm((f) => ({ ...f, title: value }));
            }}
            required
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Deskripsi *
            </Text>
            <RichTextEditor
              value={form.text_content}
              onChange={(v) => setForm((f) => ({ ...f, text_content: v }))}
            />
          </div>

          <NumberInput
            label="Harga"
            value={form.price}
            onChange={(v) => setForm((f) => ({ ...f, price: Number(v) || 0 }))}
            min={0}
            prefix="Rp "
            thousandSeparator=","
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={closeForm}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {form.id ? "Update" : "Tambah"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={openedDelete} onClose={closeDelete} title="Hapus Alat">
        <Stack>
          <Text>Hapus data alat ini?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>
              Batal
            </Button>
            <Button color="red" onClick={confirmDelete} loading={loading}>
              Hapus
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

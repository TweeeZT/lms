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

export default function AdminToolsPage() {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [courses, setCourses] = useState<{ value: string; label: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
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
    if (!user?.id) {
      console.log("User ID not available yet");
      return;
    }

    try {
      console.log("Fetching courses...");
      const res = await fetch(
        `/api/admin/courses?userId=${user.id}&limit=1000`
      );
      const json = await res.json();
      console.log("Courses API response:", json);

      if (json.success && (json.data || json.items)) {
        // API bisa return 'data' atau 'items' tergantung endpoint
        const coursesData = json.data || json.items || [];
        const courseOptions = coursesData.map((course: any) => ({
          value: course.id,
          label: course.title,
        }));
        console.log("Course options:", courseOptions);
        setCourses(courseOptions);
      } else {
        console.error("Failed to fetch courses:", json);
        // Jangan tampilkan error notification kalau userId required (sudah expected)
        if (json.error !== "userId required") {
          notifications.show({
            title: "Error",
            message: json.error || "Gagal memuat daftar kursus",
            color: "red",
          });
        }
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
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
      });
      if (search) params.set("search", search);
      if (courseFilter) params.set("courseId", courseFilter);

      const res = await fetch("/api/admin/tools?" + params.toString());
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchCourses();
      fetchTools().finally(() => setInitialLoading(false));
    }
  }, [user]);

  useEffect(() => {
    fetchTools();
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
      const url = form.id ? "/api/admin/tools/" + form.id : "/api/admin/tools";

      const method = form.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courses_id: form.courses_id,
          title: form.title,
          text_content: form.text_content,
          price: form.price,
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
    if (!deleteId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tools/" + deleteId, {
        method: "DELETE",
      });
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

  if (loading && initialLoading) {
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

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between">
        <div>
          <Text fw={700} size="xl">
            Manajemen Alat Peraga Robotik
          </Text>
          <Text size="sm" c="dimmed">
            Kelola alat untuk kursus robotik
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={onCreate}>
          Tambah Alat
        </Button>
      </Group>

      <Card withBorder>
        <Stack gap="sm">
          <Group gap="sm">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Cari judul alat..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={360}
            />
            <Select
              w={280}
              placeholder="Filter kursus"
              data={courses}
              value={courseFilter}
              onChange={setCourseFilter}
              clearable
              searchable
            />
          </Group>

          {/* Wrapper dengan horizontal scroll untuk mobile */}
          <div style={{ overflowX: "auto", width: "100%" }}>
            <Table style={{ minWidth: 600 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Kursus</Table.Th>
                  <Table.Th>Judul Alat</Table.Th>
                  <Table.Th>Harga</Table.Th>
                  <Table.Th>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tools.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text fw={600} size="sm">
                        {row.courses?.title || "-"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.title || "-"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{formatCurrency(row.price)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
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
                ))}
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

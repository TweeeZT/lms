"use client";
import { useAuth } from "@/hooks/useAuth";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Title,
  Paper,
  TextInput,
  Button,
  Table,
  Badge,
  Modal,
  Select,
  Pagination,
  Group,
  Text,
  Skeleton,
} from "@mantine/core";
import { IconPlus, IconSearch, IconTrash, IconUser } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

type StudentRow = {
  id: string;
  school_user_id: string;
  email: string;
  user_id: string;
  name: string;
  status: string;
  invited_by: string;
  invited_at: string;
  created_at: string;
  updated_at: string;
  avatar?: string | null;
};

export default function SchoolStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [checkedRole, setCheckedRole] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStudents = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        schoolUserId: user.id,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/school/students?${params}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setStudents(json.students);
        setTotal(json.total);
      } else {
        setError(json.error || "Gagal memuat siswa");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [user?.id, page, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleAdd = async () => {
    if (!user?.id || !emailOrUsername.trim()) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Email atau username wajib diisi",
      });
      return;
    }

    // If we have a checked role and it's not 'user', block submit early
    if (checkedRole && checkedRole !== "user") {
      notifications.show({
        color: "red",
        title: "Tidak bisa ditambahkan",
        message: "Akun yang dimasukkan bukan akun siswa.",
      });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/school/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolUserId: user.id,
          emailOrUsername: emailOrUsername.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: "Siswa berhasil ditambahkan",
        });
        setAddOpen(false);
        setEmailOrUsername("");
        fetchStudents();
      } else {
        notifications.show({
          color: "red",
          title: "Error",
          message: json.error || "Gagal menambah siswa",
        });
      }
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setAdding(false);
    }
  };

  // Client-side pre-check: validate entered email/username exists and role
  const checkEmailOrUsername = async (val: string) => {
    if (!val.trim()) {
      setCheckedRole(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/users/check?emailOrUsername=${encodeURIComponent(val.trim())}`
      );
      const json = await res.json();
      if (res.ok && json.success && json.found) {
        setCheckedRole(json.user?.role || null);
        if (json.user?.role && json.user.role !== "user") {
          notifications.show({
            color: "yellow",
            title: "Perhatian",
            message: "Akun ini bukan akun siswa dan tidak bisa ditambahkan.",
          });
        }
      } else {
        setCheckedRole(null);
      }
    } catch (e) {
      setCheckedRole(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/school/students?id=${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: "Siswa berhasil dihapus",
        });
        setDeleteId(null);
        fetchStudents();
      } else {
        notifications.show({
          color: "red",
          title: "Error",
          message: json.error || "Gagal menghapus siswa",
        });
      }
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      accepted: "green",
      pending: "yellow",
      rejected: "red",
    };
    return <Badge color={colors[status] || "gray"}>{status}</Badge>;
  };

  return (
    <Box p="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2} style={{ color: "var(--primary-color)" }}>
          Kelola Siswa
        </Title>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={() => setAddOpen(true)}
          style={{ background: "var(--primary-color)" }}
        >
          Tambah Siswa
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md" mb="lg">
        <Group>
          <TextInput
            placeholder="Cari siswa (email/nama)..."
            leftSection={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
        </Group>
      </Paper>

      {loading && initialLoad && (
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
      )}

      {error && (
        <Paper
          withBorder
          p="lg"
          radius="md"
          style={{ background: "#fee", color: "#c00" }}
        >
          <Text>{error}</Text>
        </Paper>
      )}

      {!loading && !error && (
        <>
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <Table striped highlightOnHover miw={800}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nama</Table.Th>
                    <Table.Th>Email</Table.Th>

                    <Table.Th>Tanggal Ditambahkan</Table.Th>
                    <Table.Th>Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loading && !initialLoad ? (
                    // Skeleton loading untuk search/filter
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Table.Tr key={i}>
                          <Table.Td>
                            <Group gap="xs" align="center">
                              <Skeleton height={28} circle />
                              <Skeleton height={16} width={120} />
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Skeleton height={16} width={180} />
                          </Table.Td>
                          <Table.Td>
                            <Skeleton height={16} width={100} />
                          </Table.Td>
                          <Table.Td>
                            <Skeleton height={28} width={80} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </>
                  ) : students.length === 0 ? (
                    <Table.Tr>
                      <Table.Td
                        colSpan={5}
                        style={{ textAlign: "center", padding: 40 }}
                      >
                        <Text c="dimmed">Belum ada siswa</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    students.map((s) => (
                      <Table.Tr key={s.id}>
                        <Table.Td>
                          <Group gap="xs" align="center">
                            {/* show avatar when available, otherwise use IconUser initials */}
                            {s.avatar ? (
                              <Image
                                src={s.avatar}
                                alt={s.name}
                                width={28}
                                height={28}
                                style={{
                                  borderRadius: 999,
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <IconUser size={18} />
                            )}
                            <Text>{s.name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{s.email}</Table.Td>
                        <Table.Td>
                          {new Date(s.invited_at).toLocaleDateString("id-ID")}
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => setDeleteId(s.id)}
                          >
                            Hapus
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>

          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </>
      )}

      {/* Add Modal */}
      <Modal
        opened={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEmailOrUsername("");
        }}
        title="Tambah Siswa"
      >
        <TextInput
          label="Email atau Username"
          placeholder="Masukkan email atau username siswa"
          value={emailOrUsername}
          onChange={(e) => {
            setEmailOrUsername(e.currentTarget.value);
            setCheckedRole(null);
          }}
          onBlur={(e) => checkEmailOrUsername(e.currentTarget.value)}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setAddOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={handleAdd}
            loading={adding}
            style={{ background: "var(--primary-color)" }}
          >
            Tambah
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Konfirmasi Hapus"
      >
        <Text mb="md">Apakah Anda yakin ingin menghapus siswa ini?</Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteId(null)}>
            Batal
          </Button>
          <Button color="red" onClick={handleDelete} loading={deleting}>
            Hapus
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

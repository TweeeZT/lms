"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  Container,
  Stack,
  Title,
  Group,
  Text,
  Paper,
  TextInput,
  Select,
  Button,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Textarea,
  Pagination,
  Card,
  Divider,
  Image,
} from "@mantine/core";
import {
  IconPlus,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconEye,
  IconPencil,
  IconTrash,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "../../../hooks/useAuth";
import Cropper, { Area } from "react-easy-crop";
import { notifications } from "@mantine/notifications";

// Utility: convert cropped area to base64 (square 256x256)
async function getCroppedImg(
  imageSrc: string,
  crop: { x: number; y: number },
  zoom: number,
  pixelCrop: { width: number; height: number; x: number; y: number }
) {
  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img: HTMLImageElement = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context tidak tersedia");
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );
  return canvas.toDataURL("image/png");
}

interface UserRow {
  id: string;
  name: string | null;
  username?: string | null;
  email: string | null;
  role: string | null;
  bio: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
}

type Sortable = "created_at" | "name" | "email" | "role" | "last_login_at";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<Sortable>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [formRole, setFormRole] = useState<string | null>("user");
  const [formBio, setFormBio] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formPassword, setFormPassword] = useState("");
  const [formBankAccount, setFormBankAccount] = useState("");

  // Cropping states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropping, setCropping] = useState(false);
  const croppedAreaPixelsRef = useRef<Area | null>(null);

  const onCropComplete = useCallback((_ignored: Area, areaPixels: Area) => {
    croppedAreaPixelsRef.current = areaPixels;
  }, []);

  const triggerFile = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormErrors((p) => ({ ...p, avatar: "File harus gambar" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCropping(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const applyCrop = async () => {
    if (!rawImage || !croppedAreaPixelsRef.current) return;
    try {
      const base64 = await getCroppedImg(
        rawImage,
        crop,
        zoom,
        croppedAreaPixelsRef.current
      );
      setCroppedPreview(base64);
      setFormAvatar("(cropped)");
      setCropping(false);
      setFormErrors((p) => ({ ...p, avatar: "" }));
    } catch {
      setFormErrors((p) => ({ ...p, avatar: "Gagal crop gambar" }));
    }
  };

  const cancelCrop = () => {
    setCropping(false);
    setRawImage(null);
  };

  function resetForm(u?: UserRow | null) {
    setFormErrors({});
    if (u) {
      setFormName(u.name || "");
      setFormUsername(u.username || "");
      setFormEmail(u.email || "");
      setFormPhone(u.phone || "");
      setFormAvatar(u.avatar_url || "");
      setFormRole(u.role || "user");
      setFormBio(u.bio || "");
      setFormBankAccount(""); // Reset bank account
    } else {
      setFormName("");
      setFormUsername("");
      setFormEmail("");
      setFormPhone("");
      setFormAvatar("");
      setFormRole("user");
      setFormBio("");
      setFormBankAccount(""); // Reset bank account
    }
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!formName.trim()) errs.name = "Nama wajib";
    if (!formUsername.trim()) errs.username = "Username wajib";
    if (!formEmail.trim()) errs.email = "Email wajib";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail))
      errs.email = "Format email tidak valid";
    if (!formRole) errs.role = "Role wajib";
    if (!formPhone.trim()) errs.phone = "Nomor telepon wajib";
    if (!croppedPreview && !formAvatar.trim()) errs.avatar = "Avatar wajib";
    if (!editUser && !formPassword.trim()) errs.password = "Password wajib";
    if (formRole === "instructor" && !formBankAccount.trim())
      errs.bank_account = "Rekening wajib diisi";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function fetchUsers() {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("userId", user.id);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (q) params.set("q", q);
      if (roleFilter) params.set("role", roleFilter);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat data");
      setItems(json.items || []);
      setTotal(json.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, q, roleFilter, sortBy, sortDir]);

  function changeSort(col: Sortable) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  async function handleAdd() {
    if (!validateForm()) return;
    if (!user?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          role: formRole,
          bio: formBio.trim() || null,
          phone: formPhone.trim(),
          avatar_url: formAvatar.startsWith("http")
            ? formAvatar.trim()
            : undefined,
          password: formPassword.trim(),
          avatar_base64: croppedPreview || undefined,
          bank_account:
            formRole === "instructor"
              ? formBankAccount.trim() || null
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menambah user");
      notifications.show({
        color: "green",
        title: "Berhasil",
        message: "User berhasil dibuat",
      });
      setAddOpen(false);
      resetForm();
      fetchUsers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menambah";
      notifications.show({ color: "red", title: "Error", message: msg });
      setFormErrors((prev) => ({ ...prev, root: msg }));
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!validateForm()) return;
    if (!user?.id || !editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editUser.id,
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          role: formRole,
          bio: formBio.trim(),
          phone: formPhone.trim(),
          avatar_url: formAvatar.startsWith("http")
            ? formAvatar.trim()
            : undefined,
          avatar_base64: croppedPreview || undefined,
          bank_account:
            formRole === "instructor"
              ? formBankAccount.trim() || null
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal mengubah user");
      notifications.show({
        color: "green",
        title: "Berhasil",
        message: "User diperbarui",
      });
      setEditUser(null);
      resetForm();
      fetchUsers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal mengubah";
      notifications.show({ color: "red", title: "Error", message: msg });
      setFormErrors((prev) => ({ ...prev, root: msg }));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user?.id || !deleteUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteUser.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menghapus user");
      notifications.show({
        color: "green",
        title: "Berhasil",
        message: "User dihapus",
      });
      setDeleteUser(null);
      fetchUsers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      notifications.show({ color: "red", title: "Error", message: msg });
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total]
  );

  function openAdd() {
    resetForm();
    setAddOpen(true);
    setFormPassword("");
    setRawImage(null);
    setCroppedPreview(null);
  }
  function openEdit(u: UserRow) {
    resetForm(u);
    setEditUser(u);
    setFormPassword("");
    setRawImage(null);
    setCroppedPreview(null);
  }

  const SortIcon = ({ col }: { col: Sortable }) => {
    if (sortBy !== col) return null;
    return sortDir === "asc" ? (
      <IconArrowUp size={12} />
    ) : (
      <IconArrowDown size={12} />
    );
  };

  return (
    <Container size="xl" style={{ position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            {[0, 1, 2].map((i) => (
              <svg
                key={i}
                width="70"
                height="70"
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
                  stroke="url(#gradAdminUsersFull)"
                  strokeWidth="8"
                  rx="4"
                  ry="4"
                  transform="rotate(45 32 32)"
                />
                <defs>
                  <linearGradient
                    id="gradAdminUsersFull"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#f6d457" />
                    <stop offset="100%" stopColor="#1e3769" />
                  </linearGradient>
                </defs>
              </svg>
            ))}
          </div>
          <style>{`@keyframes spinDiamond { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
        </div>
      )}
      <Stack gap="lg">
        <Title order={2}>Manajemen Pengguna</Title>
        <Paper p="sm" radius="md" withBorder>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              placeholder="Cari nama/email/id..."
              leftSection={<IconSearch size={16} />}
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.currentTarget.value);
              }}
            />
            <Select
              placeholder="Role"
              data={[
                { value: "admin", label: "Admin" },
                { value: "instructor", label: "Instruktur" },
                { value: "user", label: "User" },
              ]}
              value={roleFilter}
              onChange={(v) => {
                setPage(1);
                setRoleFilter(v);
              }}
              clearable
            />
            <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
              Tambah User
            </Button>
          </Group>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Daftar Pengguna</Text>
          </Group>
          <div style={{ overflowX: "auto" }}>
            <Table
              withTableBorder
              withColumnBorders
              striped
              highlightOnHover
              horizontalSpacing="md"
              verticalSpacing={6}
              style={{ fontSize: 13, minWidth: 920 }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th
                    onClick={() => changeSort("created_at")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Group gap={4}>
                      <span>Dibuat</span>
                      <SortIcon col="created_at" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("name")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Group gap={4}>
                      <span>Nama</span>
                      <SortIcon col="name" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("email")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Group gap={4}>
                      <span>Email</span>
                      <SortIcon col="email" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    onClick={() => changeSort("role")}
                    style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    <Group gap={4}>
                      <span>Role</span>
                      <SortIcon col="role" />
                    </Group>
                  </Table.Th>

                  <Table.Th style={{ width: 120 }}>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("id-ID")
                        : "-"}
                    </Table.Td>
                    <Table.Td>
                      {u.name || (
                        <Text c="dimmed" size="xs">
                          (tidak ada)
                        </Text>
                      )}
                      {u.username && (
                        <Text size="xs" c="dimmed">
                          @{u.username}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{u.email}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          u.role === "admin"
                            ? "violet"
                            : u.role === "instructor"
                            ? "blue"
                            : "gray"
                        }
                      >
                        {u.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Detail" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            onClick={() => setViewUser(u)}
                            aria-label="Detail"
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            color="blue"
                            onClick={() => openEdit(u)}
                            aria-label="Edit"
                          >
                            <IconPencil size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {/* <Tooltip label="Hapus" withArrow>
                          <ActionIcon
                            variant="light"
                            size="sm"
                            color="red"
                            onClick={() => setDeleteUser(u)}
                            aria-label="Hapus"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip> */}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!items.length && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" size="sm">
                        Tidak ada data
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </div>
          {total > 0 && (
            <Group justify="space-between" mt="sm">
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

        {/* View Modal */}
        <Modal
          opened={!!viewUser}
          onClose={() => setViewUser(null)}
          title="Detail Pengguna"
          centered
        >
          {viewUser && (
            <Stack gap="xs">
              <Group>
                <ActionIcon size="lg" variant="light">
                  <IconUser size={22} />
                </ActionIcon>
                <div>
                  <Text fw={600}>{viewUser.name || "(Tanpa nama)"}</Text>
                  <Text size="sm" c="dimmed">
                    {viewUser.email}
                  </Text>
                </div>
              </Group>
              <Divider />
              <Text size="sm">
                <strong>Role:</strong> {viewUser.role}
              </Text>
              <Text size="sm">
                <strong>Dibuat:</strong>{" "}
                {viewUser.created_at
                  ? new Date(viewUser.created_at).toLocaleString("id-ID")
                  : "-"}
              </Text>
              <Divider />
              <Text size="sm">
                <strong>Phone:</strong> {viewUser.phone || "-"}
              </Text>
              <Text size="sm">
                <strong>Username:</strong> {viewUser.username || "-"}
              </Text>
              <Text size="sm" fw={600}>
                Bio:
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {viewUser.bio || (
                  <span style={{ color: "var(--mantine-color-dimmed)" }}>
                    -
                  </span>
                )}
              </Text>
              <Group justify="end" mt="xs">
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => setViewUser(null)}
                >
                  Tutup
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* Add Modal */}
        <Modal
          opened={addOpen}
          onClose={() => setAddOpen(false)}
          title="Tambah User"
          centered
          size="lg"
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 220 }}>
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Avatar
                </Text>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1/1",
                    background: "#f5f5f5",
                    border: "1px dashed #ccc",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                  onClick={triggerFile}
                >
                  {!croppedPreview && !rawImage && (
                    <Group justify="center" style={{ height: "100%" }}>
                      <Text size="xs" c="dimmed" ta="center">
                        Klik untuk pilih gambar
                      </Text>
                    </Group>
                  )}
                  {cropping && rawImage && (
                    <Cropper
                      image={rawImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                      showGrid={false}
                      restrictPosition={false}
                    />
                  )}
                  {!cropping && croppedPreview && (
                    <Image
                      src={croppedPreview}
                      alt="Preview"
                      h="100%"
                      w="100%"
                      fit="cover"
                    />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
                {cropping && (
                  <Group gap={8} wrap="nowrap">
                    <Button size="xs" variant="light" onClick={applyCrop}>
                      Terapkan
                    </Button>
                    <Button size="xs" variant="default" onClick={cancelCrop}>
                      Batal
                    </Button>
                  </Group>
                )}
                {!cropping && (
                  <Group gap={8} wrap="nowrap">
                    <Button size="xs" variant="light" onClick={triggerFile}>
                      Pilih
                    </Button>
                    {croppedPreview && (
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => {
                          setCropping(true);
                        }}
                      >
                        Ubah
                      </Button>
                    )}
                  </Group>
                )}
                {formErrors.avatar && (
                  <Text size="xs" c="red">
                    {formErrors.avatar}
                  </Text>
                )}
              </Stack>
            </div>
            <div style={{ flex: "2 1 320px", minWidth: 280 }}>
              <Stack gap="xs">
                <TextInput
                  withAsterisk
                  label="Nama"
                  value={formName}
                  onChange={(e) => setFormName(e.currentTarget.value)}
                  error={formErrors.name}
                />
                <TextInput
                  withAsterisk
                  label="Username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.currentTarget.value)}
                  error={formErrors.username}
                />
                <TextInput
                  withAsterisk
                  label="Email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.currentTarget.value)}
                  error={formErrors.email}
                />
                <TextInput
                  withAsterisk
                  label="Nomor Telepon"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.currentTarget.value)}
                  error={formErrors.phone}
                />
                <TextInput
                  withAsterisk
                  label="Password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.currentTarget.value)}
                  error={formErrors.password}
                />
                <Select
                  withAsterisk
                  label="Role"
                  data={[
                    { value: "admin", label: "Admin" },
                    { value: "instructor", label: "Instruktur" },
                    { value: "user", label: "User" },
                  ]}
                  value={formRole}
                  onChange={setFormRole}
                  error={formErrors.role}
                />
                {formRole === "instructor" && (
                  <TextInput
                    label="Rekening (Bank Account)"
                    value={formBankAccount}
                    onChange={(e) => setFormBankAccount(e.currentTarget.value)}
                    error={formErrors.bank_account}
                  />
                )}
                <Textarea
                  label="Bio (opsional)"
                  minRows={3}
                  value={formBio}
                  onChange={(e) => setFormBio(e.currentTarget.value)}
                />
                {formErrors.root && (
                  <Text size="xs" c="red">
                    {formErrors.root}
                  </Text>
                )}
                <Group justify="end" mt="xs">
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => setAddOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button size="xs" loading={saving} onClick={handleAdd}>
                    Simpan
                  </Button>
                </Group>
              </Stack>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          opened={!!editUser}
          onClose={() => setEditUser(null)}
          title="Edit User"
          centered
          size="lg"
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px", minWidth: 220 }}>
              <Stack gap="xs">
                <Text fw={600} size="sm">
                  Avatar
                </Text>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1/1",
                    background: "#f5f5f5",
                    border: "1px dashed #ccc",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                  onClick={triggerFile}
                >
                  {!croppedPreview && !rawImage && editUser?.avatar_url && (
                    <Image
                      src={editUser.avatar_url}
                      alt="Avatar"
                      h="100%"
                      w="100%"
                      fit="cover"
                    />
                  )}
                  {!croppedPreview && !rawImage && !editUser?.avatar_url && (
                    <Group justify="center" style={{ height: "100%" }}>
                      <Text size="xs" c="dimmed" ta="center">
                        Klik untuk pilih gambar
                      </Text>
                    </Group>
                  )}
                  {cropping && rawImage && (
                    <Cropper
                      image={rawImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                      showGrid={false}
                      restrictPosition={false}
                    />
                  )}
                  {!cropping && croppedPreview && (
                    <Image
                      src={croppedPreview}
                      alt="Preview"
                      h="100%"
                      w="100%"
                      fit="cover"
                    />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onFileChange}
                />
                {cropping && (
                  <Group gap={8} wrap="nowrap">
                    <Button size="xs" variant="light" onClick={applyCrop}>
                      Terapkan
                    </Button>
                    <Button size="xs" variant="default" onClick={cancelCrop}>
                      Batal
                    </Button>
                  </Group>
                )}
                {!cropping && (
                  <Group gap={8} wrap="nowrap">
                    <Button size="xs" variant="light" onClick={triggerFile}>
                      Pilih
                    </Button>
                    {croppedPreview && (
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => {
                          setCropping(true);
                        }}
                      >
                        Ubah
                      </Button>
                    )}
                  </Group>
                )}
                {formErrors.avatar && (
                  <Text size="xs" c="red">
                    {formErrors.avatar}
                  </Text>
                )}
              </Stack>
            </div>
            <div style={{ flex: "2 1 320px", minWidth: 280 }}>
              <Stack gap="xs">
                <TextInput
                  label="Nama"
                  value={formName}
                  onChange={(e) => setFormName(e.currentTarget.value)}
                  error={formErrors.name}
                />
                <TextInput
                  withAsterisk
                  label="Username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.currentTarget.value)}
                  error={formErrors.username}
                />
                <TextInput
                  label="Email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.currentTarget.value)}
                  error={formErrors.email}
                />
                <TextInput
                  withAsterisk
                  label="Nomor Telepon"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.currentTarget.value)}
                  error={formErrors.phone}
                />
                <Select
                  label="Role"
                  data={[
                    { value: "admin", label: "Admin" },
                    { value: "instructor", label: "Instruktur" },
                    { value: "user", label: "User" },
                  ]}
                  value={formRole}
                  onChange={setFormRole}
                  error={formErrors.role}
                />
                {formRole === "instructor" && (
                  <TextInput
                    label="Rekening (Bank Account)"
                    value={formBankAccount}
                    onChange={(e) => setFormBankAccount(e.currentTarget.value)}
                  />
                )}
                <Textarea
                  label="Bio"
                  minRows={3}
                  value={formBio}
                  onChange={(e) => setFormBio(e.currentTarget.value)}
                />
                {formErrors.root && (
                  <Text size="xs" c="red">
                    {formErrors.root}
                  </Text>
                )}
                <Group justify="end" mt="xs">
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => setEditUser(null)}
                  >
                    Batal
                  </Button>
                  <Button size="xs" loading={saving} onClick={handleEdit}>
                    Simpan
                  </Button>
                </Group>
              </Stack>
            </div>
          </div>
        </Modal>

        {/* Delete Confirmation */}
        <Modal
          opened={!!deleteUser}
          onClose={() => setDeleteUser(null)}
          title="Hapus User"
          centered
        >
          <Stack gap="sm">
            <Text size="sm">
              Yakin ingin menghapus user ini? Tindakan tidak dapat dibatalkan.
            </Text>
            {deleteUser && (
              <Card withBorder padding="sm" radius="md">
                <Text fw={600} size="sm">
                  {deleteUser.name || "(Tanpa nama)"}
                </Text>
                <Text size="xs" c="dimmed">
                  {deleteUser.email}
                </Text>
              </Card>
            )}
            <Group justify="end" mt="xs">
              <Button
                size="xs"
                variant="default"
                onClick={() => setDeleteUser(null)}
              >
                Batal
              </Button>
              <Button
                size="xs"
                color="red"
                loading={saving}
                onClick={handleDelete}
              >
                Hapus
              </Button>
            </Group>
          </Stack>
        </Modal>

        {error && (
          <Paper
            p="sm"
            radius="md"
            withBorder
            style={{ borderColor: "var(--mantine-color-red-5)" }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" c="red">
                {error}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => setError(null)}
                aria-label="Tutup"
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}

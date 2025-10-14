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
  Button,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Select,
  FileInput,
  Switch,
  Pagination,
  Skeleton,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBook,
  IconPlus,
  IconEye,
  IconEdit,
  IconTrash,
  IconUsers,
  IconStar,
  IconUser,
} from "@tabler/icons-react";
import { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { useAuth } from "../../../hooks/useAuth";
import Link from "next/link";
import RichTextEditor from "../../../components/RichTextEditor";

// Admin Courses Management (similar to instructor version but can pick instructor)
export default function AdminCoursesPage() {
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [loading, setLoading] = useState(true);
  type CourseRow = {
    id: string;
    instructor_id: string;
    instructor_name?: string | null;
    title: string;
    description?: string | null;
    thumbnail?: string | null;
    category: string;
    price?: number | null;
    duration_min?: number | null;
    level: string;
    total_modules?: number | null;
    enrolled_count?: number | null;
    rating?: number | null;
    is_published?: boolean | null;
    points?: number | null;
    created_at: string;
    updated_at?: string;
  };
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [opened, setOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<
    { value: string; label: string }[]
  >([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [form, setForm] = useState({
    instructor_id: "",
    title: "",
    price: 0,
    totalModules: 0,
    isPublished: true,
    level: "beginner" as "beginner" | "intermediate" | "advanced",
    thumbnail: "",
    description: "",
    category: "scratch" as "scratch" | "roblox" | "robotics",
    durationMin: 0,
    points: 0,
    overviewTitle: "",
    overviewContent: "",
  });
  const [errors, setErrors] = useState<{ [k: string]: string | undefined }>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    name: string;
    sizeKB: number;
    width: number;
    height: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
  const [instructorFilter, setInstructorFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);

  const myCourses: CourseRow[] = courses;
  const filteredCourses = myCourses; // server filtered

  const resetForm = () => {
    setForm({
      instructor_id: "",
      title: "",
      price: 0,
      totalModules: 0,
      isPublished: true,
      level: "beginner",
      thumbnail: "",
      description: "",
      category: "scratch",
      durationMin: 0,
      points: 0,
      overviewTitle: "",
      overviewContent: "",
    });
    setEditingId(null);
    setErrors({});
  };

  const openAdd = () => {
    resetForm();
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageMeta(null);
    setOpened(true);
  };

  const openEdit = async (id: string) => {
    const c = myCourses.find((c) => c.id === id);
    if (!c) return;
    setForm({
      instructor_id: c.instructor_id,
      title: c.title,
      price: c.price || 0,
      totalModules: c.total_modules || 0,
      isPublished: c.is_published ?? true,
      level:
        (c.level as "beginner" | "intermediate" | "advanced") || "beginner",
      thumbnail: (c.thumbnail?.trim() || "") as string,
      description: c.description || "",
      category: (c.category as "scratch" | "roblox" | "robotics") || "scratch",
      durationMin: Number(c.duration_min || 0),
      points: Number(c.points || 0),
      overviewTitle: "",
      overviewContent: "",
    });
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageMeta(null);
    setEditingId(id);
    setErrors({});

    // Show loading state while fetching overview data
    setSaving(true);
    setOpened(true);

    // Fetch overview data from database
    try {
      const res = await fetch(
        `/api/admin/courses/${id}/overview?userId=${user?.id}`
      );
      const json = await res.json();
      if (res.ok && json.success && json.overview) {
        setForm((prev) => ({
          ...prev,
          overviewTitle: json.overview.title || "",
          overviewContent: json.overview.content || "",
        }));
      }
    } catch (err) {
      console.error("[openEdit] Failed to fetch overview:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePickThumbnail = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageMeta(null);
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setForm((f) => ({ ...f, thumbnail: "" }));
      setErrors((e) => ({ ...e, thumbnail: undefined }));
      const img = new Image();
      img.onload = () => {
        setImageMeta({
          name: file.name,
          sizeKB: Math.max(1, Math.round(file.size / 1024)),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = url;
    }
  };

  const fetchInstructors = useCallback(
    async (q?: string) => {
      if (!user?.id) return;
      setInstructorsLoading(true);
      try {
        const params = new URLSearchParams({
          userId: user.id,
          role: "instructor",
          limit: "50",
          page: "1",
        });
        if (q) params.set("q", q);
        const res = await fetch(`/api/admin/users?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setInstructors(
            (json.items || []).map(
              (u: {
                id: string;
                name?: string | null;
                username?: string | null;
                email?: string | null;
              }) => ({
                value: u.id,
                label: u.name || u.username || u.email || u.id,
              })
            )
          );
        }
      } catch {
        // ignore network errors
      } finally {
        setInstructorsLoading(false);
      }
    },
    [user?.id]
  );

  // API helpers
  const fetchCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: user.id,
        q: search,
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });
      if (instructorFilter) params.set("instructorId", instructorFilter);
      const res = await fetch(`/api/admin/courses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat kursus");
      setCourses(json.items || []);
      setTotal(json.total || 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat kursus";
      notifications.show({ color: "red", title: "Gagal", message: msg });
    } finally {
      setLoading(false);
    }
  }, [user?.id, search, statusFilter, page, limit, instructorFilter]);

  const fetchTotalStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/user/stats/count");
      const json = await res.json();
      if (json.success) {
        setTotalStudents(json.total || 0);
      }
    } catch (e) {
      console.error("Failed to fetch total students:", e);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchTotalStudents();
  }, [fetchCourses, fetchTotalStudents]);
  useEffect(() => {
    const t = setTimeout(() => fetchCourses(), 300);
    return () => clearTimeout(t);
  }, [fetchCourses, search, statusFilter, page, instructorFilter]);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, instructorFilter]);
  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const saveCourse = async () => {
    if (saving) return;
    if (!user) return;
    const baseErrors: typeof errors = {};
    if (!form.instructor_id) baseErrors.instructor_id = "Instructor wajib";
    if (!form.title.trim()) baseErrors.title = "Judul wajib";
    if (!form.description.trim()) baseErrors.description = "Deskripsi wajib";
    if (form.totalModules <= 0)
      baseErrors.totalModules = "Total modul harus > 0";
    if (form.durationMin <= 0) baseErrors.durationMin = "Durasi harus > 0";
    const needsThumb = !editingId
      ? !selectedFile
      : !(selectedFile || form.thumbnail?.trim());
    if (needsThumb) baseErrors.thumbnail = "Thumbnail wajib";
    setErrors(baseErrors);
    if (Object.keys(baseErrors).length) return;
    try {
      setSaving(true);
      if (editingId) {
        let res: Response;
        if (selectedFile) {
          const fd = new FormData();
          fd.append("userId", user.id);
          fd.append("id", editingId);
          fd.append("instructor_id", form.instructor_id);
          fd.append("title", form.title);
          fd.append("price", String(form.price ?? 0));
          fd.append("total_modules", String(form.totalModules));
          fd.append("is_published", String(!!form.isPublished));
          fd.append("level", form.level);
          fd.append("description", form.description);
          fd.append("category", form.category);
          fd.append("duration_min", String(form.durationMin));
          fd.append("points", String(form.points ?? 0));
          fd.append("overviewTitle", form.overviewTitle || "");
          fd.append("overviewContent", form.overviewContent || "");
          fd.append("file", selectedFile);
          fd.append("filename", selectedFile.name);
          res = await fetch(
            `/api/admin/courses?userId=${encodeURIComponent(user.id)}`,
            { method: "PATCH", body: fd }
          );
        } else {
          const body = {
            id: editingId,
            instructor_id: form.instructor_id,
            title: form.title,
            price: form.price,
            total_modules: form.totalModules,
            is_published: form.isPublished,
            level: form.level,
            thumbnail: form.thumbnail,
            description: form.description,
            category: form.category,
            duration_min: form.durationMin,
            points: form.points,
            overviewTitle: form.overviewTitle || "",
            overviewContent: form.overviewContent || "",
          };
          res = await fetch(
            `/api/admin/courses?userId=${encodeURIComponent(user.id)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          );
        }
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal update");
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: "Kursus berhasil diperbarui",
        });
      } else {
        const fd = new FormData();
        fd.append("userId", user.id);
        fd.append("instructor_id", form.instructor_id);
        fd.append("title", form.title);
        fd.append("price", String(form.price ?? 0));
        fd.append("total_modules", String(form.totalModules));
        fd.append("is_published", String(!!form.isPublished));
        fd.append("level", form.level);
        fd.append("description", form.description);
        fd.append("category", form.category);
        fd.append("duration_min", String(form.durationMin));
        fd.append("points", String(form.points ?? 0));
        fd.append("overviewTitle", form.overviewTitle || "");
        fd.append("overviewContent", form.overviewContent || "");
        if (selectedFile) {
          fd.append("file", selectedFile);
          fd.append("filename", selectedFile.name);
        }
        const res = await fetch(
          `/api/admin/courses?userId=${encodeURIComponent(user.id)}`,
          { method: "POST", body: fd }
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal membuat kursus");
        notifications.show({
          color: "green",
          title: "Berhasil",
          message: "Kursus berhasil dibuat",
        });
      }
      setOpened(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedFile(null);
      setImageMeta(null);
      await fetchCourses();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operasi gagal";
      notifications.show({ color: "red", title: "Gagal", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => setDeleteId(id);
  const doDelete = async () => {
    if (!deleteId || !user) return;
    try {
      const res = await fetch(
        `/api/admin/courses?userId=${encodeURIComponent(user.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteId }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal menghapus");
      setDeleteId(null);
      await fetchCourses();
      notifications.show({
        color: "green",
        title: "Berhasil",
        message: "Kursus berhasil dihapus",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      notifications.show({ color: "red", title: "Gagal", message: msg });
    }
  };

  const StatCard = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }) => {
    const bg = "var(--primary-color)";
    const iconBadgeBg = "var(--secondary-color)";
    const textColor = "#ffffff";
    return (
      <Card
        withBorder
        radius="lg"
        padding="lg"
        style={{
          background: bg,
          boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
          transition: "transform .18s, box-shadow .18s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.22)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)";
        }}
      >
        <Stack align="center" gap={6}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: iconBadgeBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <Icon size={28} />
          </div>
          <Text size="xs" tt="uppercase" fw={700} c={textColor}>
            {label}
          </Text>
          <Text
            size="xl"
            fw={800}
            style={{ lineHeight: 1.1, color: textColor }}
          >
            {value}
          </Text>
        </Stack>
      </Card>
    );
  };

  const avgRating = myCourses.length
    ? (
        myCourses.reduce((s: number, c: CourseRow) => s + (c.rating ?? 0), 0) /
        myCourses.length
      ).toFixed(1)
    : "0";

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={1} mb="md">
              Kelola Kursus
            </Title>
            <Text size="lg" c="dimmed">
              Admin dapat membuat dan mengelola kursus untuk instruktur.
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size="1rem" />}
            className="btn-primary"
            onClick={openAdd}
          >
            Tambah Kursus
          </Button>
        </Group>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <StatCard
              label="Total Kursus"
              value={String(myCourses.length)}
              icon={IconBook}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <StatCard
              label="Total Siswa"
              value={String(totalStudents)}
              icon={IconUsers}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <StatCard
              label="Rata-rata Rating"
              value={avgRating}
              icon={IconStar}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <StatCard
              label="Instruktur"
              value={String(instructors.length)}
              icon={IconUser}
            />
          </Grid.Col>
        </Grid>

        <Card padding="xl" radius="lg" withBorder>
          <Group mb="md" align="flex-end" wrap="wrap" gap="md">
            <TextInput
              label="Pencarian"
              placeholder="Cari judul..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ minWidth: 230, flex: 1 }}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(v) =>
                setStatusFilter((v as "all" | "published" | "draft") || "all")
              }
              data={[
                { value: "all", label: "Semua" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
              ]}
              style={{ width: 150 }}
            />
            <Select
              label="Instruktur"
              value={instructorFilter}
              onChange={(v) => setInstructorFilter(v)}
              data={[{ value: "", label: "Semua" }, ...instructors]}
              searchable
              nothingFoundMessage="Tidak ada"
              clearable
              style={{ width: 220 }}
            />
            <Text size="xs" c="dimmed" style={{ marginLeft: "auto" }}>
              {total} hasil
            </Text>
          </Group>
          {loading ? (
            <Grid gutter="xl">
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
                  <Skeleton height={160} radius="md" />
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Grid gutter="xl">
              {filteredCourses.map((course) => (
                <Grid.Col
                  key={course.id}
                  span={{ base: 12, sm: 6, md: 6, lg: 4 }}
                >
                  <Card
                    withBorder
                    padding="lg"
                    radius="lg"
                    className="card-hover"
                  >
                    <Stack gap={12}>
                      {course.thumbnail ? (
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "16/9",
                            overflow: "hidden",
                            borderRadius: 8,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              const el = e.currentTarget as HTMLImageElement;
                              el.style.display = "none";
                              const parent = el.parentElement;
                              if (parent)
                                parent.innerHTML = `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f1f5f9;color:#64748b;font-weight:600;\">Thumbnail tidak tersedia</div>`;
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "16/9",
                            overflow: "hidden",
                            borderRadius: 8,
                            background: "#f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748b",
                            fontWeight: 600,
                          }}
                        >
                          Thumbnail tidak tersedia
                        </div>
                      )}
                      <Group justify="space-between" align="flex-start">
                        <Text fw={700} lineClamp={2}>
                          {course.title}
                        </Text>
                        <Badge
                          variant="light"
                          color={course.is_published ? "teal" : "gray"}
                        >
                          {course.is_published ? "Published" : "Draft"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Instruktur:{" "}
                        {course.instructor_name || course.instructor_id}
                      </Text>
                      <Group gap={8}>
                        <Badge size="sm" variant="light">
                          {course.total_modules ?? 0} modul
                        </Badge>
                        <Badge size="sm" variant="light" color="grape">
                          {Math.round((course.duration_min ?? 0) / 60)} jam
                        </Badge>
                      </Group>
                      <Group justify="space-between" align="center">
                        <Text fw={700} c="green">
                          Rp {(course.price ?? 0).toLocaleString("id-ID")}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {course.enrolled_count ?? 0} siswa
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Button
                          component={Link}
                          href={`/admin/courses/${course.id}`}
                          variant="light"
                          size="xs"
                          leftSection={<IconEye size="1rem" />}
                        >
                          Detail
                        </Button>
                        <Group gap="xs">
                          <ActionIcon
                            variant="light"
                            color="yellow"
                            onClick={() => openEdit(course.id)}
                          >
                            <IconEdit size="1rem" />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => confirmDelete(course.id)}
                          >
                            <IconTrash size="1rem" />
                          </ActionIcon>
                        </Group>
                      </Group>
                      <Text size="xs" c="dimmed">
                        Dibuat{" "}
                        {new Date(course.created_at).toLocaleDateString(
                          "id-ID"
                        )}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          )}
          {filteredCourses.length === 0 && !loading && (
            <Stack align="center" py="xl" gap={6}>
              <IconBook size="3rem" color="gray" />
              <Text c="dimmed">Tidak ada kursus</Text>
            </Stack>
          )}
          {total > limit && (
            <Group justify="center" mt="lg">
              <Pagination
                value={page}
                onChange={setPage}
                total={Math.max(1, Math.ceil(total / limit))}
              />
            </Group>
          )}
        </Card>
      </Stack>

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setSelectedFile(null);
          setImageMeta(null);
        }}
        title={editingId ? "Edit Kursus" : "Tambah Kursus"}
        centered
        fullScreen={isMobile}
        size={isMobile ? "100%" : "lg"}
      >
        <Stack gap="md">
          <Select
            label="Instruktur"
            placeholder="Pilih instruktur"
            searchable
            nothingFoundMessage="Tidak ada"
            data={instructors}
            value={form.instructor_id}
            onChange={(v) => setForm({ ...form, instructor_id: v || "" })}
            withAsterisk
            error={errors.instructor_id}
            disabled={saving || instructorsLoading}
          />
          <TextInput
            label="Judul Kursus"
            placeholder="Masukkan judul kursus"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.currentTarget.value })}
            withAsterisk
            error={errors.title}
            disabled={saving}
          />
          <FileInput
            label="Thumbnail"
            placeholder="Pilih gambar..."
            accept="image/*"
            onChange={(file) => handlePickThumbnail(file as File)}
            withAsterisk
            error={errors.thumbnail}
            disabled={saving}
          />
          {previewUrl || form.thumbnail ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                overflow: "hidden",
                borderRadius: 8,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl || form.thumbnail}
                alt="Preview thumbnail"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16/9",
                overflow: "hidden",
                borderRadius: 8,
                background: "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Thumbnail tidak tersedia
            </div>
          )}
          {imageMeta && (
            <Text size="xs" c="dimmed">
              {imageMeta.name} • {imageMeta.sizeKB} KB • {imageMeta.width}×
              {imageMeta.height}
            </Text>
          )}
          <div>
            <Textarea
              withAsterisk
              label="Deskripsi"
              placeholder="Tulis deskripsi lengkap kursus..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.currentTarget.value })
              }
              minRows={5}
              autosize
              error={errors.description}
            />
          </div>

          {/* Modul Pengantar (Overview) Section */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: "1px solid #e9ecef",
            }}
          >
            <Title order={5} mb="sm" style={{ color: "var(--primary-color)" }}>
              📘 Modul Pengantar (Overview)
            </Title>
            <Text size="sm" c="dimmed" mb="md">
              Modul ini akan otomatis ditampilkan gratis untuk semua user
              sebagai pengenalan course
            </Text>
            <Stack gap="md">
              <TextInput
                label="Judul Modul Pengantar"
                placeholder="Contoh: Pengenalan Kursus Scratch Beginner"
                value={form.overviewTitle}
                onChange={(e) =>
                  setForm({ ...form, overviewTitle: e.currentTarget.value })
                }
                description="Judul untuk modul pengantar (opsional, default: 'Pengenalan')"
              />
              <div>
                <Text size="sm" fw={500} mb={4}>
                  Konten Modul Pengantar
                </Text>
                <Text size="xs" c="dimmed" mb={8}>
                  Jelaskan overview course, tujuan pembelajaran, alat peraga
                  yang dibutuhkan, dll.
                </Text>
                <RichTextEditor
                  value={form.overviewContent}
                  onChange={(val) => setForm({ ...form, overviewContent: val })}
                  placeholder="Tulis penjelasan lengkap tentang course ini, termasuk alat peraga jika diperlukan..."
                />
              </div>
            </Stack>
          </div>

          <Select
            label="Level"
            data={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
            value={form.level}
            onChange={(v) =>
              setForm({
                ...form,
                level:
                  (v as "beginner" | "intermediate" | "advanced") || "beginner",
              })
            }
            withAsterisk
            disabled={saving}
          />
          <Select
            label="Kategori"
            data={[
              { value: "scratch", label: "Scratch" },
              { value: "roblox", label: "Roblox" },
            ]}
            value={form.category}
            onChange={(v) =>
              setForm({
                ...form,
                category: (v as "scratch" | "roblox") || "scratch",
              })
            }
            withAsterisk
            disabled={saving}
          />
          <NumberInput
            label="Harga (Rp)"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: Number(v || 0) })}
            thousandSeparator
            min={0}
            description="Isi 0 untuk kursus gratis"
            withAsterisk
            disabled={saving}
          />
          <NumberInput
            label="Total Modul"
            value={form.totalModules}
            onChange={(v) => setForm({ ...form, totalModules: Number(v || 0) })}
            min={0}
            error={errors.totalModules}
            withAsterisk
            disabled={saving}
          />
          <NumberInput
            label="Durasi (menit)"
            value={form.durationMin}
            onChange={(v) => setForm({ ...form, durationMin: Number(v || 0) })}
            min={0}
            withAsterisk
            error={errors.durationMin}
            disabled={saving}
          />
          <NumberInput
            label="Poin Reward"
            value={form.points}
            onChange={(v) => setForm({ ...form, points: Number(v || 0) })}
            min={0}
            description="Poin yang didapat siswa setelah menyelesaikan kursus"
            withAsterisk
            disabled={saving}
          />
          <Group justify="space-between" wrap="nowrap">
            <Switch
              label="Published"
              checked={form.isPublished}
              onChange={(e) =>
                setForm({ ...form, isPublished: e.currentTarget.checked })
              }
              disabled={saving}
            />
            <Group>
              <Button
                variant="default"
                onClick={() => {
                  setOpened(false);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setSelectedFile(null);
                  setImageMeta(null);
                }}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                className="btn-primary"
                onClick={saveCourse}
                loading={saving}
                disabled={saving}
              >
                Simpan
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Kursus"
        centered
        fullScreen={isMobile}
        size={isMobile ? "100%" : "sm"}
      >
        <Stack>
          <Text>
            Yakin ingin menghapus kursus ini? Tindakan ini tidak dapat
            dibatalkan.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteId(null)}>
              Batal
            </Button>
            <Button
              color="red"
              onClick={doDelete}
              leftSection={<IconTrash size="1rem" />}
            >
              Hapus
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

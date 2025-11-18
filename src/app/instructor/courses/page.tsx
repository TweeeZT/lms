"use client";

import { Container, Title, Text, Grid, Card, Stack, Group, Badge, Button, ActionIcon, Modal, TextInput, NumberInput, Select, FileInput, Switch, Pagination, Textarea, Skeleton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBook,
  IconPlus,
  IconEye,
  IconEdit,
  IconTrash,
  IconUsers,
  IconStar,
} from "@tabler/icons-react";
import { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { useAuth } from "../../../hooks/useAuth";
import Link from "next/link";
import RichTextEditor from "../../../components/RichTextEditor";
// Page-level spinner will be used for loading instead of global loader

export default function InstructorCoursesPage() {
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  // error state handled via dialog + notifications
  type CourseRow = {
    id: string;
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
    access_duration_days?: number | null;
    created_at: string;
    updated_at?: string;
  };
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [opened, setOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    price: 0,
    isPublished: true,
    level: "beginner" as "beginner" | "intermediate" | "advanced",
    thumbnail: "",
    description: "",
    category: "scratch" as "scratch" | "roblox" | "robotics",
    durationMin: 0,
    points: 0,
    overviewTitle: "",
    overviewContent: "",
    accessDurationType: "lifetime" as "lifetime" | "limited",
    accessDurationDays: 0,
  });
  const [errors, setErrors] = useState<{
    title?: string;
    totalModules?: string;
    thumbnail?: string;
    description?: string;
  }>({});
  // no remote upload state needed; upload only on save via API
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
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0); // kept for backward-compat (list fetch)
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalStudents: 0,
    avgRating: "0",
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // errors reported via notifications only

  const myCourses: CourseRow[] = courses;
  const filteredCourses = myCourses; // server-side filtering already applied

  // validation handled inline in saveCourse

  const resetForm = () => {
    setForm({
      title: "",
      price: 0,
      isPublished: true,
      level: "beginner",
      thumbnail: "",
      description: "",
      category: "scratch",
      durationMin: 0,
      points: 0,
      overviewTitle: "",
      overviewContent: "",
      accessDurationType: "lifetime",
      accessDurationDays: 0,
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
    const c = myCourses.find((c) => c.id === id)!;
    setForm({
      title: c.title,
      price: c.price || 0,
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
      accessDurationType:
        c.access_duration_days && c.access_duration_days > 0
          ? "limited"
          : "lifetime",
      accessDurationDays: Number(c.access_duration_days || 0),
    });
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageMeta(null);
    setEditingId(id);
    setErrors({});

    setSaving(true);
    setOpened(true);

    try {
      const res = await fetch(
        `/api/instructor/courses/${id}/overview?instructorId=${user?.id}`
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

  // Local-only preview; no upload until Simpan
  const handlePickThumbnail = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageMeta(null);
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // clear remote thumbnail until saved
      setForm((f) => ({ ...f, thumbnail: "" }));
      setErrors((e) => ({ ...e, thumbnail: undefined }));
      // load dimensions
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

  // API helpers
  const fetchCourses = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        instructorId: user.id,
        q: search,
        status: statusFilter,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/instructor/courses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal memuat kursus");
      setCourses(json.items || []);
      setTotal(json.total || 0);
      // read unique-per-instructor students from API (filtered result — kept for compatibility)
      setTotalStudents(Number(json.totalUniqueStudents || 0));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat kursus";
      notifications.show({ color: "red", title: "Gagal", message: msg });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [user?.id, search, statusFilter, page, limit]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    // re-filter/refetch on search/status changes (server filters for accuracy)
    const t = setTimeout(() => fetchCourses(), 300);
    return () => clearTimeout(t);
  }, [fetchCourses, search, statusFilter, page]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Skeleton loading is used on this page; avoid global loader overlay

  // Fetch unfiltered stats once (or when user changes) and keep them stable across filtering/search
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      // Prefer dedicated stats endpoint if available
      const url = `/api/instructor/courses/stats?instructorId=${encodeURIComponent(
        user.id
      )}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setStats({
          totalCourses: Number(json.totalCourses ?? 0),
          totalStudents: Number(json.totalUniqueStudents ?? 0),
          avgRating: String(json.avgRating ?? "0"),
        });
        return;
      }
      // Fallback: try generic list with no filters to at least get total and students
      const params = new URLSearchParams({
        instructorId: user.id,
        status: "all",
        page: "1",
        limit: "1",
      });
      const res2 = await fetch(`/api/instructor/courses?${params.toString()}`);
      const json2 = await res2.json();
      if (res2.ok && json2.success) {
        setStats({
          totalCourses: Number(json2.total ?? 0),
          totalStudents: Number(json2.totalUniqueStudents ?? 0),
          avgRating: String(json2.avgRating ?? "0"),
        });
      }
    } catch (err) {
      console.error("[fetchStats]", err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const saveCourse = async () => {
    if (saving) return; // prevent spam
    if (!user) return;
    // validate against local state; require either selected file (add) or existing thumbnail (edit)
    const baseErrors: typeof errors = {};
    if (!form.title.trim()) baseErrors.title = "Judul wajib";
    if (!form.description.trim()) baseErrors.description = "Deskripsi wajib";
    // no local validation for total modules anymore
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
          fd.append("title", form.title);
          fd.append("price", String(form.price ?? 0));
          fd.append("is_published", String(!!form.isPublished));
          fd.append("level", form.level);
          fd.append("description", form.description);
          fd.append("category", form.category);
          fd.append("duration_min", String(form.durationMin));
          fd.append("points", String(form.points ?? 0));
          fd.append("overviewTitle", form.overviewTitle || "");
          fd.append("overviewContent", form.overviewContent || "");
          if (form.accessDurationType === "limited" && form.accessDurationDays > 0) {
            fd.append("access_duration_days", String(form.accessDurationDays));
          } else {
            fd.append("access_duration_days", "");
          }
          fd.append("file", selectedFile);
          fd.append("filename", selectedFile.name);
          res = await fetch(
            `/api/instructor/courses/${editingId}?instructorId=${encodeURIComponent(
              user.id
            )}`,
            { method: "PATCH", body: fd }
          );
        } else {
          res = await fetch(
            `/api/instructor/courses/${editingId}?instructorId=${encodeURIComponent(
              user.id
            )}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: form.title,
                price: form.price,
                is_published: form.isPublished,
                level: form.level,
                thumbnail: form.thumbnail,
                description: form.description,
                category: form.category,
                duration_min: form.durationMin,
                points: form.points,
                overviewTitle: form.overviewTitle || "",
                  overviewContent: form.overviewContent || "",
                  access_duration_days:
                    form.accessDurationType === "limited" &&
                    form.accessDurationDays > 0
                      ? form.accessDurationDays
                      : null,
              }),
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
        fd.append("instructorId", user.id);
        fd.append("title", form.title);
        fd.append("price", String(form.price ?? 0));
        fd.append("is_published", String(!!form.isPublished));
        fd.append("level", form.level);
        fd.append("description", form.description);
        fd.append("category", form.category);
        fd.append("duration_min", String(form.durationMin));
        fd.append("points", String(form.points ?? 0));
        fd.append("overviewTitle", form.overviewTitle || "");
        fd.append("overviewContent", form.overviewContent || "");
        if (form.accessDurationType === "limited" && form.accessDurationDays > 0) {
          fd.append("access_duration_days", String(form.accessDurationDays));
        } else {
          fd.append("access_duration_days", "");
        }
        if (selectedFile) {
          fd.append("file", selectedFile);
          fd.append("filename", selectedFile.name);
        }
        const res = await fetch(`/api/instructor/courses`, {
          method: "POST",
          body: fd,
        });
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
      // cleanup preview url to avoid leaks
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
        `/api/instructor/courses/${deleteId}?instructorId=${encodeURIComponent(
          user.id
        )}`,
        { method: "DELETE" }
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

  // Gradient stat card component (uses globals.css theme variables)
  const StatCard = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }) => {
    // Use brand gradient and soft frosted icon badge
    const bg = "var(--primary-color)"; // defined in globals.css
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
          transition: "transform .18s ease, box-shadow .18s ease",
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
          <Text size="xl" fw={800} style={{ lineHeight: 1.1, color: textColor }}>
            {value}
          </Text>
        </Stack>
      </Card>
    );
  };

  // Keep stats independent from filters; avgRating comes from stats

  // Initial full-page overlay loader (only on first navigation)
  if (loading && initialLoad) {
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

  // Selalu render halaman; gunakan Skeleton saat loading (post-initial only)

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={1} mb="md">
              Kursus Saya
            </Title>
            <Text size="lg" c="dimmed">
              Kelola dan pantau semua kursus yang Anda buat
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size="1rem" />}
            className="btn-primary"
            onClick={openAdd}
          >
            Buat Kursus Baru
          </Button>
        </Group>

        {/* Stats */}
        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <StatCard label="Total Kursus" value={String(stats.totalCourses)} icon={IconBook} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <StatCard label="Total Siswa" value={String(stats.totalStudents)} icon={IconUsers} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <StatCard label="Rata-rata Rating" value={stats.avgRating} icon={IconStar} />
          </Grid.Col>
        </Grid>

        <Card padding="xl" radius="lg" withBorder>
          {/* Filters */}
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
                { value: "published", label: "Tayang" },
                { value: "draft", label: "Draf" },
              ]}
              style={{ width: 180 }}
            />
            <div style={{ marginLeft: "auto" }}>
              {loading && !initialLoad ? (
                <Skeleton height={12} width={70} />
              ) : (
                <Text size="xs" c="dimmed">
                  {total} hasil
                </Text>
              )}
            </div>
          </Group>
          {/* Grid cards */}
          <Grid gutter="xl">
            {loading && !initialLoad
              ? Array.from({ length: limit }).map((_, idx) => (
                  <Grid.Col key={`skeleton-${idx}`} span={{ base: 12, sm: 6, md: 6, lg: 4 }}>
                    <Card withBorder padding="lg" radius="lg">
                      <Stack gap={12}>
                        <Skeleton height={0} style={{ paddingTop: "56.25%", borderRadius: 8 }} />
                        <Group justify="space-between" align="flex-start">
                          <Skeleton height={18} width="70%" />
                          <Skeleton height={20} width={64} />
                        </Group>
                        <Group gap={8}>
                          <Skeleton height={20} width={80} />
                          <Skeleton height={20} width={80} />
                        </Group>
                        <Group justify="space-between" align="center">
                          <Skeleton height={18} width={120} />
                          <Skeleton height={14} width={80} />
                        </Group>
                        <Group justify="space-between">
                          <Skeleton height={28} width={90} />
                          <Group gap="xs">
                            <Skeleton height={28} width={32} />
                            <Skeleton height={28} width={32} />
                          </Group>
                        </Group>
                        <Skeleton height={12} width={120} />
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))
              : filteredCourses.map((course) => (
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
                        color={course.is_published ?? false ? "teal" : "gray"}
                      >
                        {course.is_published ?? false ? "Tayang" : "Draf"}
                      </Badge>
                    </Group>
                    <Group gap={8}>
                      <Badge size="sm" variant="light">
                        {course.total_modules ?? 0} modul
                      </Badge>
                      <Badge size="sm" variant="light" color="grape">
                        {Math.round((course.duration_min ?? 0) / 60)} jam
                      </Badge>
                      <Badge size="sm" variant="light" color="blue">
                        {course.access_duration_days && course.access_duration_days > 0
                          ? `${course.access_duration_days} hari akses`
                          : "Akses seumur hidup"}
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
                        href={`/instructor/courses/${course.id}`}
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
          {!loading && filteredCourses.length === 0 && (
            <Stack align="center" py="xl" gap={6}>
              <IconBook size="3rem" color="gray" />
              <Text c="dimmed">Tidak ada kursus memenuhi filter</Text>
            </Stack>
          )}
          {!loading && total > limit && (
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

      {/* Add / Edit Modal */}
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
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.currentTarget.value })
              }
              placeholder="Tulis deskripsi lengkap kursus Anda..."
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
              { value: "beginner", label: "Pemula" },
              { value: "intermediate", label: "Menengah" },
              { value: "advanced", label: "Lanjutan" },
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
              { value: "robotics", label: "Robotik" },
            ]}
            value={form.category}
            onChange={(v) =>
              setForm({
                ...form,
                category: (v as "scratch" | "roblox" | "robotics") || "scratch",
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
          {/* Total Modul input removed — module count is computed from modules table */}
          <NumberInput
            label="Durasi (menit)"
            value={form.durationMin}
            onChange={(v) => setForm({ ...form, durationMin: Number(v || 0) })}
            min={0}
            withAsterisk
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
          <Group align="flex-end" grow>
            <Select
              label="Masa Akses"
              data={[
                { value: "lifetime", label: "Permanen (seumur hidup)" },
                { value: "limited", label: "Durasi tertentu" },
              ]}
              value={form.accessDurationType}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  accessDurationType:
                    (v as "lifetime" | "limited") || "lifetime",
                }))
              }
              disabled={saving}
            />
            {form.accessDurationType === "limited" && (
              <NumberInput
                label="Durasi (hari)"
                value={form.accessDurationDays}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    accessDurationDays: Number(v || 0),
                  }))
                }
                min={1}
                description="Contoh: 180 untuk 6 bulan, 365 untuk 1 tahun"
                disabled={saving}
              />
            )}
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Switch
              label="Tayang"
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

      {/* Delete Confirm */}
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

      {/* all errors via notifications */}
    </Container>
  );
}

//

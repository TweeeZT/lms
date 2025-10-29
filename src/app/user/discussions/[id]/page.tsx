"use client";

import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Avatar,
  ActionIcon,
  Button,
  Badge,
  TextInput,
  Tooltip,
  Image,
  SimpleGrid,
  Divider,
  Skeleton,
  Textarea,
  FileInput,
  Modal,
} from "@mantine/core";
import {
  IconHeart,
  IconArrowLeft,
  IconSend,
  IconVideo,
  IconEdit,
  IconTrash,
  IconPhoto,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../../../hooks/useAuth";
import { MediaGrid } from "../../../../components/MediaGrid";
import { notifications } from "@mantine/notifications";

type ApiComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    avatar?: string | null;
    role?: string | null;
  } | null;
};

type ApiPost = {
  id: string;
  user_id: string;
  user: {
    id: string;
    full_name: string;
    avatar?: string | null;
    role?: string | null;
  } | null;
  title: string;
  content: string;
  likes: number;
  tags: string[];
  created_at: string;
  media: Array<{
    id: string;
    post_id: string;
    m_type: "image" | "video";
    url: string;
    thumbnail?: string | null;
  }>;
  comments: ApiComment[];
};

function relativeTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const dd = Math.floor(h / 24);

  if (sec < 60) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;

  return d.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserPostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<ApiPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editPreviews, setEditPreviews] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<ApiPost["media"]>([]);
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myOtherPosts, setMyOtherPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [editingComment, setEditingComment] = useState<ApiComment | null>(null);
  const [editText, setEditText] = useState("");
  const [editTitleTouched, setEditTitleTouched] = useState(false);
  const [editContentTouched, setEditContentTouched] = useState(false);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_WORDS = 1500;
  const editWordCount = editContent.trim().split(/\s+/).filter(Boolean).length;
  const editTitleError =
    editTitleTouched && editTitle.trim().length === 0
      ? "Judul harus diisi"
      : editTitleTouched && editTitle.trim().length < 3
      ? "Judul minimal 3 karakter"
      : null;
  const editContentError =
    editContentTouched && editWordCount < 3
      ? "Deskripsi minimal 3 kata"
      : editContentTouched && editWordCount > MAX_WORDS
      ? `Maksimal ${MAX_WORDS} kata`
      : null;
  const canSaveEdit =
    editTitle.trim().length >= 3 &&
    editWordCount >= 3 &&
    editWordCount <= MAX_WORDS &&
    !savingEdit;

  // Map backend role to human label and color
  const getRoleLabel = (r?: string | null) => {
    if (!r) return null;
    const map: Record<string, string> = {
      instructor: "Instruktur",
      user: "Siswa",
      school: "Sekolah",
      admin: "Admin",
    };
    return map[r] || r;
  };
  const getRoleColor = (r?: string | null) => {
    if (!r) return "gray";
    const map: Record<string, string> = {
      instructor: "indigo",
      user: "teal",
      school: "orange",
      admin: "red",
    };
    return map[r] || "gray";
  };
  const [likeLoading, setLikeLoading] = useState(false);
  const likeKey = (id: string) => `disc-liked-${id}`;
  const [confirmEditComment, setConfirmEditComment] = useState(false);
  const [confirmDeleteComment, setConfirmDeleteComment] =
    useState<ApiComment | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/user/discussions/${postId}?userId=${user.id}`
      );
      const json = await res.json();
      if (res.ok && json.success) setPost(json.item as ApiPost);
    } finally {
      setLoading(false);
    }
  }
  async function loadMyOthers(currentUserId: string) {
    try {
      const res = await fetch(
        `/api/user/discussions?userId=${currentUserId}&mine=true&limit=5&page=1`
      );
      const json = await res.json();
      if (res.ok && json.success) {
        const items: ApiPost[] = json.items || [];
        type MaybeComments = ApiPost & { comments?: ApiComment[] };
        setMyOtherPosts(
          (items as MaybeComments[])
            .filter((p) => p.id !== postId)
            .map((p) => ({
              ...p,
              comments: Array.isArray(p.comments) ? p.comments : [],
            }))
        );
      }
    } catch {}
  }

  useEffect(() => {
    load();
    if (user) loadMyOthers(user.id);
  }, [user, postId]);

  useEffect(() => {
    return () => {
      editPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editPreviews]);

  const addEditFiles = (incoming: File[]) => {
    const accepted: File[] = [];
    const urls: string[] = [];
    incoming.forEach((f) => {
      if (!/^(image|video)\//i.test(f.type)) {
        notifications.show({
          title: "Format tidak didukung",
          message: `${f.name} bukan gambar/video`,
          color: "red",
        });
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        notifications.show({
          title: "File terlalu besar",
          message: `${f.name} melebihi 10MB`,
          color: "red",
        });
        return;
      }
      accepted.push(f);
      urls.push(URL.createObjectURL(f));
    });
    if (accepted.length) {
      setEditFiles((prev) => [...prev, ...accepted]);
      setEditPreviews((prev) => [...prev, ...urls]);
    }
  };

  const removeNewFile = (idx: number) => {
    const url = editPreviews[idx];
    if (url) URL.revokeObjectURL(url);
    setEditFiles((prev) => prev.filter((_, i) => i !== idx));
    setEditPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleLike = async () => {
    if (!user || !post || likeLoading) return;

    setLikeLoading(true);
    const liked = localStorage.getItem(likeKey(post.id)) === "1";

    // Optimistic update
    setPost({
      ...post,
      likes: Math.max(0, (post.likes || 0) + (liked ? -1 : 1)),
    });

    try {
      const res = await fetch(`/api/user/discussions/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: liked ? "unlike" : "like",
        }),
      });

      const json = await res.json();

      if (res.status === 429) {
        // Rate limited - revert optimistic update
        setPost({
          ...post,
          likes: post.likes,
        });
        notifications.show({
          title: "Terlalu Cepat",
          message: json.error || "Mohon tunggu sebentar",
          color: "yellow",
        });
      } else if (res.ok) {
        localStorage.setItem(likeKey(post.id), liked ? "0" : "1");
        load(); // Refresh to get accurate count
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const startEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content.replaceAll("\\r\\n", "\n"));
    setEditTags(post.tags || []);
    setExistingMedia(post.media || []);
    setEditFiles([]);
    editPreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditPreviews([]);
    setMediaToDelete([]);
    setEditTitleTouched(false);
    setEditContentTouched(false);
    setEditing(true);
  };

  const removeExistingMedia = (mediaId: string) => {
    setMediaToDelete((prev) => [...prev, mediaId]);
    setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditFiles([]);
    editPreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditPreviews([]);
    setMediaToDelete([]);
    setEditTitleTouched(false);
    setEditContentTouched(false);
  };

  const saveEdit = async () => {
    if (!user || !post) return;
    if (!canSaveEdit) {
      setEditTitleTouched(true);
      setEditContentTouched(true);
      return;
    }
    setSavingEdit(true);
    try {
      // 1. Update post text
      const res = await fetch(`/api/user/discussions/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "update",
          title: editTitle.trim(),
          content: editContent.trim(),
          tags: editTags || [],
        }),
      });

      if (!res.ok) {
        notifications.show({
          title: "Gagal",
          message: "Gagal update postingan",
          color: "red",
        });
        return;
      }

      // 2. Update media (delete old + upload new)
      if (mediaToDelete.length > 0 || editFiles.length > 0) {
        const fd = new FormData();
        fd.set("userId", user.id);
        if (mediaToDelete.length > 0) {
          fd.set("deleteMediaIds", JSON.stringify(mediaToDelete));
        }
        editFiles.forEach((f) => fd.append("files", f));

        const mediaRes = await fetch(`/api/user/discussions/${postId}/media`, {
          method: "PATCH",
          body: fd,
        });

        if (!mediaRes.ok) {
          notifications.show({
            title: "Gagal",
            message: "Gagal update media",
            color: "red",
          });
        }
      }

      // Refresh post data
      await load();
      setEditing(false);
      setEditFiles([]);
      setMediaToDelete([]);
      notifications.show({
        title: "Berhasil",
        message: "Postingan berhasil diupdate",
        color: "green",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!user || !post) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/discussions/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        notifications.show({
          title: "Berhasil",
          message: "Postingan telah dihapus",
          color: "green",
        });
        router.push("/user/discussions");
      } else {
        notifications.show({
          title: "Gagal",
          message: "Gagal menghapus postingan",
          color: "red",
        });
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false); // tutup modal
    }
  };

  const addComment = async () => {
    if (!user || !commentText.trim()) return;
    const content = commentText.trim();
    setCommentText("");
    if (post) {
      setPost({
        ...post,
        comments: [
          ...post.comments,
          {
            id: `tmp-${Date.now()}`,
            user_id: user.id,
            content,
            created_at: new Date().toISOString(),
            user: {
              id: user.id,
              full_name: user.fullName,
              avatar: user.avatar,
              role: user.role,
            },
          },
        ],
      });
    }
    await fetch(`/api/user/discussions/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, content }),
    });
    load();
  };

  const startEditComment = (comment: ApiComment) => {
    setEditingComment(comment);
    setEditText(comment.content);
    setConfirmEditComment(true);
  };

  const confirmEditCommentAction = () => {
    setConfirmEditComment(false);
    // Continue with editing
  };

  const saveEditComment = async () => {
    if (!user || !editingComment) return;
    await fetch(
      `/api/user/discussions/${postId}/comments/${editingComment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, content: editText }),
      }
    );
    setEditingComment(null);
    setEditText("");
    load();
    notifications.show({
      title: "Berhasil",
      message: "Komentar berhasil diupdate",
      color: "green",
    });
  };

  const handleDeleteComment = async () => {
    if (!user || !confirmDeleteComment) return;
    await fetch(
      `/api/user/discussions/${postId}/comments/${confirmDeleteComment.id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      }
    );
    setConfirmDeleteComment(null);
    load();
    notifications.show({
      title: "Berhasil",
      message: "Komentar berhasil dihapus",
      color: "green",
    });
  };

  if (loading) {
    return (
      <Container size="xl">
        <Stack gap="lg">
          <Skeleton height={36} width={200} />
          <Skeleton height={200} radius="md" />
          <Skeleton height={120} radius="md" />
        </Stack>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container size="xl">
        <Stack gap="lg">
          <Button
            leftSection={<IconArrowLeft size="1rem" />}
            variant="light"
            onClick={() => router.back()}
          >
            Kembali
          </Button>
          <Text>Post tidak ditemukan</Text>
        </Stack>
      </Container>
    );
  }

  const from = "var(--primary-color)";
  const to = "var(--secondary-color)";

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Group>
          <Button
            leftSection={<IconArrowLeft size="1rem" />}
            variant="light"
            onClick={() => router.back()}
          >
            Kembali ke Forum
          </Button>
          {user && post && user.id === post.user_id && !editing && (
            <Group gap="sm">
              <Button
                size="sm"
                leftSection={<IconEdit size="1rem" />}
                onClick={startEdit}
              >
                Edit
              </Button>
              <Button
                size="sm"
                color="red"
                leftSection={<IconTrash size="1rem" />}
                onClick={() => setConfirmDelete(true)}
              >
                Hapus
              </Button>
            </Group>
          )}
        </Group>

        {/* Modal Konfirmasi Hapus */}
        <Modal
          opened={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Konfirmasi Hapus Postingan"
          centered
        >
          <Stack>
            <Text>
              Apakah kamu yakin ingin menghapus postingan ini beserta semua
              komentar dan media terkait?
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => setConfirmDelete(false)}>
                Batal
              </Button>
              <Button
                color="red"
                loading={deleting}
                onClick={handleDeleteConfirm}
              >
                Hapus
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Edit */}
        <Modal
          opened={editing}
          onClose={cancelEdit}
          title="Edit Postingan"
          size="lg"
        >
          <Stack gap="md">
            <TextInput
              label="Judul"
              placeholder="Judul postingan"
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.currentTarget.value);
                if (!editTitleTouched) setEditTitleTouched(true);
              }}
              onBlur={() => setEditTitleTouched(true)}
              error={editTitleError}
              required
              disabled={savingEdit}
            />
            <Stack gap={4}>
              <Group justify="space-between">
                <Text fw={500} size="sm">
                  Deskripsi
                </Text>
                <Text
                  size="xs"
                  c={editContentTouched && editContentError ? "red" : "dimmed"}
                >
                  {editWordCount}/{MAX_WORDS} kata
                </Text>
              </Group>
              <Textarea
                placeholder="Isi postingan"
                value={editContent}
                onChange={(e) => {
                  setEditContent(e.currentTarget.value);
                  if (!editContentTouched) setEditContentTouched(true);
                }}
                onBlur={() => setEditContentTouched(true)}
                error={editContentError}
                minRows={5}
                required
                disabled={savingEdit}
              />
            </Stack>

            {/* Existing Media */}
            {existingMedia.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Gambar/Video Saat Ini:
                </Text>
                <SimpleGrid cols={3} spacing="xs">
                  {existingMedia.map((m) => (
                    <Card
                      key={m.id}
                      p={0}
                      radius="md"
                      style={{ position: "relative" }}
                    >
                      <Image
                        src={
                          m.m_type === "video"
                            ? m.thumbnail || undefined
                            : m.url
                        }
                        alt="media"
                        radius="md"
                        style={{ objectFit: "cover", height: 100 }}
                      />
                      <ActionIcon
                        color="red"
                        size="sm"
                        radius="xl"
                        variant="filled"
                        style={{ position: "absolute", top: 4, right: 4 }}
                        onClick={() => removeExistingMedia(m.id)}
                        disabled={savingEdit}
                      >
                        <IconX size="1rem" />
                      </ActionIcon>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>
            )}

            {/* Upload New Media */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Tambah Gambar/Video Baru (opsional)
              </Text>
              <label
                htmlFor="edit-media-upload"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 6,
                  border: "2px dashed var(--primary-color)",
                  borderRadius: 12,
                  padding: "20px",
                  background: "var(--accent-color)",
                  color: "var(--primary-color)",
                  cursor: savingEdit ? "not-allowed" : "pointer",
                  opacity: savingEdit ? 0.6 : 1,
                }}
                className="card-hover"
              >
                <span style={{ fontWeight: 500 }}>
                  Klik untuk pilih file baru
                </span>
                <Text size="xs" c="dimmed">
                  Format: gambar / video, maksimal 10MB per file
                </Text>
              </label>
              <input
                id="edit-media-upload"
                type="file"
                multiple
                accept="image/*,video/*"
                hidden
                disabled={savingEdit}
                onChange={(e) => {
                  const selected = Array.from(e.currentTarget.files || []);
                  addEditFiles(selected);
                  e.currentTarget.value = "";
                }}
              />
              {editPreviews.length > 0 && (
                <SimpleGrid
                  cols={Math.min(3, editPreviews.length)}
                  spacing="xs"
                >
                  {editPreviews.map((src, idx) => {
                    const file = editFiles[idx];
                    const isVideo = file?.type?.startsWith("video/");
                    return (
                      <Card
                        key={`${src}-${idx}`}
                        p={0}
                        radius="md"
                        style={{ position: "relative", overflow: "hidden" }}
                      >
                        {isVideo ? (
                          <div
                            style={{
                              position: "relative",
                              width: "100%",
                              height: 110,
                              background: "#0f172a",
                            }}
                          >
                            <video
                              src={src}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                              muted
                            />
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(0,0,0,0.3)",
                              }}
                            >
                              <IconVideo size={18} color="#fff" />
                            </div>
                          </div>
                        ) : (
                          <Image
                            src={src}
                            alt={`Media baru ${idx + 1}`}
                            radius="md"
                            height={110}
                            fit="cover"
                          />
                        )}
                        <ActionIcon
                          color="red"
                          size="sm"
                          radius="xl"
                          variant="filled"
                          style={{ position: "absolute", top: 4, right: 4 }}
                          onClick={() => removeNewFile(idx)}
                          disabled={savingEdit}
                        >
                          <IconX size="1rem" />
                        </ActionIcon>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>

            <Group justify="flex-end" gap="sm" mt="md">
              <Button
                variant="subtle"
                onClick={cancelEdit}
                disabled={savingEdit}
              >
                Batal
              </Button>
              <Button
                loading={savingEdit}
                onClick={saveEdit}
                disabled={!canSaveEdit}
                styles={{
                  root: {
                    "&[dataDisabled]": {
                      cursor: "not-allowed",
                      pointerEvents: "all",
                    },
                  },
                }}
              >
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Card
          padding="xl"
          radius="md"
          withBorder
          style={{
            position: "relative",
            overflow: "hidden",
            border: `2px solid ${from}60`,
            background:
              "linear-gradient(135deg,var(--mantine-color-body), var(--mantine-color-body))",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${from}15, ${to}15)`,
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 80% 20%, rgba(255,255,255,.2), transparent 70%)",
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />

          <Stack gap="lg" style={{ position: "relative", zIndex: 2 }}>
            <Group align="start" wrap="nowrap">
              <Avatar
                radius="xl"
                size="lg"
                src={post.user?.avatar || undefined}
              >
                {(post.user?.full_name || "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Avatar>
              <Stack gap={6} style={{ flex: 1 }}>
                <Stack gap={4}>
                  <Group gap={12} wrap="wrap" align="center">
                    <Text fw={700} size="sm">
                      {post.user?.full_name || "Pengguna"}
                    </Text>
                    {post.user?.role && (
                      <Badge
                        size="sm"
                        variant="light"
                        color={getRoleColor(post.user.role)}
                      >
                        {getRoleLabel(post.user.role)}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {relativeTime(post.created_at)}
                  </Text>
                </Stack>
                <Title order={3}>{post.title}</Title>
                <Text
                  size="sm"
                  style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}
                >
                  {post.content
                    .replaceAll("\\r\\n", "\n")
                    .replaceAll("\\n\\n", "\n")}
                </Text>
                {post.tags?.length > 0 && (
                  <Group gap={8} wrap="wrap" mt="xs">
                    {post.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="gradient"
                        gradient={{ from, to }}
                        size="sm"
                      >
                        #{t}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Stack>
            </Group>

            {/* Media Grid */}
            {post.media && post.media.length > 0 && (
              <MediaGrid media={post.media} />
            )}

            <Group gap="xl" mt="md">
              <Tooltip label={likeLoading ? "Loading..." : "Suka"} withArrow>
                <ActionIcon
                  variant={
                    localStorage.getItem(likeKey(post.id)) === "1"
                      ? "filled"
                      : "subtle"
                  }
                  color="red"
                  size="lg"
                  onClick={toggleLike}
                  loading={likeLoading}
                  disabled={likeLoading}
                  style={{
                    background:
                      localStorage.getItem(likeKey(post.id)) === "1"
                        ? "#ff6b6b"
                        : undefined,
                    color:
                      localStorage.getItem(likeKey(post.id)) === "1"
                        ? "#fff"
                        : undefined,
                  }}
                >
                  <IconHeart size="1.2rem" />
                </ActionIcon>
              </Tooltip>
              <Text size="sm" c="dimmed">
                {post.likes} suka
              </Text>
              <Text size="sm" c="dimmed">
                {post.comments.length} komentar
              </Text>
            </Group>
          </Stack>
        </Card>

        <Stack gap="lg">
          <Title order={4}>Komentar ({post.comments.length})</Title>
          <Card padding="md" radius="md" withBorder>
            <Group align="start" wrap="nowrap">
              <Avatar radius="xl" size="md" src={user?.avatar}>
                {(user?.fullName || "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </Avatar>
              <Stack style={{ flex: 1 }} gap="xs">
                <TextInput
                  placeholder="Tulis komentar..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                />
                <Group justify="flex-end">
                  <Button
                    size="sm"
                    leftSection={<IconSend size="1rem" />}
                    onClick={addComment}
                    disabled={!commentText.trim()}
                  >
                    Kirim
                  </Button>
                </Group>
              </Stack>
            </Group>
          </Card>

          <Stack gap="md">
            {post.comments.map((c) => (
              <Card key={c.id} radius="md" withBorder>
                <Group align="start" wrap="nowrap">
                  <Avatar
                    radius="xl"
                    size="sm"
                    src={c.user?.avatar || undefined}
                  >
                    {(c.user?.full_name || "?")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </Avatar>
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs" align="center">
                        <Text fw={600} size="sm">
                          {c.user?.full_name || "Pengguna"}
                        </Text>
                        {c.user?.role && (
                          <Badge
                            size="xs"
                            variant="light"
                            color={getRoleColor(c.user.role)}
                          >
                            {getRoleLabel(c.user.role)}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {relativeTime(c.created_at)}
                      </Text>
                    </Group>
                    {editingComment?.id === c.id ? (
                      <Stack gap="xs">
                        <TextInput
                          value={editText}
                          onChange={(e) => setEditText(e.currentTarget.value)}
                        />
                        <Group gap="xs">
                          <Button size="xs" onClick={saveEditComment}>
                            Simpan
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingComment(null)}
                          >
                            Batal
                          </Button>
                        </Group>
                      </Stack>
                    ) : (
                      <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                        {c.content}
                      </Text>
                    )}
                  </Stack>
                  {/* Aksi Edit & Hapus Komentar */}
                  {user?.id === c.user_id && (
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() => startEditComment(c)}
                      >
                        <IconEdit size="1rem" />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() => setConfirmDeleteComment(c)}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>

        {/* Modal Konfirmasi Edit Komentar */}
        <Modal
          opened={confirmEditComment}
          onClose={() => {
            setConfirmEditComment(false);
            setEditingComment(null);
          }}
          title="Konfirmasi Edit Komentar"
          centered
        >
          <Stack>
            <Text>Apakah kamu yakin ingin mengedit komentar ini?</Text>
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setConfirmEditComment(false);
                  setEditingComment(null);
                }}
              >
                Batal
              </Button>
              <Button color="blue" onClick={confirmEditCommentAction}>
                Ya, Edit
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Konfirmasi Hapus Komentar */}
        <Modal
          opened={!!confirmDeleteComment}
          onClose={() => setConfirmDeleteComment(null)}
          title="Konfirmasi Hapus Komentar"
          centered
        >
          <Stack>
            <Text>
              Apakah kamu yakin ingin menghapus komentar ini? Tindakan ini tidak
              bisa dibatalkan.
            </Text>
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => setConfirmDeleteComment(null)}
              >
                Batal
              </Button>
              <Button color="red" onClick={handleDeleteComment}>
                Hapus
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}

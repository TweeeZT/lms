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
  Modal,
} from "@mantine/core";
import {
  IconHeart,
  IconArrowLeft,
  IconSend,
  IconVideo,
  IconEdit,
  IconTrash,
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

export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<ApiPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [editingComment, setEditingComment] = useState<ApiComment | null>(null);
  const [editText, setEditText] = useState("");
  const likeKey = (id: string) => `disc-liked-${id}`;
  const [confirmEditComment, setConfirmEditComment] = useState(false);
  const [confirmDeleteComment, setConfirmDeleteComment] =
    useState<ApiComment | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/instructor/discussions/${postId}?instructorId=${user.id}`
      );
      const json = await res.json();
      if (res.ok && json.success) setPost(json.item as ApiPost);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user, postId]);

  const toggleLike = async () => {
    if (!user || !post) return;
    const liked = localStorage.getItem(likeKey(post.id)) === "1";
    setPost({
      ...post,
      likes: Math.max(0, (post.likes || 0) + (liked ? -1 : 1)),
    });
    await fetch(`/api/instructor/discussions/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instructorId: user.id,
        action: liked ? "unlike" : "like",
      }),
    });
    localStorage.setItem(likeKey(post.id), liked ? "0" : "1");
    load();
  };

  const addComment = async () => {
    if (!user || !commentText.trim()) return;
    const content = commentText.trim();
    setCommentText("");
    // optimistic
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
    await fetch(`/api/instructor/discussions/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructorId: user.id, content }),
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
      `/api/instructor/discussions/${postId}/comments/${editingComment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId: user.id, content: editText }),
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
      `/api/instructor/discussions/${postId}/comments/${confirmDeleteComment.id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId: user.id }),
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

  // Use brand colors from CSS variables
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
        </Group>

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
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap={12}>
                    <Text fw={700} size="sm">
                      {post.user?.full_name || "Pengguna"}
                    </Text>
                    <Badge size="sm" variant="light">
                      {post.user?.role || "user"}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {relativeTime(post.created_at)}
                  </Text>
                </Group>

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
              <Tooltip label="Suka" withArrow>
                <ActionIcon
                  variant={
                    localStorage.getItem(likeKey(post.id)) === "1"
                      ? "filled"
                      : "subtle"
                  }
                  color="red"
                  size="lg"
                  onClick={toggleLike}
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

        <Divider />

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
                      <Text fw={600} size="sm">
                        {c.user?.full_name || "Pengguna"}
                      </Text>
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

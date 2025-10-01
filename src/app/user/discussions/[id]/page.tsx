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
} from "@mantine/core";
import {
  IconHeart,
  IconArrowLeft,
  IconSend,
  IconVideo,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../../../hooks/useAuth";

type ApiComment = {
  id: string;
  user_id: string;
  content: string;
  likes: number;
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
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default function UserPostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const postId = params.id as string;

  const [post, setPost] = useState<ApiPost | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [myOtherPosts, setMyOtherPosts] = useState<ApiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const likeKey = (id: string) => `disc-liked-${id}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, postId]);

  const toggleLike = async () => {
    if (!user || !post) return;
    const liked = localStorage.getItem(likeKey(post.id)) === "1";
    setPost({
      ...post,
      likes: Math.max(0, (post.likes || 0) + (liked ? -1 : 1)),
    });
    await fetch(`/api/user/discussions/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        action: liked ? "unlike" : "like",
      }),
    });
    localStorage.setItem(likeKey(post.id), liked ? "0" : "1");
    load();
  };

  const startEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content.replaceAll("\\r\\n", "\n"));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!user || !post) return;
    if (!editTitle.trim() || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/user/discussions/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          action: "update",
          title: editTitle.trim(),
          content: editContent.trim(),
          tags: post.tags || [],
        }),
      });
      if (res.ok) {
        setPost({
          ...post,
          title: editTitle.trim(),
          content: editContent.trim(),
        });
        setEditing(false);
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const deletePost = async () => {
    if (!user || !post) return;
    if (!confirm("Hapus postingan ini beserta semua komentar & media?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/discussions/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        router.push("/user/discussions");
      }
    } finally {
      setDeleting(false);
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
            likes: 0,
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
              <Button size="sm" variant="outline" onClick={startEdit}>
                Edit
              </Button>
              <Button
                size="sm"
                color="red"
                loading={deleting}
                onClick={deletePost}
              >
                Hapus
              </Button>
            </Group>
          )}
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
                {editing ? (
                  <Stack gap={8} mt="sm">
                    <TextInput
                      placeholder="Judul"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.currentTarget.value)}
                    />
                    <TextInput
                      placeholder="Konten"
                      value={editContent}
                      onChange={(e) => setEditContent(e.currentTarget.value)}
                      styles={{ input: { minHeight: 80 } }}
                      multiple
                    />
                    <Group gap="sm" justify="flex-end">
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        loading={savingEdit}
                        onClick={saveEdit}
                        disabled={!editTitle.trim() || !editContent.trim()}
                      >
                        Simpan
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Text
                    size="sm"
                    style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}
                  >
                    {post.content
                      .replaceAll("\\r\\n", "\n")
                      .replaceAll("\\n\\n", "\n")}
                  </Text>
                )}
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

            {post.media?.length > 0 && (
              <SimpleGrid
                cols={
                  post.media.length === 1 ? 1 : post.media.length === 2 ? 2 : 3
                }
                spacing={8}
              >
                {post.media.map((m) => (
                  <Card
                    key={m.id}
                    p={0}
                    radius="md"
                    style={{ position: "relative" }}
                  >
                    <Image
                      src={
                        m.m_type === "video" ? m.thumbnail || undefined : m.url
                      }
                      alt="media"
                      radius="md"
                      style={{ objectFit: "cover" }}
                    />
                    {m.m_type === "video" && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconVideo size={32} color="#fff" />
                      </div>
                    )}
                  </Card>
                ))}
              </SimpleGrid>
            )}

            <Group gap="xl" mt="md">
              <Tooltip label="Suka" withArrow>
                <ActionIcon
                  variant="light"
                  color="red"
                  size="lg"
                  onClick={toggleLike}
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

        {myOtherPosts.length > 0 && (
          <Stack gap="md">
            <Title order={5}>Postingan Saya Lainnya</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {myOtherPosts.map((p) => (
                <Card
                  key={p.id}
                  withBorder
                  radius="md"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/user/discussions/${p.id}`)}
                >
                  <Stack gap={6}>
                    <Text fw={600} size="sm" lineClamp={1}>
                      {p.title}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={3}>
                      {p.content.replaceAll("\\r\\n", " ").slice(0, 160)}
                    </Text>
                    <Group gap={6}>
                      <Badge size="xs" variant="light">
                        {p.likes} suka
                      </Badge>
                      <Badge size="xs" variant="outline">
                        {p.comments && Array.isArray(p.comments)
                          ? p.comments.length
                          : 0}{" "}
                        komentar
                      </Badge>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        )}

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
                    <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                      {c.content}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}

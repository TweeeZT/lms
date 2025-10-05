"use client";

import {
  Container,
  Title,
  Text,
  Stack,
  Group,
  Avatar,
  ActionIcon,
  Button,
  Badge,
  SegmentedControl,
  TextInput,
  Image,
  Select,
  Pagination,
  Skeleton,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconHeart, IconPlus, IconVideo, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useAuth } from "../../../hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

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
};

export default function UserDiscussionsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / (limit || 10)));

  // Modal zoom image
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  // Modal video playback
  const [playVideo, setPlayVideo] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId: user.id,
        sort,
        page: String(page),
        limit: String(limit),
        mine: String(filter === "mine"),
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/user/discussions?${params}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.items as ApiPost[]);
        setTotal(json.total as number);
      }
    } finally {
      setLoading(false);
    }
  }, [user, sort, page, limit, q, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const likedKey = (id: string) => `disc-liked-${id}`;
  const toggleLike = async (id: string) => {
    if (!user) return;
    const liked = localStorage.getItem(likedKey(id)) === "1";
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, likes: Math.max(0, (p.likes || 0) + (liked ? -1 : 1)) }
          : p
      )
    );
    localStorage.setItem(likedKey(id), liked ? "0" : "1");
    await fetch(`/api/user/discussions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        action: liked ? "unlike" : "like",
      }),
    });
    fetchItems();
  };
  const isLiked = (id: string) => localStorage.getItem(likedKey(id)) === "1";

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

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>Forum Diskusi</Title>
            <Text size="xs" c="dimmed">
              Bagikan pengetahuan dan diskusi dengan sesama
            </Text>
          </div>
          <Group>
            <SegmentedControl
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
              data={[
                { label: "Semua", value: "all" },
                { label: "Postingan Saya", value: "mine" },
              ]}
            />
            <Select
              data={[
                { value: "latest", label: "Terbaru" },
                { value: "popular", label: "Terpopuler" },
              ]}
              value={sort}
              onChange={(v) => {
                setSort((v as "latest" | "popular") || "latest");
                setPage(1);
              }}
            />
            <Button
              component={Link}
              href="/user/discussions/new"
              leftSection={<IconPlus size="1rem" />}
            >
              Post Baru
            </Button>
          </Group>
        </Group>

        <TextInput
          placeholder="Cari judul/konten..."
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && setPage(1)}
        />

        {loading && items.length === 0 ? (
          <Stack gap="md">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} height={120} radius="md" />
            ))}
          </Stack>
        ) : (
          <Stack gap="md">
            {items.map((post) => {
              const cover =
                post.media && post.media.length > 0 ? post.media[0] : null;
              const isVideo = cover?.m_type === "video";
              const hasActualMedia = cover && (cover.url || cover.thumbnail);
              const coverSrc = isVideo
                ? cover?.thumbnail || undefined
                : cover?.url;
              const extraCount = Math.max(0, (post.media?.length || 0) - 1);
              const liked = isLiked(post.id);

              return (
                <div
                  key={post.id}
                  style={{
                    padding: "20px",
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e9ecef",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                  onClick={() =>
                    (window.location.href = `/user/discussions/${post.id}`)
                  }
                >
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    <Avatar
                      radius="xl"
                      size="md"
                      src={post.user?.avatar || undefined}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      {(post.user?.full_name || "U")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" mb={8}>
                        <Text fw={600} size="sm" c="dark">
                          {post.user?.full_name || "Pengguna"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          •
                        </Text>
                        <Text size="xs" c="dimmed">
                          {relativeTime(post.created_at)}
                        </Text>
                        {post.tags?.[0] && (
                          <>
                            <Text size="xs" c="dimmed">
                              •
                            </Text>
                            <Badge size="xs" variant="light" color="blue">
                              {post.tags[0]}
                            </Badge>
                          </>
                        )}
                      </Group>
                      <div style={{ marginBottom: 12 }}>
                        <Text fw={600} size="sm" mb={6}>
                          {post.title}
                        </Text>
                        <Text
                          size="sm"
                          style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}
                        >
                          {post.content.replace(/\\n/g, "\n")}
                        </Text>
                      </div>

                      {/* Tampilkan 3 gambar pertama */}
                      {post.media && post.media.length > 0 && (
                        <div style={{ marginBottom: 15 }}>
                          <Group gap="xs" wrap="nowrap">
                            {post.media.slice(0, 3).map((m, idx) => {
                              const isVid = m.m_type === "video";
                              // Untuk video tanpa thumbnail, gunakan placeholder
                              const src = isVid
                                ? m.thumbnail ||
                                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect fill='%231e3769' width='120' height='120'/%3E%3C/svg%3E"
                                : m.url;
                              const remaining = post.media.length - 3;
                              const isLast = idx === 2 && remaining > 0;

                              return (
                                <div
                                  key={m.id}
                                  style={{
                                    position: "relative",
                                    width: 120,
                                    height: 120,
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    border: "1px solid #e9ecef",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isVid) {
                                      setPlayVideo(m.url);
                                    } else {
                                      setZoomImage(m.url);
                                    }
                                  }}
                                >
                                  <Image
                                    src={src}
                                    alt={`Media ${idx + 1}`}
                                    height={120}
                                    width={120}
                                    fit="cover"
                                    style={{ objectFit: "cover" }}
                                  />
                                  {isVid && (
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
                                      <div
                                        style={{
                                          background: "rgba(255,255,255,0.9)",
                                          borderRadius: "50%",
                                          width: 32,
                                          height: 32,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        <IconVideo size={16} color="#1e3769" />
                                      </div>
                                    </div>
                                  )}
                                  {isLast && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: 0,
                                        background: "rgba(0,0,0,0.6)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Text c="white" fw={700} size="xl">
                                        +{remaining}
                                      </Text>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </Group>
                        </div>
                      )}
                      <Group gap="lg">
                        <Group gap="xs">
                          <ActionIcon
                            variant={liked ? "filled" : "subtle"}
                            color="red"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(post.id);
                            }}
                            style={{
                              background: liked ? "#ff6b6b" : undefined,
                              color: liked ? "#fff" : undefined,
                            }}
                          >
                            <IconHeart size="1rem" />
                          </ActionIcon>
                          <Text size="xs" c="dimmed" fw={500}>
                            {post.likes}
                          </Text>
                        </Group>
                        <Text size="xs" c="blue" fw={500}>
                          Lihat detail
                        </Text>
                      </Group>
                    </div>
                  </Group>
                </div>
              );
            })}
          </Stack>
        )}

        <Group justify="space-between" align="center" mt="md">
          <Text size="xs" c="dimmed">
            Total {total} post
          </Text>
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            size="sm"
          />
        </Group>
      </Stack>

      {/* Modal Zoom Image */}
      <Modal
        opened={!!zoomImage}
        onClose={() => setZoomImage(null)}
        size="xl"
        padding={0}
        withCloseButton={false}
        centered
        overlayProps={{ opacity: 0.9, blur: 3 }}
        styles={{
          body: { padding: 0 },
          content: { background: "transparent", boxShadow: "none" },
        }}
      >
        <div style={{ position: "relative" }}>
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            radius="xl"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
            }}
            onClick={() => setZoomImage(null)}
          >
            <IconX size={20} />
          </ActionIcon>
          {zoomImage && (
            <Image
              src={zoomImage}
              alt="Zoom"
              fit="contain"
              style={{ maxHeight: "90vh", width: "100%" }}
            />
          )}
        </div>
      </Modal>

      {/* Modal Video Playback */}
      <Modal
        opened={!!playVideo}
        onClose={() => setPlayVideo(null)}
        size="xl"
        padding={0}
        withCloseButton={false}
        centered
        overlayProps={{ opacity: 0.9, blur: 3 }}
        styles={{
          body: { padding: 0 },
          content: { background: "#000", boxShadow: "none" },
        }}
      >
        <div style={{ position: "relative" }}>
          <ActionIcon
            variant="filled"
            color="dark"
            size="lg"
            radius="xl"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
            }}
            onClick={() => setPlayVideo(null)}
          >
            <IconX size={20} />
          </ActionIcon>
          {playVideo && (
            <video
              src={playVideo}
              controls
              autoPlay
              style={{
                width: "100%",
                maxHeight: "90vh",
                display: "block",
              }}
            >
              <track kind="captions" />
            </video>
          )}
        </div>
      </Modal>
    </Container>
  );
}

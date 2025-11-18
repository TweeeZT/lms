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
  SimpleGrid,
  Select,
  Pagination,
  Modal,
  Skeleton,
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
  const [initialLoad, setInitialLoad] = useState(true);
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
      setInitialLoad(false);
    }
  }, [user, sort, page, limit, q, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

        <Stack gap="md">
          {loading && !initialLoad ? (
            // Skeleton loading untuk search/filter
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: "20px",
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e9ecef",
                  }}
                >
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    <Skeleton height={40} circle />
                    <div style={{ flex: 1 }}>
                      <Skeleton height={8} width="40%" mb={8} />
                      <Skeleton height={20} width="70%" mb={8} />
                      <Skeleton height={60} mb={12} />
                      <Group gap={8}>
                        <Skeleton height={24} width={60} />
                        <Skeleton height={24} width={60} />
                      </Group>
                    </div>
                  </Group>
                </div>
              ))}
            </>
          ) : (
            items.map((post) => {
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
                    <Link
                      href={`/profile/${post.user?.id}?from=/user/discussions`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ textDecoration: "none" }}
                    >
                      <Avatar
                        radius="xl"
                        size="md"
                        src={post.user?.avatar || undefined}
                        style={{
                          flexShrink: 0,
                          marginTop: 2,
                          cursor: "pointer",
                        }}
                        title={post.user?.full_name || "Profil"}
                      >
                        {(post.user?.full_name || "U")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </Avatar>
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header: Name, Role, Time */}
                      <Group gap="xs" mb={8} wrap="wrap" align="center">
                        <Text fw={600} size="sm" c="dark">
                          {post.user?.full_name || "Pengguna"}
                        </Text>
                        {post.user?.role && (
                          <Badge
                            size="xs"
                            variant="light"
                            color={getRoleColor(post.user.role)}
                          >
                            {getRoleLabel(post.user.role)}
                          </Badge>
                        )}
                        <Text size="xs" c="dimmed">
                          •
                        </Text>
                        <Text size="xs" c="dimmed">
                          {relativeTime(post.created_at)}
                        </Text>
                      </Group>

                      {/* Title */}
                      <Text 
                        fw={600} 
                        size="md" 
                        mb={8}
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                        }}
                      >
                        {post.title}
                      </Text>

                      {/* Description */}
                      <Text
                        size="sm"
                        c="dimmed"
                        style={{
                          lineHeight: 1.6,
                          whiteSpace: "pre-line",
                          marginBottom: 16,
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          maxWidth: "100%",
                        }}
                      >
                        {post.content.replace(/\\n/g, "\n")}
                      </Text>

                      {/* Hashtags at the bottom with larger gap */}
                      {post.tags && post.tags.length > 0 && (
                        <Group gap={8} mb={12} wrap="wrap">
                          {post.tags.map((tag) => (
                            <Badge
                              key={tag}
                              size="sm"
                              variant="light"
                              color="blue"
                              style={{
                                cursor: "pointer",
                                textTransform: "none",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQ(tag);
                                setPage(1);
                              }}
                            >
                              #{tag}
                            </Badge>
                          ))}
                        </Group>
                      )}

                      {/* Tampilkan 1 media pertama + 1 tile overlay "+N" */}
                      {post.media && post.media.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <SimpleGrid
                            cols={post.media.length > 1 ? 2 : 1}
                            spacing={6}
                          >
                            {post.media
                              .slice(0, Math.min(2, post.media.length))
                              .map((m, idx) => {
                                const isVid = m.m_type === "video";
                                const src = isVid
                                  ? m.thumbnail ||
                                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231e3769' width='200' height='200'/%3E%3C/svg%3E"
                                  : m.url;
                                const remaining = Math.max(
                                  0,
                                  post.media.length - 1
                                ); // sisa setelah tile pertama
                                const isOverlayTile =
                                  idx === 1 && post.media.length > 2; // overlay HANYA jika total > 2
                                return (
                                  <div
                                    key={m.id}
                                    style={{
                                      position: "relative",
                                      width: "100%",
                                      aspectRatio: "1 / 1",
                                      borderRadius: 8,
                                      overflow: "hidden",
                                      border: "1px solid #e9ecef",
                                      cursor: "pointer",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isOverlayTile) {
                                        window.location.href = `/user/discussions/${post.id}`;
                                        return;
                                      }
                                      if (isVid) setPlayVideo(m.url);
                                      else setZoomImage(m.url);
                                    }}
                                  >
                                    <Image
                                      src={src}
                                      alt={`Media ${idx + 1}`}
                                      fit="cover"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                    {isVid && !isOverlayTile && (
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
                                          <IconVideo
                                            size={16}
                                            color="#1e3769"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {isOverlayTile && (
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
                          </SimpleGrid>
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
            })
          )}
        </Stack>

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

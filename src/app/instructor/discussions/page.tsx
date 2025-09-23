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
} from "@mantine/core";
import { IconHeart, IconPlus, IconVideo } from "@tabler/icons-react";
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

export default function InstructorDiscussionsFeed() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // composer moved to separate page (/instructor/discussions/new)
  const totalPages = Math.max(1, Math.ceil(total / (limit || 10)));

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        instructorId: user.id,
        sort,
        page: String(page),
        limit: String(limit),
        mine: String(filter === "mine"),
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/instructor/discussions?${params}`);
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

  // like anti-spam: toggle once per post via localStorage key
  const likedKey = (id: string) => `disc-liked-${id}`;

  const toggleLike = async (id: string) => {
    if (!user) return;
    const liked = localStorage.getItem(likedKey(id)) === "1";
    // optimistic
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, likes: Math.max(0, (p.likes || 0) + (liked ? -1 : 1)) }
          : p
      )
    );
    localStorage.setItem(likedKey(id), liked ? "0" : "1");
    await fetch(`/api/instructor/discussions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instructorId: user.id,
        action: liked ? "unlike" : "like",
      }),
    });
    fetchItems();
  };

  const isLiked = (id: string) => localStorage.getItem(likedKey(id)) === "1";

  function relativeTime(date: Date | string) {
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
              href="/instructor/discussions/new"
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

        {/* Twitter-like feed */}
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
                    (window.location.href = `/instructor/discussions/${post.id}`)
                  }
                >
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    {/* Avatar */}
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

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header */}
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

                      {/* Post content */}
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

                      {/* Media */}
                      {hasActualMedia && (
                        <div style={{ marginBottom: 15 }}>
                          <div
                            style={{
                              position: "relative",
                              maxWidth: 400,
                              height: 200,
                              borderRadius: 12,
                              overflow: "hidden",
                              border: "1px solid #e9ecef",
                            }}
                          >
                            <Image
                              src={coverSrc}
                              alt={
                                isVideo
                                  ? `Video ${post.title}`
                                  : `Gambar ${post.title}`
                              }
                              height={200}
                              fit="cover"
                              fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDQwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjVmNWY1Ii8+CjxwYXRoIGQ9Ik0xNzUgODBIMjI1VjEyMEgxNzVWODBaIiBmaWxsPSIjYzljOWM5Ii8+CjxwYXRoIGQ9Ik0xODUgOTBIMjE1VjExMEgxODVWOTBaIiBmaWxsPSIjYTlhOWE5Ii8+Cjx0ZXh0IHg9IjIwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjEyIiBmb250LWZhbWlseT0iLXdlYmtpdC1waWN0b2dyYXBoLCBzeXN0ZW0tdWkiPkdhbWJhciB0aWRhayB0ZXJzZWRpYTwvdGV4dD4KPC9zdmc+"
                            />
                            {isVideo && (
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
                                    width: 48,
                                    height: 48,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <IconVideo size={20} color="#1e3769" />
                                </div>
                              </div>
                            )}
                            {extraCount > 0 && (
                              <Badge
                                variant="filled"
                                color="dark"
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                }}
                                size="sm"
                              >
                                +{extraCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Engagement */}
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
    </Container>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  Button,
  Pagination,
  Skeleton,
  Center,
  Table,
  Space,
} from "@mantine/core";
import { IconCrown } from "@tabler/icons-react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type LeaderboardItem = {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  score?: number;
};

function normalizeAvatar(url?: string | null): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (u.startsWith("/storage/")) return `${base}${u}`;
  if (u.startsWith("avatar/") || u.startsWith("avatars/"))
    return `${base}/storage/v1/object/public/${u}`;
  return u;
}

export default function SchoolLeaderboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        const qs = new URLSearchParams({
          limit: String(limit),
          page: String(page),
        }).toString();
        const res = await fetch(`/api/school/leaderboard?${qs}`);
        const json = await res.json();
        if (json.success) {
          setItems(json.items as LeaderboardItem[]);
          setTotal(json.total as number);
        } else {
          setItems([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id, user?.role, page, limit]);

  const top3 = useMemo(() => {
    const arr = items.slice(0, 3);
    // Place #1 in the middle visually
    if (arr.length >= 2) {
      const [a, b, c] = arr;
      return arr.length === 3 ? [arr[1], arr[0], arr[2]] : [arr[1], arr[0]];
    }
    return arr;
  }, [items]);

  const getRankBadgeStyle = (rank: number): React.CSSProperties => {
    switch (rank) {
      case 1:
        return { backgroundColor: "#FFD700", color: "#1e293b" }; // gold
      case 2:
        return { backgroundColor: "#C0C0C0", color: "#1e293b" }; // silver
      case 3:
        return { backgroundColor: "#CD7F32", color: "#ffffff" }; // bronze
      default:
        return { backgroundColor: "#e2e8f0", color: "#0f172a" }; // slate-200
    }
  };

  return (
    <div className="container mx-auto px-4 py-6" style={{ maxWidth: "1200px" }}>
      <Group justify="space-between" mb="xl">
        <div>
          <Text fw={700} size="xl" mb={4}>
            Leaderboard Sekolah
          </Text>
          <Text size="sm" c="dimmed">
            Peringkat sekolah berdasarkan total skor siswa: (Total Poin + Total
            Koin) ÷ 2
          </Text>
        </div>
      </Group>

      {/* Access denied for non-school users */}
      {!loading && user?.role !== "school" && (
        <Card withBorder radius="lg" p="xl" mt="md">
          <Center>
            <Stack gap={6} align="center">
              <Text fw={600} c="red">
                Akses Ditolak
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Halaman ini hanya dapat diakses oleh akun sekolah.
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

      {/* Empty state */}
      {!loading && user?.role === "school" && items.length === 0 && (
        <Card withBorder radius="lg" p="xl" mt="md">
          <Center>
            <Stack gap={6} align="center">
              <Text fw={600}>Belum ada data leaderboard</Text>
              <Text size="sm" c="dimmed" ta="center">
                Belum ada sekolah yang memiliki siswa dengan poin/koin.
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

      {/* Only show content for school role */}
      {user?.role === "school" && items.length > 0 && (
        <>
          {/* Podium top 3 - improved responsive design */}
          <div style={{ marginBottom: "3rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1.5rem",
                alignItems: "end",
                maxWidth: "900px",
                margin: "0 auto",
              }}
            >
              {loading
                ? [0, 1, 2].map((i) => (
                    <Card key={i} radius="lg" withBorder>
                      <Skeleton height={180} />
                    </Card>
                  ))
                : top3.map((item, idx) => {
                    // Visual order: [2nd, 1st, 3rd]
                    const actualRank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                    const isFirst = actualRank === 1;
                    const isSecond = actualRank === 2;
                    const isThird = actualRank === 3;

                    return (
                      <Card
                        key={item.userId}
                        radius="lg"
                        withBorder
                        p="xl"
                        style={{
                          background: isFirst
                            ? "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)"
                            : isSecond
                            ? "linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)"
                            : "linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)",
                          minHeight: isFirst ? "280px" : "240px",
                          marginTop: isFirst ? "0" : "2rem",
                          transform: isFirst ? "scale(1.05)" : "scale(1)",
                          transition: "all 0.3s ease",
                          boxShadow: isFirst
                            ? "0 10px 30px rgba(255, 215, 0, 0.4)"
                            : "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      >
                        <Stack align="center" gap="md">
                          {isFirst && (
                            <IconCrown
                              size={36}
                              color="#FFF"
                              style={{
                                filter:
                                  "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
                              }}
                            />
                          )}
                          <Badge
                            size="xl"
                            variant="filled"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.9)",
                              color: isFirst
                                ? "#FFD700"
                                : isSecond
                                ? "#A8A8A8"
                                : "#CD7F32",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              padding: "0.5rem 1rem",
                            }}
                          >
                            #{actualRank}
                          </Badge>
                          <Avatar
                            size={isFirst ? 90 : 70}
                            radius="xl"
                            src={normalizeAvatar(item.avatar)}
                            style={{
                              border: "5px solid white",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                            }}
                          >
                            {item.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </Avatar>
                          <div style={{ textAlign: "center" }}>
                            <Text
                              fw={700}
                              size={isFirst ? "xl" : "lg"}
                              c="white"
                              style={{
                                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                                marginBottom: "0.5rem",
                              }}
                            >
                              {item.name}
                            </Text>
                            {typeof item.score === "number" && (
                              <Badge
                                variant="light"
                                size="lg"
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.95)",
                                  fontWeight: 600,
                                  fontSize: isFirst ? "1rem" : "0.9rem",
                                }}
                              >
                                {Math.round(item.score)} skor
                              </Badge>
                            )}
                          </div>
                        </Stack>
                      </Card>
                    );
                  })}
            </div>
          </div>

          {/* Table list */}
          <Card
            withBorder
            radius="lg"
            p={0}
            style={{ overflow: "hidden" }}
            mt="md"
          >
            <Table
              striped
              highlightOnHover
              verticalSpacing="md"
              horizontalSpacing="md"
            >
              <Table.Thead
                style={{ background: "var(--mantine-color-gray-0)" }}
              >
                <Table.Tr>
                  <Table.Th style={{ width: 92 }}>Peringkat</Table.Th>
                  <Table.Th>Sekolah</Table.Th>
                  <Table.Th style={{ width: 120, textAlign: "right" }}>
                    Total Skor
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <Skeleton height={24} w={56} />
                        </Table.Td>
                        <Table.Td>
                          <Skeleton height={28} />
                        </Table.Td>
                        <Table.Td>
                          <Skeleton height={24} />
                        </Table.Td>
                      </Table.Tr>
                    ))
                  : items.map((item) => (
                      <Table.Tr key={item.userId}>
                        <Table.Td>
                          <Badge
                            variant="filled"
                            style={getRankBadgeStyle(item.rank)}
                          >
                            {item.rank}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={12}>
                            <Avatar
                              src={normalizeAvatar(item.avatar)}
                              radius="xl"
                            >
                              {item.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </Avatar>
                            <Text fw={600}>{item.name}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: "right" }}>
                          <Text fw={600}>
                            {typeof item.score === "number"
                              ? Math.round(item.score)
                              : 0}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          )}
        </>
      )}
    </div>
  );
}

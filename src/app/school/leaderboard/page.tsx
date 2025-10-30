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
  points?: number;
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
          schoolUserId: user.id,
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
  }, [user?.id, page, limit]);

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
    <div className="container mx-auto px-4 py-6">
      <Group justify="space-between" mb="lg">
        <div>
          <Text fw={700} size="lg">
            Leaderboard Siswa
          </Text>
          <Text size="sm" c="dimmed">
            Urutan berdasarkan rata-rata tiga kategori
          </Text>
        </div>
      </Group>

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Card withBorder radius="lg" p="xl" mt="md">
          <Center>
            <Stack gap={6} align="center">
              <Text fw={600}>Belum ada data leaderboard</Text>
              <Text size="sm" c="dimmed" ta="center">
                Pastikan sudah menambahkan siswa ke sekolah ini dan siswa memiliki progres/poin.
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

  {/* Podium top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {loading
          ? [0, 1, 2].map((i) => (
              <Card key={i} radius="lg" withBorder>
                <Skeleton height={120} />
              </Card>
            ))
          : top3.map((item, idx) => (
              <Card
                key={item.userId}
                radius="lg"
                withBorder
                style={{
                  background:
                    idx === 1
                      ? "linear-gradient(180deg,#ffe082,#fff8e1)"
                      : idx === 0
                      ? "linear-gradient(180deg,#eceff1,#ffffff)"
                      : "linear-gradient(180deg,#f8e1c7,#fff)",
                }}
              >
                <Stack align="center" gap={8}>
                  {idx === 1 && <IconCrown size={22} color="#f1b821" />}
                  <Avatar
                    size={64}
                    radius="xl"
                    src={normalizeAvatar(item.avatar)}
                  >
                    {item.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </Avatar>
                  <Text fw={700} ta="center">
                    {item.name}
                  </Text>
                  {typeof item.points === "number" && (
                    <Badge variant="light">{item.points} poin</Badge>
                  )}
                </Stack>
              </Card>
            ))}
      </div>

      {/* Table list */}
      <Card withBorder radius="lg" p={0} style={{ overflow: "hidden" }} mt="md">
        <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
          <Table.Thead style={{ background: "var(--mantine-color-gray-0)" }}>
            <Table.Tr>
              <Table.Th style={{ width: 92 }}>Peringkat</Table.Th>
              <Table.Th>Siswa</Table.Th>
              <Table.Th style={{ width: 120, textAlign: "right" }}>Poin</Table.Th>
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
                      <Badge variant="filled" style={getRankBadgeStyle(item.rank)}>
                        {item.rank}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={12}>
                        <Avatar src={normalizeAvatar(item.avatar)} radius="xl">
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
                      <Text fw={600}>{typeof item.points === "number" ? item.points : 0}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Pagination */}
      <Group justify="center" mt="lg">
        <Pagination value={page} onChange={setPage} total={totalPages} />
      </Group>
    </div>
  );
}

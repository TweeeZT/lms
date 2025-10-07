"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Image,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconExternalLink,
  IconRefresh,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

export default function UserProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const scratchUsername = user?.username ?? null;

  useEffect(() => {
    if (!user?.id || !scratchUsername) return;

    const loadProjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/scratch/projects?username=${encodeURIComponent(
            scratchUsername
          )}`
        );
        const json = await res.json();
        if (json.success) setProjects(json.projects || []);
      } catch {
        // ignore error
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [user?.id, scratchUsername]);

  const handleRefresh = async () => {
    if (!scratchUsername) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/scratch/projects?username=${encodeURIComponent(scratchUsername)}`
      );
      const json = await res.json();
      if (json.success) setProjects(json.projects || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="lg" p="md">
      {/* Header */}
      <Group justify="space-between">
        <Text fw={600} size="xl">
          Proyek Scratch Saya
        </Text>

        <Group>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              onClick={handleRefresh}
              aria-label="refresh"
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>

          <Button
            leftSection={<IconExternalLink size={16} />}
            onClick={() => window.open("https://scratch.mit.edu/", "_blank")}
          >
            Buka Scratch
          </Button>
        </Group>
      </Group>

      {/* Info Box */}
      <Card withBorder radius="md" p="sm" bg="blue.0">
        <Group align="flex-start" gap="sm">
          <IconInfoCircle size={20} color="var(--mantine-color-blue-filled)" />
          <Text size="sm" c="blue.8">
            Pastikan proyek Scratch Anda sudah diset <b>Publik</b> agar dapat
            tampil di daftar proyek. Proyek yang masih <i>Private</i> tidak akan
            muncul di sini.
          </Text>
        </Group>
      </Card>

      {/* Content */}
      {loading ? (
        <Group justify="center" mt="xl">
          <Loader />
        </Group>
      ) : !scratchUsername ? (
        <Card withBorder p="md">
          <Text>
            Username akun Anda akan digunakan sebagai username Scratch. Pastikan
            username Anda sama dengan akun Scratch.
          </Text>
        </Card>
      ) : (
        <ScrollArea h="calc(100vh - 260px)">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {projects.length > 0 ? (
              projects.map((p: any) => {
                const desc =
                  p.description?.trim() ||
                  p.instructions?.trim() ||
                  p.details?.trim() ||
                  "";

                return (
                  <Card key={p.id} withBorder shadow="sm" radius="md" p="md">
                    <Stack gap={8}>
                      <Image
                        src={
                          p.image ||
                          p.image_url ||
                          `https://uploads.scratch.mit.edu/projects/${p.id}/thumbnail.png`
                        }
                        alt={p.title || `Project ${p.id}`}
                        height={160}
                        onError={() => {}}
                      />

                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                          <Text fw={600} lineClamp={2}>
                            {p.title || `Project ${p.id}`}
                          </Text>

                          <Text size="sm" c="dimmed" lineClamp={3}>
                            {desc || "Tidak ada deskripsi."}
                          </Text>
                        </Stack>

                        <ActionIcon
                          variant="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://scratch.mit.edu/projects/${p.id}`,
                              "_blank"
                            );
                          }}
                          aria-label="open-external"
                        >
                          <IconExternalLink size={16} />
                        </ActionIcon>
                      </Group>
                    </Stack>
                  </Card>
                );
              })
            ) : (
              <Card withBorder shadow="sm" p="xl" radius="md">
                <Stack align="center" gap="sm">
                  <Text size="sm" c="dimmed">
                    Belum ada proyek publik di akun Scratch ini.
                  </Text>
                </Stack>
              </Card>
            )}
          </SimpleGrid>
        </ScrollArea>
      )}
    </Stack>
  );
}

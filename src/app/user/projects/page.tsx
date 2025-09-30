"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Badge,
  Modal,
  ActionIcon,
  SimpleGrid,
  ScrollArea,
  Switch,
  Tooltip,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconRefresh,
} from "@tabler/icons-react";
import { BlocklyProject } from "@/types";
import { useAuth } from "@/hooks/useAuth";

interface FormState {
  projectId?: string;
  title: string;
  description: string;
  isPublic: boolean;
}

export default function UserProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<BlocklyProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    isPublic: false,
  });

  const resetForm = () =>
    setForm({
      title: "",
      description: "",
      isPublic: false,
    });

  const fetchProjects = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user/blockly-projects?userId=${user.id}`);
      const json = await res.json();
      if (json.success) setProjects(json.projects || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const openNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (p: BlocklyProject) => {
    setForm({
      projectId: p.id,
      title: p.title,
      description: p.description || "",
      isPublic: p.is_public,
    });
    setModalOpen(true);
  };

  const saveProject = async () => {
    if (!user?.id || !form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        userId: user.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        isPublic: form.isPublic,
      };
      if (form.projectId) {
        await fetch("/api/user/blockly-projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, projectId: form.projectId }),
        });
        setModalOpen(false);
        fetchProjects();
      } else {
        const res = await fetch("/api/user/blockly-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success && json.id) {
          setModalOpen(false);
          resetForm();
          router.push(`/user/projects/${json.id}`);
          return;
        }
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (p: BlocklyProject) => {
    if (!user?.id) return;
    if (!confirm(`Hapus project "${p.title}"?`)) return;
    await fetch(
      `/api/user/blockly-projects?projectId=${p.id}&userId=${user.id}`,
      { method: "DELETE" }
    );
    fetchProjects();
  };

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Text fw={600} size="xl">
          Proyek Blockly Saya
        </Text>
        <Group>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              onClick={fetchProjects}
              aria-label="refresh"
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconPlus size={18} />} onClick={openNew}>
            Tambah Proyek
          </Button>
        </Group>
      </Group>
      {loading ? (
        <Group justify="center" mt="xl">
          <Loader />
        </Group>
      ) : (
        <ScrollArea h="calc(100vh - 220px)">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {projects.map((p) => (
              <Card
                key={p.id}
                withBorder
                shadow="sm"
                radius="md"
                p="md"
                style={{ cursor: "pointer", position: "relative" }}
                onClick={() => router.push(`/user/projects/${p.id}`)}
              >
                <Stack gap={6}>
                  <Group
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                  >
                    <Text fw={600} lineClamp={2} pr={4}>
                      {p.title}
                    </Text>
                    <Group gap={4} style={{ flexShrink: 0 }}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        aria-label="edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(p);
                        }}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        aria-label="delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(p);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={3}>
                    {p.description || "—"}
                  </Text>
                  <Group gap={6}>
                    {p.is_public && (
                      <Badge size="sm" color="blue">
                        Publik
                      </Badge>
                    )}
                    <Badge size="sm" variant="light">
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </Badge>
                  </Group>
                </Stack>
              </Card>
            ))}
            {!projects.length && (
              <Card withBorder shadow="sm" p="xl" radius="md">
                <Stack align="center" gap="sm">
                  <Text size="sm" c="dimmed">
                    Belum ada proyek. Klik &quot;Tambah Proyek&quot;.
                  </Text>
                </Stack>
              </Card>
            )}
          </SimpleGrid>
        </ScrollArea>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.projectId ? "Edit Proyek" : "Proyek Baru"}
        size="lg"
        centered
      >
        <Stack>
          <TextInput
            label="Judul"
            placeholder="Judul proyek"
            value={form.title}
            onChange={(e) => {
              const v = e?.currentTarget?.value ?? "";
              setForm((f) => ({ ...f, title: v }));
            }}
            withAsterisk
          />
          <Textarea
            label="Deskripsi"
            minRows={3}
            placeholder="Deskripsi singkat"
            value={form.description}
            onChange={(e) => {
              const v = e?.currentTarget?.value ?? "";
              setForm((f) => ({ ...f, description: v }));
            }}
          />
          {/* Editor Blockly akan dibuka di halaman khusus proyek */}
          <Group>
            <Switch
              checked={form.isPublic}
              onChange={(e) =>
                setForm((f) => ({ ...f, isPublic: e.currentTarget.checked }))
              }
              label="Publik?"
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button loading={saving} onClick={saveProject}>
              {form.projectId ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Stack, Group, Text, Button, Card, Loader, Image } from "@mantine/core";
import { IconExternalLink, IconArrowLeft } from "@tabler/icons-react";

export default function ScratchProjectViewerPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/scratch/projects/${projectId}`);
        const j = await res.json();
        if (!j.success) throw new Error(j.error || "Gagal memuat project");
        setProject(j.project || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) return (
    <Group justify="center" p="md"><Loader /></Group>
  );

  if (error) return (
    <Stack p="md"><Text c="red">{error}</Text></Stack>
  );

  if (!project) return (
    <Stack p="md"><Text>Project tidak ditemukan.</Text></Stack>
  );

  // Scratch embed iframe URL
  const embedUrl = `https://scratch.mit.edu/projects/${projectId}/embed`;
  const thumb = project.image || project.image_url || `https://uploads.scratch.mit.edu/projects/${projectId}/thumbnail.png`;

  return (
    <Stack p="md" gap="sm">
      <Group style={{ justifyContent: 'space-between' }}>
        <Group>
          <Button variant="subtle" onClick={() => router.push('/user/projects')} leftSection={<IconArrowLeft size={16} />}>Kembali</Button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text fw={700}>{project.title || `Project ${projectId}`}</Text>
            <Text size="sm" c="dimmed">by {project.author?.username || project.author || 'Unknown'}</Text>
          </div>
        </Group>
        <Button leftSection={<IconExternalLink size={16} />} onClick={() => window.open(`https://scratch.mit.edu/projects/${projectId}`, '_blank')}>Buka di Scratch</Button>
      </Group>

      <Card withBorder>
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            src={embedUrl}
            title={project.title || `Project ${projectId}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            allowFullScreen
          />
        </div>
      </Card>

      <Group>
        <Image src={thumb} alt="thumbnail" height={100} width={100} />
        <div>
          <Text>{project.description || '—'}</Text>
        </div>
      </Group>
    </Stack>
  );
}

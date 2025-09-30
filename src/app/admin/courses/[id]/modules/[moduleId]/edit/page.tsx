"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Radio,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconDeviceFloppy } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

interface QuizQuestion {
  id?: string;
  question: string;
  options?: string[];
  answer?: string | number | string[];
  [key: string]: unknown;
}

interface AssignmentSpec {
  title?: string;
  description?: string;
  due_date?: string | null;
  max_score?: number;
  [key: string]: unknown;
}

interface ModuleFull {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  module_kind: "materi" | "quiz" | "tugas" | "live";
  order_index: number | null;
  is_published: boolean | null;
  content?: string | null;
  quiz_questions?: QuizQuestion[] | null;
  assignment?: AssignmentSpec | null;
  live_session_link?: string | null;
}

export default function AdminEditModulePage({
  params,
}: {
  params: { id: string; moduleId: string };
}) {
  const router = useRouter();
  const { user } = useAuth();
  const adminId = user?.id || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<ModuleFull | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orderIndex, setOrderIndex] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(true);
  const [content, setContent] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<string>("[]");
  const [assignment, setAssignment] = useState<string>("{}");
  const [liveLink, setLiveLink] = useState("");

  const fetchModule = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/modules/${params.moduleId}?userId=${adminId}`
      );
      if (!res.ok) throw new Error("Gagal memuat modul");
      const json = await res.json();
      const m: ModuleFull = json.item;
      setModuleData(m);
      setTitle(m.title);
      setDescription(m.description || "");
      setOrderIndex(m.order_index ?? undefined);
      setIsPublished(m.is_published !== false);
      setContent(m.content || "");
      setQuizQuestions(JSON.stringify(m.quiz_questions ?? [], null, 2));
      setAssignment(JSON.stringify(m.assignment ?? {}, null, 2));
      setLiveLink(m.live_session_link || "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat modul";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [adminId, params.moduleId]);

  useEffect(() => {
    fetchModule();
  }, [fetchModule]);

  const handleSave = async () => {
    if (!adminId || !moduleData) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title,
        description: description || null,
        order_index: orderIndex ?? 0,
        is_published: isPublished,
      };
      if (moduleData.module_kind === "materi") body.content = content;
      if (moduleData.module_kind === "quiz") {
        try {
          body.quiz_questions = JSON.parse(quizQuestions || "[]");
        } catch {
          throw new Error("Format quiz questions tidak valid JSON");
        }
      }
      if (moduleData.module_kind === "tugas") {
        try {
          body.assignment = JSON.parse(assignment || "{}");
        } catch {
          throw new Error("Format assignment tidak valid JSON");
        }
      }
      if (moduleData.module_kind === "live")
        body.live_session_link = liveLink || null;

      const res = await fetch(
        `/api/admin/modules/${moduleData.id}?userId=${adminId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal menyimpan");
      }
      router.push(`/admin/courses/${params.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box p="lg">
      <Group mb="md">
        <ActionIcon variant="default" onClick={() => router.back()}>
          <IconArrowLeft size={18} />
        </ActionIcon>
        <Title order={3}>Edit Modul</Title>
      </Group>

      {error && (
        <Alert color="red" mb="md" title="Error">
          {error}
        </Alert>
      )}

      {loading && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}

      {!loading && moduleData && (
        <Card withBorder>
          <Stack>
            <TextInput
              label="Judul"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
            />
            <Textarea
              label="Deskripsi"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              minRows={3}
            />
            <NumberInput
              label="Urutan"
              value={orderIndex}
              onChange={(val) =>
                setOrderIndex(typeof val === "number" ? val : undefined)
              }
              min={0}
            />
            <Radio.Group
              name="publish"
              label="Status"
              value={isPublished ? "published" : "draft"}
              onChange={(v) => setIsPublished(v === "published")}
            >
              <Group mt="xs">
                <Radio value="published" label="Published" />
                <Radio value="draft" label="Draft" />
              </Group>
            </Radio.Group>

            {moduleData.module_kind === "materi" && (
              <Textarea
                label="Konten"
                value={content}
                onChange={(e) => setContent(e.currentTarget.value)}
                minRows={6}
              />
            )}
            {moduleData.module_kind === "quiz" && (
              <Textarea
                label="Quiz Questions (JSON)"
                value={quizQuestions}
                onChange={(e) => setQuizQuestions(e.currentTarget.value)}
                minRows={6}
                description="Array objek pertanyaan"
              />
            )}
            {moduleData.module_kind === "tugas" && (
              <Textarea
                label="Assignment (JSON)"
                value={assignment}
                onChange={(e) => setAssignment(e.currentTarget.value)}
                minRows={6}
                description="Objek assignment"
              />
            )}
            {moduleData.module_kind === "live" && (
              <TextInput
                label="Live Session Link"
                value={liveLink}
                onChange={(e) => setLiveLink(e.currentTarget.value)}
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saving}
                onClick={handleSave}
                disabled={!title}
              >
                Simpan Perubahan
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Box>
  );
}

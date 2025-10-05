"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Card,
  Stack,
  Group,
  Title,
  Text,
  TextInput,
  Textarea,
  Button,
  Badge,
  SimpleGrid,
  Image,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import { useAuth } from "../../../../hooks/useAuth";

export default function NewUserDiscussionPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const words = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content]
  );
  const maxWords = 1500;

  const addFiles = (incoming: File[]) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const accepted = incoming.filter((f) => {
      if (!/^image\//i.test(f.type) && !/^video\//i.test(f.type)) {
        return false;
      }
      if (f.size > MAX_SIZE) {
        notifications.show({
          title: "File terlalu besar",
          message: `File ${f.name} melebihi batas maksimal 10MB`,
          color: "red",
        });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...accepted]);
    const urls = accepted.map((f) => URL.createObjectURL(f));
    setPreviews((p) => [...p, ...urls]);
  };
  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    const url = previews[idx];
    if (url) URL.revokeObjectURL(url);
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };
  const addTag = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (!tags.includes(v)) setTags((t) => [...t, v]);
    setTagInput("");
  };
  const removeTag = (value: string) =>
    setTags((t) => t.filter((x) => x !== value));

  const isValid = () =>
    title.trim().length >= 3 &&
    (content.trim().length >= 10 || files.length > 0);
  const submit = async () => {
    if (!user || !isValid() || submitting) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("userId", user.id);
      fd.set("title", title.trim());
      const normalized = content.replaceAll("\r\n", "\n");
      fd.set("content", normalized);
      if (tags.length) fd.set("tags", JSON.stringify(tags));
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/user/discussions", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({
          title: "Berhasil",
          message: "Diskusi berhasil dibuat",
          color: "green",
        });
        router.push("/user/discussions");
      } else {
        notifications.show({
          title: "Gagal",
          message: json.error || "Gagal membuat diskusi",
          color: "red",
        });
      }
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Terjadi kesalahan saat membuat diskusi",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="sm">
      <Stack gap="lg">
        <Group>
          <Button
            variant="light"
            leftSection={<IconArrowLeft size="1rem" />}
            onClick={() => router.back()}
          >
            Kembali
          </Button>
        </Group>
        <Card withBorder radius="md" p="lg" className="card-hover">
          <Stack gap="md">
            <Title order={3} className="text-gradient">
              Buat Diskusi Baru
            </Title>
            <Text size="sm" c="dimmed">
              Lengkapi judul, media (opsional), tag (opsional), lalu tulis
              deskripsi.
            </Text>
            <TextInput
              label="Judul"
              placeholder="Masukkan judul diskusi"
              required
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              disabled={submitting}
            />
            <Stack gap="xs">
              <Text fw={500} size="sm">
                Media (gambar atau video, opsional)
              </Text>
              <label
                htmlFor="media-upload"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 6,
                  border: "2px dashed var(--primary-color)",
                  borderRadius: 12,
                  padding: "24px",
                  background: "var(--accent-color)",
                  color: "var(--primary-color)",
                  cursor: "pointer",
                }}
                className="card-hover"
              >
                <span style={{ fontWeight: 500 }}>Klik untuk pilih file</span>
                <Text size="xs" c="dimmed">
                  Format: gambar / video
                </Text>
              </label>
              <input
                id="media-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                disabled={submitting}
                onChange={(e) => {
                  const sel = Array.from(e.currentTarget.files || []);
                  addFiles(sel as File[]);
                  e.currentTarget.value = "";
                }}
              />
              {previews.length > 0 && (
                <SimpleGrid cols={Math.min(3, previews.length)} spacing="md">
                  {previews.map((src, i) => (
                    <Card
                      key={i}
                      radius="md"
                      withBorder
                      style={{ overflow: "hidden", position: "relative" }}
                    >
                      <Image src={src} alt="" height={100} fit="cover" />
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="light"
                        onClick={() => removeFile(i)}
                        style={{ position: "absolute", top: 6, right: 6 }}
                      >
                        <IconX size={14} />
                      </Button>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="xs">
              <Text fw={500} size="sm">
                Tag (opsional)
              </Text>
              <TextInput
                placeholder="Tambahkan tag lalu Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.currentTarget.value)}
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
              />
              <Group gap={6}>
                {tags.map((t) => (
                  <Badge
                    key={t}
                    rightSection={
                      <IconX
                        size={12}
                        onClick={() => removeTag(t)}
                        style={{ cursor: "pointer" }}
                      />
                    }
                    variant="light"
                    color="blue"
                  >
                    {t}
                  </Badge>
                ))}
              </Group>
            </Stack>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text fw={500} size="sm">
                  Deskripsi
                </Text>
                <Text size="xs" c={words > maxWords ? "red" : "dimmed"}>
                  {words}/{maxWords} kata
                </Text>
              </Group>
              <Textarea
                placeholder="Tuliskan isi diskusi..."
                minRows={10}
                autosize
                value={content}
                onChange={(e) => setContent(e.currentTarget.value)}
                disabled={submitting}
              />
            </Stack>
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => router.push("/user/discussions")}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                className="btn-primary"
                onClick={submit}
                disabled={!isValid() || words > maxWords || submitting}
                loading={submitting}
              >
                Publikasikan
              </Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

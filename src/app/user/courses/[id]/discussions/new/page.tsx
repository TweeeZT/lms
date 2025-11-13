"use client";
import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Container, Card, Stack, Group, Title, Text, TextInput, Textarea, Button, Badge, SimpleGrid, Image } from "@mantine/core";
import { IconArrowLeft, IconX } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { notifications } from "@mantine/notifications";

export default function NewCourseDiscussionPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [contentTouched, setContentTouched] = useState(false);

  const words = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const maxWords = 1500;
  const titleError = titleTouched && title.trim().length === 0 ? "Judul harus diisi" : titleTouched && title.trim().length < 3 ? "Judul minimal 3 karakter" : null;
  const contentError = contentTouched && words < 3 ? "Deskripsi minimal 3 kata" : contentTouched && words > maxWords ? `Maksimal ${maxWords} kata` : null;
  const canSubmit = title.trim().length >= 3 && words >= 3 && words <= maxWords;

  const addFiles = (incoming: File[]) => {
    const MAX_SIZE = 10 * 1024 * 1024;
    const accepted: File[] = [];
    incoming.forEach(f => {
      if (!/^image\//i.test(f.type) && !/^video\//i.test(f.type)) return;
      if (f.size > MAX_SIZE) { notifications.show({ title:'File terlalu besar', message:`${f.name} > 10MB`, color:'red' }); return; }
      accepted.push(f);
    });
    if (accepted.length) {
      setFiles(prev => [...prev, ...accepted]);
      setPreviews(prev => [...prev, ...accepted.map(f => URL.createObjectURL(f))]);
    }
  };
  const removeFile = (idx: number) => { const url = previews[idx]; if (url) URL.revokeObjectURL(url); setFiles(prev => prev.filter((_,i)=>i!==idx)); setPreviews(prev => prev.filter((_,i)=>i!==idx)); };
  const addTag = (value: string) => { const v = value.trim(); if (!v) return; if (!tags.includes(v)) setTags(t => [...t,v]); setTagInput(""); };
  const removeTag = (value: string) => setTags(t => t.filter(x => x !== value));

  const submit = async () => {
    if (!user || submitting) return; if (!canSubmit) { setTitleTouched(true); setContentTouched(true); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("userId", user.id);
      fd.set("title", title.trim());
      fd.set("content", content.replaceAll("\r\n", "\n"));
      if (tags.length) fd.set("tags", JSON.stringify(tags));
      files.forEach(f => fd.append("files", f));
      const res = await fetch(`/api/user/courses/${courseId}/discussions`, { method:'POST', body: fd });
      const json = await res.json();
      if (res.ok && json.success) { notifications.show({ title:'Berhasil', message:'Diskusi kursus dibuat', color:'green' }); router.push(`/user/courses/${courseId}/discussions`); } else { notifications.show({ title:'Gagal', message: json.error || 'Gagal membuat diskusi', color:'red' }); }
    } catch { notifications.show({ title:'Error', message:'Terjadi kesalahan', color:'red' }); } finally { setSubmitting(false); }
  };

  if (!user) return null;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group>
          <Button variant="light" leftSection={<IconArrowLeft size="1rem" />} onClick={() => router.push(`/user/courses/${courseId}/discussions`)}>Kembali</Button>
        </Group>
        <Card withBorder radius="md" p="lg" className="card-hover">
          <Stack gap="md">
            <Title order={3}>Buat Diskusi Kursus</Title>
            <Text size="sm" c="dimmed">Isi judul, media (opsional), tag (opsional), lalu deskripsi.</Text>
            <TextInput label="Judul" placeholder="Masukkan judul" required value={title} onChange={e => { setTitle(e.currentTarget.value); if (!titleTouched) setTitleTouched(true); }} onBlur={() => setTitleTouched(true)} error={titleError} disabled={submitting} />
            <Stack gap="xs">
              <Text fw={500} size="sm">Media (opsional)</Text>
              <label htmlFor="media-upload" style={{ display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:6, border:'2px dashed var(--primary-color)', borderRadius:12, padding:24, background:'var(--accent-color)', color:'var(--primary-color)', cursor:'pointer' }} className="card-hover">
                <span style={{ fontWeight:500 }}>Klik untuk pilih file</span>
                <Text size="xs" c="dimmed">Format gambar / video</Text>
              </label>
              <input id="media-upload" type="file" accept="image/*,video/*" multiple hidden disabled={submitting} onChange={e => { const sel = Array.from(e.currentTarget.files || []); addFiles(sel as File[]); e.currentTarget.value=''; }} />
              {previews.length > 0 && (
                <SimpleGrid cols={Math.min(3, previews.length)} spacing="md">
                  {previews.map((src,i) => (
                    <Card key={i} radius="md" withBorder style={{ overflow:'hidden', position:'relative' }}>
                      <Image src={src} alt="" height={100} fit="cover" />
                      <Button size="compact-xs" color="red" variant="light" onClick={() => removeFile(i)} style={{ position:'absolute', top:6, right:6 }}><IconX size={14} /></Button>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="xs">
              <Text fw={500} size="sm">Tag (opsional)</Text>
              <TextInput placeholder="Tambahkan tag lalu Enter" value={tagInput} onChange={e => setTagInput(e.currentTarget.value)} disabled={submitting} onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); addTag(tagInput); } }} />
              <Group gap={6}>{tags.map(t => (<Badge key={t} rightSection={<IconX size={12} onClick={() => removeTag(t)} style={{ cursor:'pointer' }} />} variant="light" color="blue">{t}</Badge>))}</Group>
            </Stack>
            <Stack gap={4}>
              <Group justify="space-between"><Text fw={500} size="sm">Deskripsi</Text><Text size="xs" c={contentTouched && contentError ? 'red':'dimmed'}>{words}/{maxWords} kata</Text></Group>
              <Textarea placeholder="Tuliskan isi diskusi..." minRows={10} autosize value={content} onChange={e => { setContent(e.currentTarget.value); if (!contentTouched) setContentTouched(true); }} onBlur={() => setContentTouched(true)} error={contentError} disabled={submitting} />
            </Stack>
            <Group justify="flex-end">
              <Button variant="light" onClick={() => router.push(`/user/courses/${courseId}/discussions`)} disabled={submitting}>Batal</Button>
              <Button onClick={submit} disabled={!canSubmit || submitting} loading={submitting} className="btn-primary" styles={{ root:{ '&[data-disabled]':{ cursor:'not-allowed', pointerEvents:'all' } } }}>Publikasikan</Button>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

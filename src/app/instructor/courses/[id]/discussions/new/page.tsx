"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container, Stack, Group, Button, Title, Text, TextInput, Textarea, TagsInput, FileInput } from "@mantine/core";
import { IconChevronRight, IconSend } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

export default function InstructorNewDiscussionPage(){
  const params = useParams<{ id:string }>();
  const courseId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if(!user) return null;

  const onSubmit = async () => {
    if(!title.trim() || !content.trim()) return; setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('userId', user.id);
      fd.set('title', title.trim());
      fd.set('content', content.trim());
      fd.set('tags', JSON.stringify(tags));
      files.forEach(f => fd.append('files', f));
      const res = await fetch(`/api/user/courses/${courseId}/discussions`, { method:'POST', body: fd });
      const json = await res.json();
      if(res.ok && json.success) {
        router.push(`/instructor/courses/${courseId}/discussions/${json.item.id}`);
      }
    } finally { setSubmitting(false); }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button variant="subtle" onClick={()=> router.push(`/instructor/courses/${courseId}/discussions`)} leftSection={<IconChevronRight size={20} style={{ transform:'rotate(180deg)' }} />}>Kembali</Button>
          <Title order={3}>Posting Diskusi Baru</Title>
        </Group>
        <TextInput label="Judul" placeholder="Judul diskusi" value={title} onChange={e=> setTitle(e.currentTarget.value)} required />
        <Textarea label="Konten" placeholder="Tulis konten..." minRows={6} autosize value={content} onChange={e=> setContent(e.currentTarget.value)} required />
        <TagsInput label="Tag (opsional)" value={tags} onChange={setTags} placeholder="Tambah tag" />
        <FileInput label="Media (opsional)" multiple accept="image/*,video/*" onChange={(val)=> { const v = val as File[] | null; if(v) setFiles(v); }} />
        <Group justify="flex-end"><Button leftSection={<IconSend size={16} />} loading={submitting} onClick={onSubmit} disabled={!title.trim() || !content.trim()}>Kirim</Button></Group>
      </Stack>
    </Container>
  );
}

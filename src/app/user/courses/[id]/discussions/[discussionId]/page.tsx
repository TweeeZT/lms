"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import { Container, Stack, Group, Button, Title, Text, Avatar, ActionIcon, Badge, Textarea, Divider, FileInput, SimpleGrid, Card } from "@mantine/core";
import { IconChevronRight, IconSend, IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import PrimeLoader from "@/components/PrimeLoader";

interface ApiComment { id: string; user_id: string; content: string; created_at: string; user: { id:string; full_name:string; avatar?:string|null; role?:string|null } | null; }
interface ApiPost { id: string; user_id: string; title: string; content: string; likes: number; tags: string[]; created_at: string; user: { id:string; full_name:string; avatar?:string|null; role?:string|null } | null; comments: ApiComment[]; media?: Array<{ id:string; post_id:string; m_type:"image"|"video"; url:string; thumbnail?:string|null }>; }

function relativeTime(date: string | Date) { const d = typeof date === 'string'? new Date(date): date; const diff = Date.now()-d.getTime(); const sec=Math.floor(diff/1000); const m=Math.floor(sec/60); const h=Math.floor(m/60); if(sec<60) return 'baru saja'; if(m<60) return `${m} menit lalu`; if(h<24) return `${h} jam lalu`; return d.toLocaleString('id-ID',{ weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }); }

export default function CourseDiscussionDetailPage() {
  const params = useParams<{ id:string; discussionId:string }>();
  const courseId = params.id; const discussionId = params.discussionId;
  const { user } = useAuth(); const router = useRouter();
  const [post, setPost] = useState<ApiPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<ApiPost["media"]>([]);
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  async function load() { if(!user) return; setLoading(true); try { const res = await fetch(`/api/user/courses/${courseId}/discussions/${discussionId}?userId=${user.id}`); const json = await res.json(); if(res.ok && json.success) { setPost(json.item as ApiPost); } } finally { setLoading(false); } }
  const startEdit = () => { if(!post) return; setEditTitle(post.title); setEditContent(post.content.replace(/\r\n/g,'\n')); setEditTags(post.tags || []); setExistingMedia(post.media || []); setMediaToDelete([]); setNewFiles([]); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setMediaToDelete([]); setNewFiles([]); };
  const removeExistingMedia = (id:string) => { setMediaToDelete(prev => [...prev,id]); setExistingMedia(prev => prev?.filter(m => m.id!==id)); };
  const addFiles = (files: File[]) => { const accepted = files.filter(f => /^(image|video)\//i.test(f.type) && f.size <= 10*1024*1024); setNewFiles(prev => [...prev, ...accepted]); };
  const saveEdit = async () => { if(!user || !post) return; setSavingEdit(true); try { // update title/content/tags
      const res = await fetch(`/api/user/courses/${courseId}/discussions/${discussionId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:user.id, title:editTitle.trim(), content:editContent.trim(), tags:editTags }) });
      if(!res.ok){ setSavingEdit(false); return; }
      // media changes
      if(mediaToDelete.length || newFiles.length){ const fd = new FormData(); fd.set('userId', user.id); if(mediaToDelete.length) fd.set('deleteMediaIds', JSON.stringify(mediaToDelete)); newFiles.forEach(f => fd.append('files', f)); await fetch(`/api/user/discussions/${post.id}/media`, { method:'PATCH', body: fd }); }
      await load(); setEditing(false); }
    finally { setSavingEdit(false); } };
  const deletePost = async () => { if(!user || !post) return; setDeleting(true); try { const res = await fetch(`/api/user/courses/${courseId}/discussions/${discussionId}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:user.id }) }); if(res.ok){ router.push(`/user/courses/${courseId}/discussions`); } } finally { setDeleting(false); } };
  useEffect(()=>{ load(); },[user, courseId, discussionId]);
  useEffect(() => { if (!loading) setInitialLoad(false); }, [loading]);

  // Like feature removed per request

  const submitComment = async () => { if(!user || !post || !commentText.trim()) return; setSending(true); try { const res = await fetch(`/api/user/courses/${courseId}/discussions/${discussionId}/comments`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:user.id, content: commentText.trim() }) }); const json = await res.json(); if(res.ok && json.success) { setPost(p => p? { ...p, comments: [...p.comments, json.item] }: p); setCommentText(''); } } finally { setSending(false); } };

  if(!user) return null;

  return (
    <Container size="md" py="xl">
      <PrimeLoader force={initialLoad && loading} backdrop coverColor="#fff" />
      {!loading && !post && (
        <Text>Diskusi tidak ditemukan</Text>
      )}
      {post && (
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button variant="subtle" size="md" onClick={() => router.push(`/user/courses/${courseId}/discussions`)} leftSection={<IconChevronRight size={20} style={{ transform:'rotate(180deg)' }} />}>Kembali</Button>
          <Title order={3}>Detail Diskusi</Title>
        </Group>
        <Stack gap="sm" p="md" style={{ background:'#fff', border:'1px solid #e9ecef', borderRadius:12 }}>
          <Group gap="xs" mb={4} align="center">
            <Avatar radius="xl" size="md" src={post.user?.avatar || undefined}>{(post.user?.full_name||'U').split(' ').map(n=>n[0]).join('')}</Avatar>
            <Text fw={600} size="sm">{post.user?.full_name || 'Pengguna'}</Text>
            <Text size="xs" c="dimmed">• {relativeTime(post.created_at)}</Text>
          </Group>
          {!editing && <Title order={4} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{post.title}</Title>}
          {!editing && <Text size="sm" c="dimmed" style={{ whiteSpace:'pre-line', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{post.content}</Text>}
          {editing && (
            <Stack gap="xs">
              <Textarea label="Judul" minRows={1} autosize value={editTitle} onChange={e=>setEditTitle(e.currentTarget.value)} />
              <Textarea label="Konten" minRows={6} autosize value={editContent} onChange={e=>setEditContent(e.currentTarget.value)} />
            </Stack>
          )}
          {post.media && post.media.length > 0 && !editing && (
            <SimpleGrid cols={1} spacing="sm">
              {post.media.map(m => (
                <Card key={m.id} radius="md" withBorder>
                  {m.m_type==='video' ? (
                    <video src={m.url} controls style={{ width:'100%', height:'auto', maxHeight:'70vh', display:'block', background:'#000' }} />
                  ) : (
                    <img src={m.url} style={{ width:'100%', height:'auto', display:'block' }} alt="media" />
                  )}
                </Card>
              ))}
            </SimpleGrid>
          )}
          {editing && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Media</Text>
              <SimpleGrid cols={Math.max(1, Math.min(3, (existingMedia?.length||0)))} spacing="sm">
                {existingMedia?.map(m => (
                  <Card key={m.id} radius="md" withBorder style={{ position:'relative', overflow:'hidden' }}>
                    {m.m_type==='video' ? <video src={m.url} style={{ width:'100%', height:120, objectFit:'cover' }} /> : <img src={m.url} style={{ width:'100%', height:120, objectFit:'cover' }} />}
                    <ActionIcon size="sm" color="red" variant="filled" radius="xl" style={{ position:'absolute', top:6, right:6 }} onClick={()=>removeExistingMedia(m.id)}><IconX size={14} /></ActionIcon>
                  </Card>
                ))}
              </SimpleGrid>
              <FileInput multiple accept="image/*,video/*" placeholder="Tambah media baru" onChange={(val)=> { const v = val as File[] | null; if(v && Array.isArray(v)) addFiles(v); }} />
              {newFiles.length>0 && <Text size="xs" c="dimmed">{newFiles.length} file baru akan diunggah</Text>}
            </Stack>
          )}
          {/* Like feature removed */}
          {!editing && post.user_id === user?.id && (
            <Group gap="xs">
              <Button size="xs" leftSection={<IconEdit size={14} />} variant="light" onClick={startEdit}>Edit</Button>
              <Button size="xs" leftSection={<IconTrash size={14} />} color="red" variant="light" loading={deleting} onClick={deletePost}>Hapus</Button>
            </Group>
          )}
          {editing && (
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={cancelEdit} disabled={savingEdit}>Batal</Button>
              <Button size="xs" leftSection={<IconSend size={14} />} loading={savingEdit} onClick={saveEdit} disabled={!editTitle.trim() || !editContent.trim()}>Simpan Perubahan</Button>
            </Group>
          )}
        </Stack>
        <Divider label="Komentar" labelPosition="left" />
        <Stack gap="md">
          {post.comments.map(c => (
            <Group key={c.id} align="flex-start" gap="md" wrap="nowrap">
              <Avatar radius="xl" size="sm" src={c.user?.avatar || undefined}>{c.user?.full_name?.[0] || 'U'}</Avatar>
              <div style={{ flex:1 }}>
                <Group gap={6} align="center">
                  <Text fw={600} size="sm">{c.user?.full_name || 'Pengguna'}</Text>
                  <Text size="xs" c="dimmed">• {relativeTime(c.created_at)}</Text>
                </Group>
                <Text size="sm" c="dimmed" style={{ whiteSpace:'pre-line', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{c.content}</Text>
              </div>
            </Group>
          ))}
        </Stack>
        <Stack gap="xs">
          <Textarea placeholder="Tulis komentar" minRows={3} autosize value={commentText} onChange={e => setCommentText(e.currentTarget.value)} />
          <Group justify="flex-end"><Button size="sm" leftSection={<IconSend size={16} />} onClick={submitComment} loading={sending} disabled={!commentText.trim()}>Kirim</Button></Group>
        </Stack>
      </Stack>
      )}
    </Container>
  );
}

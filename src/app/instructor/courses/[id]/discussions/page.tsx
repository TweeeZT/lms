"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container, Stack, Group, Button, Title, Text, SegmentedControl, Select, TextInput, Avatar, Badge, ActionIcon, Pagination, Image, SimpleGrid, Modal, Skeleton } from "@mantine/core";
import { IconChevronRight, IconPlus, IconVideo, IconX } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import PrimeLoader from "@/components/PrimeLoader";

type CourseInfo = { isEnrolled?: boolean; title?: string };
type ApiPost = {
  id: string; user_id: string; title: string; content: string; likes: number; tags: string[]; created_at: string;
  user: { id: string; full_name: string; avatar?: string | null; role?: string | null } | null;
  media?: Array<{ id:string; post_id:string; m_type:"image"|"video"; url:string; thumbnail?:string|null }>;
};

export default function InstructorCourseDiscussionsListPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [items, setItems] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [playVideo, setPlayVideo] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const totalPages = Math.max(1, Math.ceil(total / (limit || 10)));

  useEffect(() => {
    if (!user) return; setLoadingCourse(true);
    fetch(`/api/user/courses/${courseId}?userId=${user.id}`)
      .then(r => r.json())
      .then(json => { if (json.success) setCourse({ isEnrolled: json.course.isEnrolled, title: json.course.title }); })
      .finally(() => setLoadingCourse(false));
  }, [user, courseId]);

  const fetchItems = useCallback(async () => {
    if (!user || !course?.isEnrolled) return; setLoadingPosts(true);
    try {
      const params = new URLSearchParams({ userId: user.id, sort, page: String(page), limit: String(limit), mine: String(filter === 'mine') });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/user/courses/${courseId}/discussions?${params}`);
      const json = await res.json();
      if (res.ok && json.success) { setItems(json.items || []); setTotal(json.total || 0); }
    } finally { setLoadingPosts(false); }
  }, [user, course?.isEnrolled, sort, page, limit, q, filter, courseId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Only use PrimeLoader for the initial page render
  useEffect(() => {
    if (!loadingCourse && !loadingPosts) setInitialLoad(false);
  }, [loadingCourse, loadingPosts]);

  function relativeTime(date: string | Date) {
    const d = typeof date === 'string' ? new Date(date) : date; const diff = Date.now() - d.getTime(); const sec = Math.floor(diff/1000); const m = Math.floor(sec/60); const h = Math.floor(m/60);
    if (sec < 60) return 'baru saja'; if (m < 60) return `${m} menit lalu`; if (h < 24) return `${h} jam lalu`;
    return d.toLocaleString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  // Like feature removed per request
  // inline comments removed per request; commenting happens in detail view

  if (!user) return null;

  return (
    <Container size="lg" py="xl">
      <PrimeLoader force={initialLoad && (loadingCourse || loadingPosts)} backdrop coverColor="#fff" />
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Button variant="subtle" size="md" onClick={() => router.push(`/instructor/courses/${courseId}`)} leftSection={<IconChevronRight size={20} style={{ transform:'rotate(180deg)' }} />}>Kembali ke Kursus</Button>
          <div>
            <Title order={3}>{course?.title ? `Diskusi Kursus: ${course.title}` : 'Diskusi Kursus'}</Title>
            <Text size="xs" c="dimmed">Forum khusus peserta kursus ini</Text>
          </div>
          <Group>
            <SegmentedControl value={filter} onChange={v => { setFilter(v); setPage(1); }} data={[{ label:'Semua', value:'all' }, { label:'Postingan Saya', value:'mine' }]} />
            <Select data={[{ value:'latest', label:'Terbaru' }, { value:'popular', label:'Terpopuler' }]} value={sort} onChange={v => { setSort((v as any)||'latest'); setPage(1); }} />
            <Button component={Link} href={`/instructor/courses/${courseId}/discussions/new`} leftSection={<IconPlus size="1rem" />}>Post Baru</Button>
          </Group>
        </Group>
        {(!course?.isEnrolled && !loadingCourse) && <Text c="red" size="sm">Anda belum terdaftar di kursus ini.</Text>}
        <TextInput placeholder="Cari judul/konten..." value={q} onChange={e => setQ(e.currentTarget.value)} onKeyDown={e => e.key==='Enter' && setPage(1)} />
        <Stack gap="md">
          {loadingPosts && !initialLoad ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ padding:'20px', background:'#fff', borderRadius:12, border:'1px solid #e9ecef', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' }}>
                  <Group align="flex-start" gap="md" wrap="nowrap">
                    <Skeleton height={36} width={36} radius="xl" />
                    <div style={{ flex:1 }}>
                      <Skeleton height={12} style={{ width:'35%', marginBottom:8 }} />
                      <Skeleton height={14} style={{ width:'60%', marginBottom:8 }} />
                      <Skeleton height={10} style={{ width:'90%' }} />
                    </div>
                  </Group>
                </div>
              ))}
            </>
          ) : (
          items.map(post => (
            <div key={post.id} style={{ padding:'20px', background:'#fff', borderRadius:12, border:'1px solid #e9ecef', cursor:'pointer', boxShadow:'0 2px 4px rgba(0,0,0,0.1)' }} onClick={() => router.push(`/instructor/courses/${courseId}/discussions/${post.id}`)}>
              <Group align="flex-start" gap="md" wrap="nowrap">
                <Avatar radius="xl" size="md" src={post.user?.avatar || undefined} style={{ flexShrink:0, marginTop:2 }}>
                  {(post.user?.full_name || 'U').split(' ').map(n => n[0]).join('')}
                </Avatar>
                <div style={{ flex:1 }}>
                  <Group gap="xs" mb={8} wrap="wrap" align="center"><Text fw={600} size="sm">{post.user?.full_name || 'Pengguna'}</Text><Text size="xs" c="dimmed">• {relativeTime(post.created_at)}</Text></Group>
                  <Text fw={600} size="md" mb={8} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{post.title}</Text>
                  <Text size="sm" c="dimmed" style={{ lineHeight:1.6, whiteSpace:'pre-line', marginBottom:16, overflowWrap: 'break-word', wordBreak: 'break-word' }}>{post.content.replace(/\n/g,'\n')}</Text>
                  {post.media && post.media.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <SimpleGrid cols={post.media.length > 1 ? 2 : 1} spacing={6}>
                        {post.media.slice(0, Math.min(2, post.media.length)).map((m, idx) => {
                          const isVid = m.m_type === 'video';
                          const src = isVid ? (m.thumbnail || m.url) : m.url;
                          const mediaLen = post.media ? post.media.length : 0;
                          const remaining = Math.max(0, mediaLen - 1);
                          const isOverlayTile = idx === 1 && mediaLen > 2;
                          return (
                            <div
                              key={m.id}
                              style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', borderRadius:8, overflow:'hidden', border:'1px solid #e9ecef' }}
                              onClick={e => { e.stopPropagation(); if (isOverlayTile) { router.push(`/instructor/courses/${courseId}/discussions/${post.id}`); return; } if (isVid) setPlayVideo(m.url); else setZoomImage(m.url); }}
                            >
                              <Image src={src} alt={`Media ${idx+1}`} fit="cover" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              {isVid && !isOverlayTile && (
                                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)' }}>
                                  <div style={{ background:'rgba(255,255,255,0.9)', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <IconVideo size={16} color="#1e3769" />
                                  </div>
                                </div>
                              )}
                              {isOverlayTile && (
                                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <Text c="white" fw={700} size="xl">+{remaining}</Text>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </SimpleGrid>
                    </div>
                  )}
                  <Text size="xs" c="blue" fw={500}>Lihat detail</Text>
                  {/* Inline comment removed - navigate to detail to comment */}
                </div>
              </Group>
            </div>
          )))
          }
        </Stack>
        <Group justify="space-between" align="center" mt="md"><Text size="xs" c="dimmed">Total {total} post</Text><Pagination total={totalPages} value={page} onChange={setPage} size="sm" /></Group>
      </Stack>

      <Modal opened={!!zoomImage} onClose={() => setZoomImage(null)} size="xl" padding={0} withCloseButton={false} centered overlayProps={{ opacity:0.9, blur:3 }} styles={{ body:{ padding:0 }, content:{ background:'transparent', boxShadow:'none' } }}>
        <ActionIcon variant="filled" color="dark" size="lg" radius="xl" style={{ position:'absolute', top:16, right:16, zIndex:10 }} onClick={() => setZoomImage(null)}><IconX size={20} /></ActionIcon>
        {zoomImage && <Image src={zoomImage} alt="Zoom" fit="contain" style={{ maxHeight:'90vh', width:'100%' }} />}
      </Modal>
      <Modal opened={!!playVideo} onClose={() => setPlayVideo(null)} size="xl" padding={0} withCloseButton={false} centered overlayProps={{ opacity:0.9, blur:3 }} styles={{ body:{ padding:0 }, content:{ background:'#000', boxShadow:'none' } }}>
        <ActionIcon variant="filled" color="dark" size="lg" radius="xl" style={{ position:'absolute', top:16, right:16, zIndex:10 }} onClick={() => setPlayVideo(null)}><IconX size={20} /></ActionIcon>
        {playVideo && <video src={playVideo} controls autoPlay style={{ width:'100%', maxHeight:'90vh', display:'block' }} />}
      </Modal>
    </Container>
  );
}

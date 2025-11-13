"use client";
import { useEffect, useState } from "react";
import { Stack, Title, Text, Card, Group, Button, Textarea, Loader, Badge, Avatar, Divider } from "@mantine/core";
import { IconMessage, IconSend } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/hooks/useAuth";

interface DiscussionPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  likes?: number;
  user?: { id: string; full_name?: string; avatar?: string | null; role?: string } | null;
  comments?: DiscussionComment[];
}
interface DiscussionComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { id: string; full_name?: string; avatar?: string | null; role?: string } | null;
}

// Deprecated after migrating to full page views replicating global forum style.
// Keeping component for backward compatibility; now renders a minimal notice with link.
export default function CourseDiscussionSection({ courseId, isEnrolled }: { courseId: string; isEnrolled?: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    if (!user || !courseId || !isEnrolled) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/courses/${courseId}/discussions?userId=${user.id}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setPosts(json.items || []);
        } else {
          throw new Error(json.error || "Gagal memuat diskusi");
        }
      } catch (err) {
        notifications.show({ title: 'Diskusi', message: err instanceof Error ? err.message : 'Gagal memuat', color: 'red' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, courseId, isEnrolled]);

  const handleCreate = async () => {
    if (!user || !newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/user/courses/${courseId}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title: newTitle, content: newContent })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({ title: 'Diskusi', message: 'Thread berhasil dibuat', color: 'green' });
        setNewTitle('');
        setNewContent('');
        // Reload list
        const reload = await fetch(`/api/user/courses/${courseId}/discussions?userId=${user.id}`);
        const rjson = await reload.json();
        if (reload.ok && rjson.success) setPosts(rjson.items || []);
      } else throw new Error(json.error || 'Gagal membuat thread');
    } catch (err) {
      notifications.show({ title: 'Diskusi', message: err instanceof Error ? err.message : 'Gagal membuat thread', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const loadComments = async (postId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/courses/${courseId}/discussions/${postId}?userId=${user.id}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: json.item.comments } : p));
      }
    } catch {}
  };

  const handleReply = async (postId: string) => {
    if (!user || !replyContent.trim()) return;
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/user/courses/${courseId}/discussions/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content: replyContent })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        notifications.show({ title: 'Komentar', message: 'Komentar ditambahkan', color: 'green' });
        setReplyContent('');
        // Append comment optimistically
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), json.item] } : p));
      } else throw new Error(json.error || 'Gagal menambah komentar');
    } catch (err) {
      notifications.show({ title: 'Komentar', message: err instanceof Error ? err.message : 'Gagal menambah komentar', color: 'red' });
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={4}>Diskusi Kursus</Title>
          <Text size="xs" c="dimmed">Sekarang dipindahkan ke halaman khusus.</Text>
        </div>
        <Button size="sm" variant="light" onClick={() => window.location.href = `/user/courses/${courseId}/discussions`}>Buka Halaman Diskusi</Button>
      </Group>
    </Card>
  );
}

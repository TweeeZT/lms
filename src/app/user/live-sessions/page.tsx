"use client";
import { useEffect, useState } from "react";
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Loader,
  Title,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconCalendarPlus, IconExternalLink } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

interface LiveItem {
  id: string;
  moduleId: string;
  moduleTitle?: string;
  courseId?: string;
  courseTitle?: string;
  agenda?: string | null;
  title?: string | null;
  start_at?: string | null;
  duration_min?: number | null;
  join_url?: string | null;
  status?: string | null;
  time_zone?: string | null;
}

export default function UserLiveSessionsPage() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user/modules/live`);
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.error || "Gagal memuat");
        setItems(json.items || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toICS = (li: LiveItem) => {
    if (!li.start_at) return "";
    const start = dayjs(li.start_at);
    const dur = li.duration_min || 60;
    const end = start.add(dur, "minute");
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: dayjs.Dayjs) =>
      `${d.utc().format("YYYYMMDD")}T${pad(d.utc().hour())}${pad(
        d.utc().minute()
      )}00Z`;
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Afterschola//LiveSession//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${li.id}@afterschola`,
      `DTSTAMP:${fmt(dayjs())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${(li.title || "Live Session").replace(/\n/g, " ")}`,
      `DESCRIPTION:${(li.agenda || "").replace(/\n/g, " ")}`,
      li.join_url ? `URL:${li.join_url}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  };
  const downloadICS = (li: LiveItem) => {
    const ics = toICS(li);
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${li.title || "live-session"}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (loading)
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  if (error) return <Text color="red">{error}</Text>;

  return (
    <Stack p="lg">
      <Title order={3}>Live Sessions</Title>
      {items.length === 0 && <Text>Tidak ada sesi.</Text>}
      {items.map((li) => {
        const start = li.start_at ? dayjs(li.start_at) : null;
        return (
          <Card key={li.id} withBorder shadow="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4} style={{ flex: 1 }}>
                <Group gap={8}>
                  <Text fw={600}>{li.title || "Live Session"}</Text>
                  <Badge
                    variant="light"
                    color={li.status === "live" ? "red" : "blue"}
                  >
                    {li.status}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {li.courseTitle} • {li.moduleTitle}
                </Text>
                {li.agenda && <Text size="sm">{li.agenda}</Text>}
                {start && (
                  <Text size="sm">
                    {start.format("DD MMM YYYY HH:mm")} ({li.duration_min || 60}{" "}
                    menit)
                  </Text>
                )}
                {li.join_url && (
                  <Text size="sm" c="blue">
                    {li.join_url}
                  </Text>
                )}
              </Stack>
              <Group>
                <Tooltip label="Add to Calendar">
                  <ActionIcon variant="default" onClick={() => downloadICS(li)}>
                    <IconCalendarPlus size={18} />
                  </ActionIcon>
                </Tooltip>
                {li.join_url && (
                  <Button
                    size="xs"
                    component="a"
                    target="_blank"
                    href={li.join_url}
                    leftSection={<IconExternalLink size={14} />}
                  >
                    Join
                  </Button>
                )}
              </Group>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

"use client";

import { Card, Stack, Group, Text, Badge, Button } from "@mantine/core";
import {
  IconCalendarEvent,
  IconClock,
  IconVideo,
  IconLock,
} from "@tabler/icons-react";
import dayjs from "dayjs";

interface LiveSessionCardProps {
  session: {
    id: string;
    title: string;
    agenda?: string | null;
    start_at?: string | null;
    duration_min?: number | null;
    join_url?: string | null;
    passcode?: string | null;
    status?: string | null;
  };
  isCompleted: boolean;
  canJoin: boolean;
}

export default function LiveSessionCard({
  session,
  isCompleted,
  canJoin,
}: LiveSessionCardProps) {
  const startTime = session.start_at ? dayjs(session.start_at) : null;
  const endTime = startTime
    ? startTime.add(session.duration_min || 60, "minute")
    : null;
  const now = dayjs();
  const isPast = endTime ? now.isAfter(endTime) : false;
  const isLive =
    startTime && endTime && now.isAfter(startTime) && now.isBefore(endTime);

  const getStatusBadge = () => {
    if (isCompleted || isPast) {
      return <Badge color="gray">Selesai</Badge>;
    }
    if (isLive) {
      return (
        <Badge color="red" variant="filled">
          🔴 LIVE
        </Badge>
      );
    }
    if (!canJoin) {
      return <Badge color="orange">Terkunci</Badge>;
    }
    return <Badge color="blue">Akan Datang</Badge>;
  };

  return (
    <Card withBorder p="lg" radius="md" className="card-hover">
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm">
            <IconVideo size={24} color="#1e3769" />
            <div>
              <Text fw={600} size="lg">
                {session.title || "Live Session"}
              </Text>
              {session.agenda && (
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {session.agenda}
                </Text>
              )}
            </div>
          </Group>
          {getStatusBadge()}
        </Group>

        {startTime && (
          <Group gap="xl">
            <Group gap="xs">
              <IconCalendarEvent size={18} color="#666" />
              <Text size="sm" c="dimmed">
                {startTime.format("DD MMM YYYY")}
              </Text>
            </Group>
            <Group gap="xs">
              <IconClock size={18} color="#666" />
              <Text size="sm" c="dimmed">
                {startTime.format("HH:mm")} - {endTime?.format("HH:mm")} WIB
              </Text>
            </Group>
          </Group>
        )}

        {session.passcode && (
          <Group gap="xs">
            <IconLock size={16} color="#666" />
            <Text size="sm" c="dimmed">
              Passcode:{" "}
              <Text span fw={500}>
                {session.passcode}
              </Text>
            </Text>
          </Group>
        )}

        {session.join_url && (canJoin || isLive) && !isPast && (
          <Button
            component="a"
            href={session.join_url}
            target="_blank"
            rel="noopener noreferrer"
            fullWidth
            color={isLive ? "red" : "blue"}
            variant={isLive ? "filled" : "light"}
            leftSection={<IconVideo size={18} />}
            disabled={!canJoin && !isLive}
          >
            {isLive ? "Bergabung Sekarang" : "Buka Link Meeting"}
          </Button>
        )}

        {!canJoin && !isLive && !isPast && (
          <Text size="sm" c="dimmed" ta="center">
            Selesaikan modul sebelumnya untuk membuka live session
          </Text>
        )}
      </Stack>
    </Card>
  );
}

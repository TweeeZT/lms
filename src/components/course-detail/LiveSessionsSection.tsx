"use client";

import { Card, Stack, Group, Text, Badge, Button, Alert } from "@mantine/core";
import {
  IconVideo,
  IconCalendarEvent,
  IconClock,
  IconLock,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

type LiveSessionItem = {
  id: string;
  title: string;
  agenda?: string | null;
  start_at?: string | null;
  duration_min?: number | null;
  join_url?: string | null;
  passcode?: string | null;
  status?: string | null;
  isCompleted: boolean;
};

interface LiveSessionsSectionProps {
  sessions: LiveSessionItem[];
  completedModulesCount: number;
  totalRegularModules: number;
}

export default function LiveSessionsSection({
  sessions,
  completedModulesCount,
  totalRegularModules,
}: LiveSessionsSectionProps) {
  if (!sessions || sessions.length === 0) {
    return null;
  }

  const allModulesCompleted = completedModulesCount >= totalRegularModules;

  return (
    <Card withBorder p="lg" radius="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group gap="sm">
            <IconVideo size={28} color="var(--primary-color)" />
            <div>
              <Text size="xl" fw={700}>
                Live Sessions
              </Text>
              <Text size="sm" c="dimmed">
                Sesi tatap muka online dengan instruktur
              </Text>
            </div>
          </Group>
          <Badge size="lg" variant="light">
            {sessions.length} Sesi
          </Badge>
        </Group>

        {!allModulesCompleted && (
          <Alert icon={<IconLock size={16} />} color="orange">
            <Text size="sm">
              Selesaikan semua modul pembelajaran untuk membuka akses live
              sessions
            </Text>
          </Alert>
        )}

        <Stack gap="md">
          {sessions.map((session, idx) => {
            const startTime = session.start_at ? dayjs(session.start_at) : null;
            const endTime = startTime
              ? startTime.add(session.duration_min || 60, "minute")
              : null;
            const now = dayjs();
            const isPast = endTime ? now.isAfter(endTime) : false;
            const isLive =
              startTime &&
              endTime &&
              now.isAfter(startTime) &&
              now.isBefore(endTime);
            const canJoin = allModulesCompleted && !isPast;

            return (
              <Card
                key={session.id}
                withBorder
                p="lg"
                radius="md"
                style={{
                  background: session.isCompleted
                    ? "#f0fdf4"
                    : isLive
                    ? "#fef2f2"
                    : "#fafafa",
                  border: isLive
                    ? "2px solid #ef4444"
                    : "1px solid var(--border-color)",
                }}
              >
                <Stack gap="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" style={{ flex: 1 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: session.isCompleted
                            ? "#10b981"
                            : isLive
                            ? "#ef4444"
                            : "var(--primary-color)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Text fw={700} c="white">
                          {idx + 1}
                        </Text>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={700} size="lg" lineClamp={2}>
                          {session.title}
                        </Text>
                        {session.agenda && (
                          <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                            {session.agenda}
                          </Text>
                        )}
                      </div>
                    </Group>
                    {session.isCompleted || isPast ? (
                      <Badge color="gray" variant="filled">
                        Selesai
                      </Badge>
                    ) : isLive ? (
                      <Badge color="red" variant="filled">
                        🔴 LIVE
                      </Badge>
                    ) : !canJoin ? (
                      <Badge color="orange">Terkunci</Badge>
                    ) : (
                      <Badge color="blue">Akan Datang</Badge>
                    )}
                  </Group>

                  {startTime && (
                    <Group gap="lg" wrap="wrap">
                      <Group gap="xs">
                        <IconCalendarEvent size={18} color="#666" />
                        <Text size="sm" c="dimmed">
                          {startTime.format("DD MMMM YYYY")}
                        </Text>
                      </Group>
                      <Group gap="xs">
                        <IconClock size={18} color="#666" />
                        <Text size="sm" c="dimmed">
                          {startTime.format("HH:mm")} -{" "}
                          {endTime?.format("HH:mm")} WIB
                        </Text>
                      </Group>
                      {session.passcode && (
                        <Group gap="xs">
                          <IconLock size={16} color="#666" />
                          <Text size="sm" c="dimmed">
                            Passcode:{" "}
                            <Text span fw={600}>
                              {session.passcode}
                            </Text>
                          </Text>
                        </Group>
                      )}
                    </Group>
                  )}

                  {session.join_url && (canJoin || isLive) && !isPast && (
                    <Button
                      component="a"
                      href={session.join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      fullWidth
                      size="md"
                      color={isLive ? "red" : "blue"}
                      variant={isLive ? "filled" : "light"}
                      leftSection={<IconVideo size={18} />}
                      disabled={!canJoin && !isLive}
                    >
                      {isLive ? "Bergabung Sekarang" : "Buka Link Meeting"}
                    </Button>
                  )}

                  {!canJoin && !isLive && !isPast && (
                    <Alert color="orange" p="sm">
                      <Text size="sm">
                        Selesaikan semua modul untuk membuka sesi ini
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}

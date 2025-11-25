"use client";

import React from "react";
import { Card, Stack, Group, Text, UnstyledButton, Badge } from "@mantine/core";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  IconUser,
  IconTrophy,
  IconReceipt2,
  IconCertificate,
  IconCode,
  IconAward,
  IconDeviceGamepad2,
} from "@tabler/icons-react";

type TabId =
  | "profile"
  | "achievements"
  | "purchases"
  | "leaderboard"
  | "certificates"
  | "scratch-projects"
  | "games";
const allTabs: { id: TabId; label: string; Icon: any }[] = [
  { id: "profile", label: "Profil", Icon: IconUser },
  { id: "achievements", label: "Pencapaian", Icon: IconTrophy },
  { id: "purchases", label: "Pembelian", Icon: IconReceipt2 },
  { id: "leaderboard", label: "Leaderboard", Icon: IconAward },
  { id: "certificates", label: "Sertifikat", Icon: IconCertificate },
  { id: "scratch-projects", label: "Proyek Scratch", Icon: IconCode },
  { id: "games", label: "Permainan", Icon: IconDeviceGamepad2 },
];

export default function ProfileTabsNavbar({
  base = "/user/profile",
  visibleTabs,
}: {
  base?: string;
  visibleTabs?: TabId[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params?.get("tab") ?? "profile";
  const tabs = visibleTabs
    ? allTabs.filter((tab) => visibleTabs.includes(tab.id))
    : allTabs;

  return (
    <Card
      withBorder
      padding="md"
      radius="lg"
      shadow="xs"
      style={{
        background: "var(--mantine-color-body)",
        borderColor: "var(--mantine-color-gray-3)",
      }}
    >
      <Stack gap="xs">
        {/* Header badge to indicate profile section */}
        <Badge color="indigo" variant="light" radius="sm" size="sm">
          Pengaturan Profil
        </Badge>
        {tabs.map(({ id, label, Icon }) => {
          const href = `${base}?tab=${id}`;
          const isActive = pathname === base && active === id;
          return (
            <Link key={id} href={href} style={{ textDecoration: "none" }}>
              <UnstyledButton
                styles={(theme) => ({
                  root: {
                    display: "block",
                    width: "100%",
                    borderRadius: 10,
                    padding: "10px 12px",
                    backgroundColor: isActive
                      ? "var(--primary-color)"
                      : "transparent",
                    color: isActive ? "white" : "inherit",
                    transition: "background-color .15s ease, color .15s ease",
                    "&:hover": {
                      backgroundColor: isActive
                        ? "var(--primary-color)"
                        : theme.black === "dark"
                        ? theme.colors.dark[5]
                        : theme.colors.gray[0],
                      color: isActive ? "white" : undefined,
                    },
                  },
                })}
              >
                <Group gap={10} wrap="nowrap">
                  <Icon size={18} color={isActive ? "white" : undefined} />
                  <Text size="sm" fw={isActive ? 600 : 500} truncate>
                    {label}
                  </Text>
                </Group>
              </UnstyledButton>
            </Link>
          );
        })}
      </Stack>
    </Card>
  );
}

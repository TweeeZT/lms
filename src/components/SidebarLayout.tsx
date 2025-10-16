"use client";

import React, { useEffect, useState } from "react";
import {
  AppShell,
  Burger,
  Text,
  Group,
  Menu,
  Avatar,
  UnstyledButton,
  ScrollArea,
  Stack,
  Badge,
  // Switch,
  useMantineColorScheme,
  Card,
} from "@mantine/core";
import Image from "next/image";
import { User, NavigationItem } from "../types";
import {
  IconLogout,
  IconUser,
  // IconMoon,
  // IconSun,
  IconDashboard,
  IconBook,
  IconUsers,
  IconMessageCircle,
  IconChartBar,
  IconCoin,
  IconCertificate,
  IconBookmark,
  IconPlaylist,
  IconQuestionMark,
  IconAward,
  IconWallet,
  IconShoppingCart,
  IconCode,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
//

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  /** Optional: custom navbar content to replace the default navigation list */
  customNavbar?: React.ReactNode;
  /** Optional: hide navbar entirely and render only the header + main */
  hideNavbar?: boolean;
  /** Optional global loading state to cover entire layout (header+navbar+main) */
  globalLoading?: boolean;
}

const getNavigationItems = (role: User["role"]): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
    {
      label: "Dashboard",
      href: `/${role}/dashboard`,
      icon: "IconDashboard",
    },
  ];

  switch (role) {
    case "admin":
      return [
        ...baseItems,

        {
          label: "Manajemen User",
          href: "/admin/users",
          icon: "IconUsers",
        },
        {
          label: "Manajemen Kursus",
          href: "/admin/courses",
          icon: "IconBook",
        },
        {
          label: "Manajemen Keuangan",
          href: "/admin/earnings",
          icon: "IconCoin",
        },
      ];

    case "instructor":
      return [
        ...baseItems,
        {
          label: "Kursus Saya",
          href: "/instructor/courses",
          icon: "IconBook",
        },

        {
          label: "Forum Diskusi",
          href: "/instructor/discussions",
          icon: "IconMessageCircle",
        },

        {
          label: "Penghasilan",
          href: "/instructor/earnings",
          icon: "IconCoin",
        },
      ];

    case "user":
      return [
        ...baseItems,
        {
          label: "Kursus Saya",
          href: "/user/courses",
          icon: "IconBook",
        },
        {
          label: "Jelajahi Kursus",
          href: "/user/explore",
          icon: "IconBookmark",
        },
        // {
        //   label: "Learning Path",
        //   href: "/user/learning-paths",
        //   icon: "IconPlaylist",
        // },
        {
          label: "Diskusi & Forum",
          href: "/user/discussions",
          icon: "IconMessageCircle",
        },
      ];

    case "school":
      return [
        ...baseItems,
        {
          label: "Siswa",
          href: "/school/students",
          icon: "IconUsers",
        },
        {
          label: "Jelajah Kursus",
          href: "/school/explore",
          icon: "IconBookmark",
        },
        {
          label: "Kursus Saya",
          href: "/school/courses",
          icon: "IconBook",
        },
      ];

    default:
      return baseItems;
  }
};

const iconMap: Record<
  string,
  React.FC<{ size?: string | number; color?: string }>
> = {
  IconDashboard,
  IconBook,
  IconUsers,
  IconMessageCircle,
  IconChartBar,
  IconCoin,
  IconCertificate,
  IconBookmark,
  IconPlaylist,
  IconQuestionMark,
  IconAward,
  IconWallet,
  IconShoppingCart,
  IconCode,
};

export function DashboardLayout({
  children,
  user,
  onLogout,
  customNavbar,
  hideNavbar,
  globalLoading,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  //  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { colorScheme } = useMantineColorScheme();
  const [navOpened, setNavOpened] = useState(false);

  const navigationItems = getNavigationItems(user.role);

  const getRoleColor = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return "red";
      case "instructor":
        return "blue";
      case "user":
        return "green";
      case "school":
        return "green";
      default:
        return "gray";
    }
  };

  const getRoleLabel = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "instructor":
        return "Instruktur";
      case "user":
        return "Siswa";
      case "school":
        return "Sekolah";
      default:
        return "User";
    }
  };

  // Close navbar on route change (especially on mobile) to avoid overlaying content
  useEffect(() => {
    setNavOpened(false);
  }, [pathname]);

  return (
    <AppShell
      navbar={
        hideNavbar
          ? undefined
          : {
              width: 280,
              breakpoint: "sm",
              collapsed: { mobile: !navOpened },
            }
      }
      header={{ height: 70 }}
      padding="md"
    >
      <AppShell.Header
        bg="transparent"
        style={{ backdropFilter: "blur(10px)" }}
        withBorder={false}
      >
        <Group h="100%" px="md" justify="space-between">
          <Group>
            {/* Mobile burger */}
            <Burger
              opened={navOpened}
              onClick={() => setNavOpened((o) => !o)}
              hiddenFrom="sm"
              size="sm"
            />
            {/* Brand logo */}
            <Link
              href={`/${user.role}/dashboard`}
              style={{ display: "flex", alignItems: "center" }}
            >
              <Image
                src="/logo-text.png"
                alt="Afterschola"
                width={140}
                height={28}
                priority
                style={{ height: 48, width: "auto" }}
                className="hidden md:block"
              />
            </Link>
            <Badge color={getRoleColor(user.role)} variant="light">
              {getRoleLabel(user.role)}
            </Badge>
          </Group>

          <Group>
            {/* <Switch
              size="md"
              color="dark.4"
              onLabel={<IconSun size="1rem" stroke={2.5} />}
              offLabel={<IconMoon size="1rem" stroke={2.5} />}
              checked={colorScheme === "light"}
              onChange={() => toggleColorScheme()}
            /> */}

            <Text
              size="sm"
              fw={600}
              className="hidden md:block"
              style={{ maxWidth: 220 }}
              lineClamp={1}
              visibleFrom="md"
            >
              {user.fullName}
            </Text>

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <UnstyledButton>
                  <Group>
                    <Avatar
                      src={user.avatar}
                      alt={user.fullName}
                      radius="xl"
                      size="md"
                    >
                      {user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </Avatar>
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  {user.fullName}
                  <Text size="xs" c="dimmed">
                    @{user.username}
                  </Text>
                </Menu.Label>
                <Menu.Divider />
                <Menu.Item
                  component={Link}
                  href={`/${user.role}/profile`}
                  leftSection={<IconUser size="1rem" />}
                >
                  Profil Saya
                </Menu.Item>

                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconLogout size="1rem" />}
                  color="red"
                  onClick={onLogout}
                >
                  Keluar
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {!hideNavbar && (
        <AppShell.Navbar
          p="md"
          withBorder={false}
          style={{ background: "transparent" }}
        >
          {customNavbar ? (
            customNavbar
          ) : (
            <ScrollArea>
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
                  {navigationItems.map((item) => {
                    const Icon = iconMap[item.icon];
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{ textDecoration: "none" }}
                        onClick={() => setNavOpened(false)}
                      >
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
                              transition:
                                "background-color .15s ease, color .15s ease",
                              "&:hover": {
                                backgroundColor: isActive
                                  ? "var(--primary-color)"
                                  : colorScheme === "dark"
                                  ? theme.colors.dark[5]
                                  : theme.colors.gray[0],
                                color: isActive ? "white" : undefined,
                              },
                            },
                          })}
                        >
                          <Group gap={10} wrap="nowrap">
                            <Icon
                              size="1.1rem"
                              color={isActive ? "white" : undefined}
                            />
                            <Text size="sm" fw={isActive ? 600 : 500} truncate>
                              {item.label}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      </Link>
                    );
                  })}
                </Stack>
              </Card>
            </ScrollArea>
          )}
        </AppShell.Navbar>
      )}

      <AppShell.Main className="min-h-screen w-full bg-[#f8fafc] relative">
        {globalLoading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(255,255,255,0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4000,
            }}
          >
            <div style={{ display: "flex", gap: 32 }}>
              {[0, 1, 2].map((i) => (
                <svg
                  key={i}
                  width="72"
                  height="72"
                  viewBox="0 0 64 64"
                  style={{
                    animation: "spinDiamond 1.2s linear infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                >
                  <rect
                    x="12"
                    y="12"
                    width="40"
                    height="40"
                    fill="none"
                    stroke="url(#gradSidebarLayoutFull)"
                    strokeWidth="8"
                    rx="4"
                    ry="4"
                    transform="rotate(45 32 32)"
                  />
                  <defs>
                    <linearGradient
                      id="gradSidebarLayoutFull"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#f6d457" />
                      <stop offset="100%" stopColor="#1e3769" />
                    </linearGradient>
                  </defs>
                </svg>
              ))}
            </div>
            <style>{`@keyframes spinDiamond { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
          </div>
        )}
        {/* Midnight Aurora Glow Background */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
          radial-gradient(circle at 50% 50%, 
            rgba(58, 123, 255, 0.25) 0%, 
            rgba(100, 149, 237, 0.15) 25%, 
            rgba(123, 104, 238, 0.07) 35%, 
            transparent 50%
          )
        `,
          }}
        />

        {/* Your Content/Components */}
        <div className="relative z-10">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}

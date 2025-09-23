"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
import { Container, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading, router]);

  // while auth is loading, show a simple loading state
  if (loading) {
    return (
      <Container>
        <Stack align="center" justify="center" style={{ minHeight: "50vh" }}>
          <Text>Loading...</Text>
        </Stack>
      </Container>
    );
  }

  // if there's no user (redirect will happen), don't render the layout to avoid passing null
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout user={user} onLogout={logout}>
      {children}
    </DashboardLayout>
  );
}

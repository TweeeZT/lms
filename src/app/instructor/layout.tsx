"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { showGlobalLoader, hideGlobalLoader } from "../../hooks/useGlobalLoader";

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "instructor")) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Keep the global loader visible while auth is resolving or user is not yet available
  useEffect(() => {
    if (loading || !user) {
      showGlobalLoader();
    } else {
      hideGlobalLoader();
    }
  }, [loading, user]);

  if (loading || !user) return null;

  return (
    <DashboardLayout user={user} onLogout={logout}>
      {children}
    </DashboardLayout>
  );
}

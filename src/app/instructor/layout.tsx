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

  // Only show global loader while auth is resolving; avoid showing when user is null on logout
  useEffect(() => {
    if (loading) showGlobalLoader();
    else hideGlobalLoader();
    return () => hideGlobalLoader();
  }, [loading]);

  if (loading || !user) return null;

  return (
    <DashboardLayout user={user} onLogout={logout}>
      {children}
    </DashboardLayout>
  );
}

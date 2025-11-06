"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { showGlobalLoader, hideGlobalLoader } from "../../hooks/useGlobalLoader";

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

  // Mirror instructor: show global loader only while auth is resolving
  useEffect(() => {
    if (loading) showGlobalLoader();
    else hideGlobalLoader();
    return () => hideGlobalLoader();
  }, [loading]);

  // if there's no user (redirect will happen), don't render the layout to avoid passing null
  if (loading || !user) {
    return null;
  }

  return (
    <DashboardLayout user={user} onLogout={logout}>
      {children}
    </DashboardLayout>
  );
}

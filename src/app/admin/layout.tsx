"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
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

  // if there's no user (redirect will happen), don't render the layout to avoid passing null
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout user={user} onLogout={logout} globalLoading={loading}>
      {children}
    </DashboardLayout>
  );
}

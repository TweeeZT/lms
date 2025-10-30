"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { DashboardLayout } from "@/components/SidebarLayout";
import {
  IconSchool,
  IconUsers,
  IconBook,
  IconChartBar,
  IconUser,
} from "@tabler/icons-react";

export default function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || user.role !== "school")) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    // while loading or user is not available, don't render the layout;
    // redirect is handled in the effect above
    return null;
  }

  // Show custom tab menu only on /school/profile
  const showProfileTabs = pathname?.startsWith("/school/profile");
  const ProfileTabsNavbar = showProfileTabs
    ? require("../../components/ProfileTabsNavbar").default
    : null;

  // Only show allowed tabs for school profile
  const schoolTabs = ["profile", "purchases"];

  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
      hideNavbar={false}
      customNavbar={
        showProfileTabs && ProfileTabsNavbar ? (
          <ProfileTabsNavbar base="/school/profile" visibleTabs={schoolTabs} />
        ) : undefined
      }
    >
      {children}
    </DashboardLayout>
  );
}

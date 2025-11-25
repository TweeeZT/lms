"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import PrimeLoader from "../../components/PrimeLoader";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const ProfileTabsNavbar = dynamic(
    () => import("../../components/ProfileTabsNavbar"),
    { ssr: false }
  );

  useEffect(() => {
    if (!loading && (!user || user.role !== "user")) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Avoid rendering DashboardLayout until user is resolved to prevent null access
  if (loading) {
    return <PrimeLoader />;
  }

  if (!user) {
    return <PrimeLoader />;
  }

  // User tabs (exclude leaderboard - only for school)
  const userTabs: (
    | "profile"
    | "achievements"
    | "purchases"
    | "certificates"
    | "scratch-projects"
    | "games"
  )[] = [
    "profile",
    "achievements",
    "purchases",
    "certificates",
    "scratch-projects",
    "games",
  ];

  return (
    <DashboardLayout
      user={user}
      onLogout={logout}
      // Hide sidebar for course detail pages and blockly project editor pages
      hideNavbar={
        pathname?.startsWith("/user/courses/") ||
        pathname?.startsWith("/user/projects/")
      }
      customNavbar={
        pathname?.startsWith("/user/profile") ? (
          <ProfileTabsNavbar visibleTabs={userTabs} />
        ) : undefined
      }
    >
      {children}
    </DashboardLayout>
  );
}

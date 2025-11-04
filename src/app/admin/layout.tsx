"use client";

import { useAuth } from "../../hooks/useAuth";
import { DashboardLayout } from "../../components/SidebarLayout";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PrimeLoader from "@/components/PrimeLoader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [apiPending, setApiPending] = useState(0);
  const patchedRef = useRef(false);
  const origFetchRef = useRef<typeof window.fetch | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, loading, router]);

  // Patch window.fetch inside admin area to display loader while /api/* calls are in-flight
  useEffect(() => {
    if (patchedRef.current) return;
    patchedRef.current = true;
    const origFetch = window.fetch.bind(window);
    origFetchRef.current = origFetch;

    function isLocalApi(url: string) {
      try {
        const u = new URL(url, window.location.origin);
        return u.origin === window.location.origin && u.pathname.startsWith("/api/");
      } catch {
        return false;
      }
    }

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      let urlStr = "";
      if (typeof input === "string") urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (typeof Request !== "undefined" && input instanceof Request) urlStr = input.url;

      const track = urlStr && isLocalApi(urlStr);
      if (track) setApiPending((p) => p + 1);
      try {
        const res = await origFetch(input as any, init);
        return res;
      } finally {
        if (track) setApiPending((p) => Math.max(0, p - 1));
      }
    }) as typeof window.fetch;

    return () => {
      if (origFetchRef.current) {
        window.fetch = origFetchRef.current as any;
      }
    };
  }, []);

  // if there's no user (redirect will happen), don't render the layout to avoid passing null
  if (!user) {
    return null;
  }

  return (
    <DashboardLayout user={user} onLogout={logout} globalLoading={loading}>
      {apiPending > 0 && <PrimeLoader force />}
      {children}
    </DashboardLayout>
  );
}

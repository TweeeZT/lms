"use client";


import dynamic from "next/dynamic";

const UserProfilePage = dynamic(() => import("../../user/profile/page"), {
  ssr: false,
});

export default function SchoolProfileWrapper() {
  return <UserProfilePage />;
}

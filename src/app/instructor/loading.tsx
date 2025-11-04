"use client";

import React from "react";
import PrimeLoader from "@/components/PrimeLoader";

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100dvh",
      }}
    >
      <PrimeLoader force />
    </div>
  );
}

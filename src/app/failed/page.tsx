"use client";

import { Suspense } from "react";
import PaymentFailedInner from "./PaymentFailedInner";

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentFailedInner />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import PaymentSuccessInner from "./PaymentSuccessInner";

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessInner />
    </Suspense>
  );
}

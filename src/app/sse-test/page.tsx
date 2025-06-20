"use client";

import { SSENotificationExample } from "@/components/examples/SSENotificationExample";

export default function SSETestPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">SSE Testing Page</h1>
      <p className="text-center mb-8 text-muted-foreground">
        This page demonstrates Server-Sent Events (SSE) functionality for
        real-time updates.
      </p>

      <div className="grid gap-8">
        <SSENotificationExample />
      </div>
    </div>
  );
}

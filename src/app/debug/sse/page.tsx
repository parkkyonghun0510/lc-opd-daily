import { Metadata } from "next";
import SSEDebugger from "@/components/debug/SSEDebugger";

export const metadata: Metadata = {
  title: "SSE Debugger",
  description: "Debug Server-Sent Events (SSE) connections",
};

export default function SSEDebuggerPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">SSE Debugger</h1>
      <p className="mb-6">
        This tool helps you debug Server-Sent Events (SSE) connections. You can
        connect to an SSE endpoint, view events in real-time, and send test
        events.
      </p>

      <SSEDebugger />
    </div>
  );
}

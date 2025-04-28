'use client';

// Temporarily disabled for build
interface SSEDebuggerProps {
  endpoint?: string;
  userId?: string;
  token?: string;
}

export default function SSEDebugger({ endpoint = '/api/sse', userId, token }: SSEDebuggerProps) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">SSE Debugger</h2>
      <p>SSE Debugger is temporarily disabled for build.</p>
    </div>
  );
}

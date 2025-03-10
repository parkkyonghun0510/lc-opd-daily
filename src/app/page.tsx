"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// System initialization check on the homepage
export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check if system is set up
  useEffect(() => {
    async function checkSystemStatus() {
      try {
        const response = await fetch("/api/setup");
        const data = await response.json();

        // If system is not set up, redirect to setup page
        if (!data.isSetup) {
          router.push("/setup");
          return;
        }

        // If user is logged in, redirect to dashboard
        const authCookie = document.cookie.includes("auth_token=");
        if (authCookie) {
          router.push("/dashboard");
          return;
        }

        // Otherwise, show the homepage
        setLoading(false);
      } catch (error) {
        console.error("Error checking system status:", error);
        setLoading(false);
      }
    }

    checkSystemStatus();
  }, [router]);

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Main homepage content
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <main className="flex flex-col items-center justify-center max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Daily Reports System</h1>
        <p className="text-xl mb-8">Track and manage branch performance data</p>

        <div className="grid gap-6 md:grid-cols-2 mb-12 w-full max-w-2xl">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-3">Branch Reports</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Submit and track daily branch performance metrics
            </p>
            <Image
              src="/next.svg"
              alt="Reports"
              width={120}
              height={80}
              className="mb-4 dark:invert"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-3">Data Visualization</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              View consolidated data and performance trends
            </p>
            <Image
              src="/vercel.svg"
              alt="Analytics"
              width={120}
              height={80}
              className="mb-4 dark:invert"
            />
          </div>
        </div>

        <div className="flex gap-4 flex-col sm:flex-row">
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => router.push("/register")}
            className="px-6 py-3 border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-md hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
          >
            Register
          </button>
        </div>
      </main>

      <footer className="mt-12 text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Daily Reports System</p>
      </footer>
    </div>
  );
}

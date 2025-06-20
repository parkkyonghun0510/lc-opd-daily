"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { clearAuthData } from "@/lib/auth/session-utils";
import Image from "next/image";
import { useAuth } from "@/auth/hooks/useAuth";
import { StoreSynchronizer } from "@/auth/components/StoreSynchronizer";

function DevModeWarning() {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mb-6 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
      <h3 className="text-amber-800 dark:text-amber-400 font-semibold mb-2">
        Development Mode Notice
      </h3>
      <p className="text-amber-700 dark:text-amber-300 text-sm">
        You're in development mode. If the server isn't responding, ensure:
      </p>
      <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mt-2">
        <li>
          Next.js server is running (
          <code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">
            npm run dev
          </code>
          )
        </li>
        <li>
          Database connection is configured correctly in{" "}
          <code className="bg-amber-100 dark:bg-amber-800/30 px-1 rounded">
            .env
          </code>
        </li>
        <li>Required services (Redis, PostgreSQL) are running</li>
      </ul>
      <p className="text-amber-700 dark:text-amber-300 text-sm mt-2">
        Server errors will be gracefully handled with mock data in development.
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, isAuthenticated, error, clearError } = useAuth();
  const callbackUrl = searchParams?.get("callbackUrl") || "/dashboard";

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(callbackUrl);
    }

    // Display error message if present in URL
    const urlError = searchParams?.get("error");
    if (urlError) {
      let errorMessage = "An error occurred during sign in";

      // Handle specific error messages
      if (urlError.includes("No branch assigned")) {
        errorMessage =
          "Your account has no branch assigned. Please contact your administrator.";
      } else if (urlError.includes("Account is inactive")) {
        errorMessage =
          "Your account is inactive. Please contact your administrator.";
      } else if (urlError.includes("Invalid credentials")) {
        errorMessage = "Invalid email or password";
      }

      toast.error(errorMessage);
    }
  }, [isAuthenticated, callbackUrl, router, searchParams]);

  // Clear any auth errors when component unmounts
  useEffect(() => {
    return () => {
      if (error) clearError();
    };
  }, [error, clearError]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }

    const success = await login(username, password, callbackUrl);

    if (success) {
      router.replace(callbackUrl);
    }
  }

  // Add this function to clear session data
  const clearSessionData = () => {
    clearAuthData();
    window.location.reload();
    toast.success("Session data cleared successfully");
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-3 rounded-full mb-8">
          {/* Your logo here */}
          <Image
            width={192}
            height={192}
            layout="responsive"
            src="/icons/icon-192x192.png"
            alt="LC Report Logo"
            className="h-16"
          />
        </div>
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
          Please sign in to your account
        </p>
      </div>

      <Card className="shadow-xl border-0 dark:bg-gray-800 dark:border-gray-700">
        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-sm font-medium dark:text-gray-200"
              >
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                disabled={isLoading}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium dark:text-gray-200"
              >
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-800 dark:focus:ring-offset-gray-800"
            >
              {isLoading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Having trouble signing in?{" "}
          <a
            href="#"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Contact support
          </a>
        </p>
        <button
          onClick={clearSessionData}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 underline"
        >
          Clear session data
        </button>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* Add the StoreSynchronizer to keep NextAuth and our store in sync */}
      <StoreSynchronizer />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <DevModeWarning />
          <LoginForm />
        </div>
      </div>
    </Suspense>
  );
}

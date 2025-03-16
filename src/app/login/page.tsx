"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      console.log("User already authenticated, redirecting to:", callbackUrl);
      router.push(callbackUrl);
    }

    // Display error message if present in URL
    const error = searchParams.get("error");
    if (error) {
      toast.error(
        error === "Invalid credentials" ? "Invalid username or password" : error
      );
    }
  }, [status, callbackUrl, router, searchParams]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;

      if (!username || !password) {
        toast.error("Please enter both username and password");
        setIsLoading(false);
        return;
      }

      console.log("Attempting to sign in with redirect to:", callbackUrl);

      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result?.ok) {
        toast.error(result?.error || "Failed to sign in");
        setIsLoading(false);
        return;
      }

      // Success! Manual redirect
      toast.success("Signed in successfully");
      console.log("Login successful, redirecting to:", callbackUrl);

      // Force a hard navigation instead of client-side routing
      window.location.href = callbackUrl;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during sign in");
      setIsLoading(false);
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                disabled={isLoading}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

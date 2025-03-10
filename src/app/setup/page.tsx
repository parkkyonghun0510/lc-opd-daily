"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2 } from "lucide-react";

// Setup status type
type SetupStatus = {
  isSetup: boolean;
  userCount: number;
  branchCount: number;
};

// Setup page component
export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [adminUsername, setAdminUsername] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [createDefaultBranches, setCreateDefaultBranches] = useState(true);

  // Check if system is already set up
  useEffect(() => {
    async function checkSetupStatus() {
      try {
        const response = await fetch("/api/setup");
        const data = await response.json();

        setStatus(data);

        // Redirect to login if system is already set up
        if (data.isSetup) {
          setTimeout(() => {
            router.push("/login");
          }, 3000);
        }
      } catch (error) {
        setError("Failed to check setup status. Please try again.");
        console.error("Error checking setup status:", error);
      } finally {
        setLoading(false);
      }
    }

    checkSetupStatus();
  }, [router]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSetupLoading(true);

    // Validate form
    if (
      !adminUsername ||
      !adminName ||
      !adminEmail ||
      !adminPassword ||
      !secretKey
    ) {
      setError("All fields are required");
      setSetupLoading(false);
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match");
      setSetupLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminUsername,
          adminName,
          adminEmail,
          adminPassword,
          secretKey,
          createDefaultBranches,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set up system");
      }

      setSuccess(true);

      // Redirect to login after successful setup
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setSetupLoading(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>System Setup</CardTitle>
            <CardDescription>Checking setup status...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render already setup message
  if (status?.isSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>System Already Set Up</CardTitle>
            <CardDescription>
              The system has already been initialized with {status.userCount}{" "}
              user(s) and {status.branchCount} branch(es).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                You will be redirected to the login page in a few seconds.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render success message
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Setup Completed</CardTitle>
            <CardDescription>
              The system has been successfully initialized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                <p>
                  The admin user has been created. You can now log in using your
                  credentials.
                </p>
                <p className="mt-2">
                  You will be redirected to the login page in a few seconds.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render setup form
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">System Setup</CardTitle>
          <CardDescription>
            Initialize the system with your admin account and default data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="secretKey">Setup Secret Key</Label>
              <Input
                id="secretKey"
                type="password"
                placeholder="Enter the setup secret key"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                disabled={setupLoading}
                required
              />
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminUsername">Admin Username</Label>
                <Input
                  id="adminUsername"
                  type="text"
                  placeholder="admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={setupLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminName">Admin Full Name</Label>
                <Input
                  id="adminName"
                  type="text"
                  placeholder="Admin User"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  disabled={setupLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={setupLoading}
                required
              />
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin Password</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={setupLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={setupLoading}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="createDefaultBranches"
                checked={createDefaultBranches}
                onCheckedChange={(checked) =>
                  setCreateDefaultBranches(checked === true)
                }
                disabled={setupLoading}
              />
              <Label
                htmlFor="createDefaultBranches"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Create default branches (HQ, Branch 01, Branch 02)
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={setupLoading}>
              {setupLoading ? "Setting up system..." : "Initialize System"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

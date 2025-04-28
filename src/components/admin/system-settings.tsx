"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function SystemSettings() {
  const [settings, setSettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    maxLoginAttempts: 5,
    ipRestriction: false,
    rateLimiting: true,
  });

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        throw new Error("Failed to save settings");
      }
      setSaveSuccess(true);
      // If you use a toast/notification system, show success toast here
      // toast.success("Settings saved successfully");
    } catch (error: any) {
      setSaveError(error.message || "Unknown error");
      // toast.error("Failed to save settings");
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">System Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure system-wide security and operational settings.
        </p>
      </div>

      <Separator />

      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              Require 2FA for all users
            </p>
          </div>
          <Switch
            checked={settings.twoFactorAuth}
            onCheckedChange={(checked) =>
              handleChange("twoFactorAuth", checked)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Session Timeout (minutes)</Label>
            <p className="text-sm text-muted-foreground">
              Automatically log out inactive users
            </p>
          </div>
          <Input
            type="number"
            value={settings.sessionTimeout}
            onChange={(e) =>
              handleChange("sessionTimeout", parseInt(e.target.value))
            }
            className="w-20"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Password Expiry (days)</Label>
            <p className="text-sm text-muted-foreground">
              Force password change after specified days
            </p>
          </div>
          <Input
            type="number"
            value={settings.passwordExpiry}
            onChange={(e) =>
              handleChange("passwordExpiry", parseInt(e.target.value))
            }
            className="w-20"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Max Login Attempts</Label>
            <p className="text-sm text-muted-foreground">
              Number of failed attempts before account lockout
            </p>
          </div>
          <Input
            type="number"
            value={settings.maxLoginAttempts}
            onChange={(e) =>
              handleChange("maxLoginAttempts", parseInt(e.target.value))
            }
            className="w-20"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>IP Restriction</Label>
            <p className="text-sm text-muted-foreground">
              Enable IP-based access control
            </p>
          </div>
          <Switch
            checked={settings.ipRestriction}
            onCheckedChange={(checked) =>
              handleChange("ipRestriction", checked)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Rate Limiting</Label>
            <p className="text-sm text-muted-foreground">
              Enable API rate limiting
            </p>
          </div>
          <Switch
            checked={settings.rateLimiting}
            onCheckedChange={(checked) => handleChange("rateLimiting", checked)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
        {saveSuccess && (
          <span className="text-green-600 ml-4">Settings saved!</span>
        )}
        {saveError && (
          <span className="text-red-600 ml-4">{saveError}</span>
        )}
      </div>
    </div>
  );
}

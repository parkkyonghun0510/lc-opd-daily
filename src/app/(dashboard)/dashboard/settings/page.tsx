"use client";

import { useRef, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
  User,
  Bell,
  Lock,
  Moon,
  Camera,
  Sun,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserData } from "@/contexts/UserDataContext";

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
  email: z.string().email("Invalid email address"),
});

const passwordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileFormSchema>;
type PasswordFormData = z.infer<typeof passwordFormSchema>;

type ValidationError<T> = {
  field: keyof T;
  message: string;
};

const calculatePasswordStrength = (password: string): number => {
  if (!password) return 0;
  let strength = 0;
  if (password.length >= 8) strength += 20;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 20;
  if (/[0-9]/.test(password)) strength += 20;
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;
  return strength;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { userData, isLoading, updateUserData } = useUserData();
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = session?.user?.role === "admin";

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  // Update form values when user data changes
  useEffect(() => {
    if (userData) {
      profileForm.reset({
        name: userData.name || "",
        email: userData.email || "",
      });
    }
  }, [userData, profileForm]);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Track form dirty state
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (profileForm.formState.isDirty || passwordForm.formState.isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [profileForm.formState.isDirty, passwordForm.formState.isDirty]);

  // Update password strength when new password changes
  useEffect(() => {
    const subscription = passwordForm.watch((value, { name }) => {
      if (name === "newPassword") {
        setPasswordStrength(calculatePasswordStrength(value.newPassword || ""));
      }
    });
    return () => subscription.unsubscribe();
  }, [passwordForm.watch]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File size should be less than 5MB");
      return;
    }

    try {
      setIsAvatarUploading(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload avatar");
      }

      const data = await response.json();

      // Update user data through context
      await updateUserData({ image: data.avatarUrl });
      toast.success("Profile picture updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload profile picture"
      );
      console.error(error);
    } finally {
      setIsAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  async function onProfileSubmit(data: ProfileFormData) {
    try {
      setIsProfileSaving(true);
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.details) {
          (errorData.details as ValidationError<ProfileFormData>[]).forEach(
            (error) => {
              profileForm.setError(error.field, {
                type: "manual",
                message: error.message,
              });
            }
          );
          throw new Error("Please fix the form errors");
        }
        throw new Error(errorData.error || "Failed to update profile");
      }

      const updatedData = await response.json();

      // Update user data through context
      await updateUserData(updatedData.user);

      // Reset form state
      profileForm.reset(data);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
      console.error(error);
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function onPasswordSubmit(data: PasswordFormData) {
    try {
      setIsPasswordSaving(true);
      const response = await fetch("/api/users/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.details) {
          (errorData.details as ValidationError<PasswordFormData>[]).forEach(
            (error) => {
              passwordForm.setError(error.field, {
                type: "manual",
                message: error.message,
              });
            }
          );
          throw new Error("Please fix the form errors");
        }
        throw new Error(errorData.error || "Failed to update password");
      }

      toast.success("Password updated successfully");
      passwordForm.reset();
      setPasswordStrength(0);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update password"
      );
      console.error(error);
    } finally {
      setIsPasswordSaving(false);
    }
  }

  const getStrengthColor = (strength: number) => {
    if (strength <= 20) return "bg-red-500";
    if (strength <= 40) return "bg-orange-500";
    if (strength <= 60) return "bg-yellow-500";
    if (strength <= 80) return "bg-blue-500";
    return "bg-green-500";
  };

  // Show loading state while data is being fetched
  if (isLoading || status === "loading") {
    return (
      <div className="container max-w-5xl py-6">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hidden md:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center space-x-2"
          >
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="flex items-center space-x-2"
          >
            <Sun className="h-4 w-4" />
            <span>Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Lock className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information and email address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      className="h-20 w-20 cursor-pointer transition-opacity hover:opacity-80"
                      onClick={handleAvatarClick}
                    >
                      {isAvatarUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      )}
                      <AvatarImage 
                        src={userData?.image || ""} 
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          // If image fails to load, hide it and let the fallback show
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          console.error("Image failed to load:", userData?.image);
                        }}
                      />
                      <AvatarFallback className="bg-primary/10">
                        {userData?.name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                      <div className="absolute bottom-0 right-0 rounded-full bg-primary p-1 text-white">
                        <Camera className="h-4 w-4" />
                      </div>
                    </Avatar>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                      aria-label="Upload profile picture"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Profile Picture</h3>
                    <p className="text-sm text-gray-500">
                      Click on the avatar to upload a new profile picture
                    </p>
                  </div>
                </div>
              </div>

              <FormProvider {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <FormLabel>Username</FormLabel>
                    <Input
                      value={userData?.username || ""}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">
                      {isAdmin
                        ? "As an admin, you can change usernames in the user management section"
                        : "Username can only be changed by an administrator"}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={isProfileSaving || !profileForm.formState.isDirty}
                  >
                    {isProfileSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </FormProvider>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Report Updates</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when a report is updated.
                  </p>
                </div>
                <Switch
                  checked={
                    userData?.preferences?.notifications?.reportUpdates ?? true
                  }
                  onCheckedChange={async (checked) => {
                    try {
                      await updateUserData({
                        preferences: {
                          notifications: {
                            reportUpdates: checked,
                            reportComments:
                              userData?.preferences?.notifications
                                ?.reportComments ?? true,
                            reportApprovals:
                              userData?.preferences?.notifications
                                ?.reportApprovals ?? true,
                          },
                          appearance: {
                            compactMode:
                              userData?.preferences?.appearance?.compactMode ??
                              false,
                          },
                        },
                      });
                      toast.success("Notification preferences updated");
                    } catch (error: unknown) {
                      console.error(
                        "Failed to update notification preferences:",
                        error
                      );
                      toast.error("Failed to update notification preferences");
                    }
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Report Comments</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when someone comments on a report.
                  </p>
                </div>
                <Switch
                  checked={
                    userData?.preferences?.notifications?.reportComments ?? true
                  }
                  onCheckedChange={async (checked) => {
                    try {
                      await updateUserData({
                        preferences: {
                          notifications: {
                            reportUpdates:
                              userData?.preferences?.notifications
                                ?.reportUpdates ?? true,
                            reportComments: checked,
                            reportApprovals:
                              userData?.preferences?.notifications
                                ?.reportApprovals ?? true,
                          },
                          appearance: {
                            compactMode:
                              userData?.preferences?.appearance?.compactMode ??
                              false,
                          },
                        },
                      });
                      toast.success("Notification preferences updated");
                    } catch (error: unknown) {
                      console.error(
                        "Failed to update notification preferences:",
                        error
                      );
                      toast.error("Failed to update notification preferences");
                    }
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Report Approvals</h4>
                  <p className="text-sm text-muted-foreground">
                    Get notified when a report is approved or rejected.
                  </p>
                </div>
                <Switch
                  checked={
                    userData?.preferences?.notifications?.reportApprovals ??
                    true
                  }
                  onCheckedChange={async (checked) => {
                    try {
                      await updateUserData({
                        preferences: {
                          notifications: {
                            reportUpdates:
                              userData?.preferences?.notifications
                                ?.reportUpdates ?? true,
                            reportComments:
                              userData?.preferences?.notifications
                                ?.reportComments ?? true,
                            reportApprovals: checked,
                          },
                          appearance: {
                            compactMode:
                              userData?.preferences?.appearance?.compactMode ??
                              false,
                          },
                        },
                      });
                      toast.success("Notification preferences updated");
                    } catch (error: unknown) {
                      console.error(
                        "Failed to update notification preferences:",
                        error
                      );
                      toast.error("Failed to update notification preferences");
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks and feels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Theme</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose between light and dark mode.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme("light")}
                    className={cn(
                      "h-9 w-9",
                      theme === "light" && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "h-9 w-9",
                      theme === "dark" && "bg-primary text-primary-foreground"
                    )}
                  >
                    <Moon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Compact Mode</h4>
                  <p className="text-sm text-muted-foreground">
                    Use a more compact layout for the interface.
                  </p>
                </div>
                <Switch
                  checked={
                    userData?.preferences?.appearance?.compactMode ?? false
                  }
                  onCheckedChange={async (checked) => {
                    try {
                      await updateUserData({
                        preferences: {
                          notifications: {
                            reportUpdates:
                              userData?.preferences?.notifications
                                ?.reportUpdates ?? true,
                            reportComments:
                              userData?.preferences?.notifications
                                ?.reportComments ?? true,
                            reportApprovals:
                              userData?.preferences?.notifications
                                ?.reportApprovals ?? true,
                          },
                          appearance: {
                            compactMode: checked,
                          },
                        },
                      });
                      toast.success("Notification preferences updated");
                    } catch (error: unknown) {
                      console.error(
                        "Failed to update notification preferences:",
                        error
                      );
                      toast.error("Failed to update notification preferences");
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormProvider {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            autoComplete="current-password"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                const strength = calculatePasswordStrength(e.target.value);
                                setPasswordStrength(strength);
                              }}
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input 
                            type="password" 
                            autoComplete="new-password"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="mt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Password Strength</span>
                      <span
                        className={cn(
                          "font-medium",
                          passwordStrength <= 20
                            ? "text-red-500"
                            : passwordStrength <= 40
                            ? "text-orange-500"
                            : passwordStrength <= 60
                            ? "text-yellow-500"
                            : passwordStrength <= 80
                            ? "text-blue-500"
                            : "text-green-500"
                        )}
                      >
                        {passwordStrength <= 20
                          ? "Very Weak"
                          : passwordStrength <= 40
                          ? "Weak"
                          : passwordStrength <= 60
                          ? "Fair"
                          : passwordStrength <= 80
                          ? "Good"
                          : "Strong"}
                      </span>
                    </div>
                    <Progress
                      value={passwordStrength}
                      className={cn(
                        "h-2",
                        getStrengthColor(passwordStrength)
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isPasswordSaving || !passwordForm.formState.isDirty}
                  >
                    {isPasswordSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              </FormProvider>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

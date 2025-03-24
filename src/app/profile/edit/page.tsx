"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  Camera,
  ChevronLeft,
  Home,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { fetchUserData, updateUserProfile } from "@/app/_actions/user-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number")
    .optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  notifications: z.object({
    email: z.object({
      reportUpdates: z.boolean(),
      reportComments: z.boolean(),
      reportApprovals: z.boolean(),
    }),
    inApp: z.object({
      reportUpdates: z.boolean(),
      reportComments: z.boolean(),
      reportApprovals: z.boolean(),
    }),
  }),
  appearance: z.object({
    compactMode: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
  }),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function EditProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    image?: string;
  } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const result = await fetchUserData();

        if (result.status === 401) {
          router.push("/login");
          return;
        }

        if (result.status === 404) {
          setError("User profile not found");
          return;
        }

        if (result.status === 500) {
          setError("Failed to load profile");
          return;
        }

        if (!result.data) {
          setError("No user data received");
          return;
        }

        setUser({
          name: result.data.name,
          email: result.data.email,
          image: result.data.image,
        });

        form.reset({
          name: result.data.name,
          email: result.data.email,
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Could not load your profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, [router, form]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Image size should be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("avatar", imageFile);

      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload image");
      }

      const data = await response.json();
      
      // Update user data
      setUser(prev => prev ? { ...prev, image: data.avatarUrl } : null);
      
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
      
      // Clear file input
      setImageFile(null);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  async function onSubmit(data: ProfileFormData) {
    try {
      setSaving(true);

      // If there's a new image, upload it first
      if (imageFile) {
        await handleImageUpload();
      }

      const result = await updateUserProfile(data);

      if (result.status === 401) {
        router.push("/login");
        return;
      }

      if (result.status === 404) {
        toast({
          title: "Error",
          description: "User profile not found",
          variant: "destructive",
        });
        return;
      }

      if (result.status === 500) {
        toast({
          title: "Error",
          description: "Failed to update profile",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      router.push("/profile");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push("/profile")}>
            Return to Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Edit Profile</h1>
        <p className="text-muted-foreground">
          Update your personal information
        </p>
      </div>

      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link
          href="/dashboard"
          className="flex items-center hover:text-foreground"
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          href="/profile"
          className="flex items-center hover:text-foreground"
        >
          Profile
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Edit Profile</span>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal details and profile picture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 transition-transform duration-200 group-hover:scale-105">
                      {uploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-10">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      )}
                      <AvatarImage 
                        src={imagePreview || user?.image} 
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          // If image fails to load, hide it and let the fallback show
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          console.error("Image failed to load:", user?.image);
                        }}
                      />
                      <AvatarFallback className="bg-primary/10 text-lg">
                        {user?.name
                          ? user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                          : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <Label
                      htmlFor="image-upload"
                      className="absolute bottom-0 right-0 rounded-full bg-background border p-2 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Camera className="h-4 w-4" />
                    </Label>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Click to upload new photo
                    </p>
                    {imageFile && (
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          onClick={handleImageUpload}
                          disabled={uploadingImage}
                        >
                          {uploadingImage ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Uploading...
                            </>
                          ) : "Upload Now"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          disabled={uploadingImage}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1">
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your full name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Enter your email address"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Choose a username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your phone number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="UTC">UTC</SelectItem>
                                <SelectItem value="EST">
                                  Eastern Time
                                </SelectItem>
                                <SelectItem value="PST">
                                  Pacific Time
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bio</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us about yourself"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push("/profile")}
                        >
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Manage how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Email Notifications
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Report Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when reports are updated
                        </p>
                      </div>
                      <FormField
                        control={form.control}
                        name="notifications.email.reportUpdates"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* Add more notification toggles */}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    In-App Notifications
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Report Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive in-app notifications for report updates
                        </p>
                      </div>
                      <FormField
                        control={form.control}
                        name="notifications.inApp.reportUpdates"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* Add more notification toggles */}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Use a more compact layout
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="appearance.compactMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="appearance.theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a theme" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Coming soon",
                        description:
                          "Two-factor authentication will be available soon.",
                      })
                    }
                  >
                    Enable 2FA
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Change Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Update your account password
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/settings?tab=security")}
                  >
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Active Sessions</Label>
                    <p className="text-sm text-muted-foreground">
                      View and manage your active sessions
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast({
                        title: "Coming soon",
                        description:
                          "Session management will be available soon.",
                      })
                    }
                  >
                    Manage Sessions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

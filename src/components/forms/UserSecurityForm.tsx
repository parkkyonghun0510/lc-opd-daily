"use client";

import { useState, useEffect } from "react";
import { useForm, ControllerRenderProps, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

const securityFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  confirmPassword: z.string(),
  isActive: z.boolean(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"],
});

type SecurityFormValues = z.infer<typeof securityFormSchema>;

interface UserSecurityFormProps {
  userId: string;
  isActive: boolean;
  onSubmit: (data: SecurityFormValues) => Promise<void>;
}

export default function UserSecurityForm({ userId, isActive, onSubmit }: UserSecurityFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordTyped, setPasswordTyped] = useState(false);
  const { toast } = useToast();

  const form = useForm<SecurityFormValues>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      isActive,
    },
  });

  const calculatePasswordStrength = (password: string) => {
    if (!password) return 0;
    
    let strength = 0;
    // Length
    if (password.length >= 8) strength += 20;
    // Uppercase
    if (/[A-Z]/.test(password)) strength += 20;
    // Lowercase
    if (/[a-z]/.test(password)) strength += 20;
    // Number
    if (/[0-9]/.test(password)) strength += 20;
    // Special character
    if (/[^A-Za-z0-9]/.test(password)) strength += 20;
    
    return strength;
  };

  const getStrengthLabel = (strength: number) => {
    if (strength < 40) return "Weak";
    if (strength < 70) return "Moderate";
    return "Strong";
  };

  const getStrengthColor = (strength: number) => {
    if (strength < 40) return "bg-red-500";
    if (strength < 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  // Update password strength when password changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "newPassword" || name === "confirmPassword") {
        const strength = calculatePasswordStrength(value.newPassword || "");
        setPasswordStrength(strength);
        if (value.newPassword && value.newPassword.length > 0) {
          setPasswordTyped(true);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const handleSubmit = async (data: SecurityFormValues) => {
    try {
      setIsLoading(true);
      await onSubmit(data);
      form.reset();
      setPasswordTyped(false);
      setPasswordStrength(0);
      toast({
        title: "Success",
        description: "Password updated successfully!"
      });
    } catch (error) {
      console.error("Error updating security settings:", error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }: { field: ControllerRenderProps<SecurityFormValues, "currentPassword"> }) => (
            <FormItem>
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }: { field: ControllerRenderProps<SecurityFormValues, "newPassword"> }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  {...field}
                  onBlur={(e) => {
                    field.onBlur();
                    if (e.target.value) {
                      setPasswordTyped(true);
                    }
                  }}
                />
              </FormControl>
              {passwordTyped && (
                <>
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs">Password Strength:</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength < 40 ? "text-red-500" : 
                        passwordStrength < 70 ? "text-yellow-500" : 
                        "text-green-500"
                      }`}>
                        {getStrengthLabel(passwordStrength)}
                      </span>
                    </div>
                    <Progress 
                      value={passwordStrength} 
                      className={`h-1.5 ${getStrengthColor(passwordStrength)}`}
                    />
                  </div>
                  <FormDescription className="mt-2">
                    <ul className="text-xs space-y-1 list-disc pl-4">
                      <li className={/[A-Z]/.test(field.value) ? "text-green-500" : "text-gray-500"}>
                        At least one uppercase letter
                      </li>
                      <li className={/[a-z]/.test(field.value) ? "text-green-500" : "text-gray-500"}>
                        At least one lowercase letter
                      </li>
                      <li className={/[0-9]/.test(field.value) ? "text-green-500" : "text-gray-500"}>
                        At least one number
                      </li>
                      <li className={/[^A-Za-z0-9]/.test(field.value) ? "text-green-500" : "text-gray-500"}>
                        At least one special character
                      </li>
                      <li className={field.value.length >= 8 ? "text-green-500" : "text-gray-500"}>
                        Minimum 8 characters long
                      </li>
                    </ul>
                  </FormDescription>
                </>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }: { field: ControllerRenderProps<SecurityFormValues, "confirmPassword"> }) => (
            <FormItem>
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
              {field.value && form.getValues("newPassword") && (
                <div className="mt-1">
                  {field.value === form.getValues("newPassword") ? (
                    <p className="text-xs text-green-500">Passwords match</p>
                  ) : (
                    <p className="text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }: { field: ControllerRenderProps<SecurityFormValues, "isActive"> }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Account Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  {field.value ? "Active" : "Inactive"}
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update Security Settings"}
        </Button>
      </form>
    </FormProvider>
  );
} 
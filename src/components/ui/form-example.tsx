"use client";

import { z } from "zod";
import { useFormValidation } from "@/hooks/useFormValidation";
import { Form, FormField, FormInput, FormSelect, FormTextarea } from "./form";
import { Button } from "./button";

const formSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  role: z.enum(["admin", "user", "guest"], {
    required_error: "Please select a role",
  }),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must be less than 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  name: "",
  email: "",
  role: "user",
  message: "",
};

const roleOptions = [
  { value: "admin", label: "Administrator" },
  { value: "user", label: "User" },
  { value: "guest", label: "Guest" },
];

export function FormExample() {
  const {
    handleSubmit,
    isSubmitting,
    error: formError,
    isDirty,
    ...form
  } = useFormValidation({
    schema: formSchema,
    defaultValues,
    storageKey: "example-form",
    onSubmit: async (data) => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Form submitted:", data);
    },
  });

  return (
    <Form {...form} className="space-y-6">
      <FormField name="name">
        <FormInput
          name="name"
          label="Name"
          placeholder="Enter your name"
          description="Your full name"
        />
      </FormField>

      <FormField name="email">
        <FormInput
          name="email"
          type="email"
          label="Email"
          placeholder="Enter your email"
          description="Your email address"
        />
      </FormField>

      <FormField name="role">
        <FormSelect
          name="role"
          label="Role"
          options={roleOptions}
          description="Select your role"
        />
      </FormField>

      <FormField name="message">
        <FormTextarea
          name="message"
          label="Message"
          placeholder="Enter your message"
          description="Your message"
          rows={4}
        />
      </FormField>

      {formError && <div className="text-sm text-destructive">{formError}</div>}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
        {isDirty && (
          <span className="text-sm text-muted-foreground">
            You have unsaved changes
          </span>
        )}
      </div>
    </Form>
  );
}

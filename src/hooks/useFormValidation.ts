"use client";

import { useEffect, useState } from "react";
import {
  useForm,
  UseFormReturn,
  FieldValues,
  SubmitHandler,
  UseFormHandleSubmit,
  DefaultValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";

interface UseFormValidationProps<T extends FieldValues> {
  schema: z.ZodSchema<T>;
  defaultValues: DefaultValues<T>;
  storageKey: string;
  onSubmit: (data: T) => Promise<void> | void;
  options?: {
    persistDraft?: boolean;
    confirmNavigation?: boolean;
    autoSaveInterval?: number;
  };
}

interface UseFormValidationReturn<T extends FieldValues>
  extends Omit<UseFormReturn<T>, "handleSubmit"> {
  handleSubmit: UseFormHandleSubmit<T>;
  isDirty: boolean;
  isSubmitting: boolean;
  error: string | null;
}

export function useFormValidation<T extends FieldValues>({
  schema,
  defaultValues,
  storageKey,
  onSubmit,
  options = {
    persistDraft: true,
    confirmNavigation: true,
    autoSaveInterval: 30000, // 30 seconds
  },
}: UseFormValidationProps<T>): UseFormValidationReturn<T> {
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
  });

  // Load draft from localStorage
  useEffect(() => {
    if (options.persistDraft) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          form.reset(draft);
        } catch (e) {
          console.error("Failed to load draft:", e);
        }
      }
    }
  }, [storageKey, form, options.persistDraft]);

  // Auto-save draft
  useEffect(() => {
    if (!options.persistDraft) return;

    const interval = setInterval(() => {
      if (form.formState.isDirty) {
        localStorage.setItem(storageKey, JSON.stringify(form.getValues()));
      }
    }, options.autoSaveInterval);

    return () => clearInterval(interval);
  }, [form, storageKey, options.persistDraft, options.autoSaveInterval]);

  // Handle form submission
  const handleSubmit: SubmitHandler<T> = async (data) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(data);
      setIsDirty(false);
      if (options.persistDraft) {
        localStorage.removeItem(storageKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Track form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setIsDirty(form.formState.isDirty);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Confirm navigation when form is dirty
  useBeforeUnload(
    Boolean(isDirty && options.confirmNavigation),
    "You have unsaved changes. Are you sure you want to leave?",
  );

  return {
    ...form,
    handleSubmit: form.handleSubmit,
    isDirty,
    isSubmitting,
    error,
  };
}

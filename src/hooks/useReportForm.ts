import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "@/components/ui/use-toast";
import type { ReportType, Branch } from "@/types/reports";
import { format } from "date-fns";

interface ValidationRules {
  writeOffs: {
    maxAmount: number;
    requireApproval: boolean;
  };
  ninetyPlus: {
    maxAmount: number;
    requireApproval: boolean;
  };
  comments: {
    required: boolean;
    minLength: number;
  };
  duplicateCheck: {
    enabled: boolean;
  };
}

const reportFormSchema = z.object({
  date: z.date({
    required_error: "Date is required",
  }),
  branchId: z.string({
    required_error: "Branch is required",
  }),
  writeOffs: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Write-offs must be a positive number"),
  ninetyPlus: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "90+ Days must be a positive number"),
  comments: z.string().optional(),
  reportType: z.enum(["plan", "actual"]),
});

type ReportFormData = z.infer<typeof reportFormSchema>;

const STORAGE_KEY = "report_draft";

interface UseReportFormProps {
  reportType: ReportType;
  userBranches: Branch[];
  onSuccess: () => void;
}

export function useReportForm({
  reportType,
  userBranches,
  onSuccess,
}: UseReportFormProps) {
  const [formData, setFormData] = useState<ReportFormData>({
    date: new Date(),
    branchId: userBranches.length === 1 ? userBranches[0].id : "",
    writeOffs: "",
    ninetyPlus: "",
    comments: "",
    reportType,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationRules, setValidationRules] =
    useState<ValidationRules | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Fetch validation rules
  useEffect(() => {
    const fetchValidationRules = async () => {
      try {
        const response = await fetch("/api/validation-rules");
        if (response.ok) {
          const rules = await response.json();
          setValidationRules(rules);
        }
      } catch (error) {
        console.error("Error fetching validation rules:", error);
      }
    };

    fetchValidationRules();
  }, []);

  // Check for duplicate report when date or branch changes
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!formData.date || !formData.branchId) return;

      setIsCheckingDuplicate(true);
      try {
        const formattedDate = format(formData.date, "yyyy-MM-dd");
        const response = await fetch(
          `/api/reports/check-duplicate?date=${formattedDate}&branchId=${formData.branchId}&reportType=${formData.reportType}`
        );
        const data = await response.json();

        if (data.isDuplicate) {
          setErrors((prev) => ({
            ...prev,
            general: `A report for ${formData.branchId} on ${formattedDate} already exists.`,
          }));
        } else {
          setErrors((prev) => {
            const { general, ...rest } = prev;
            return rest;
          });
        }
      } catch (error) {
        console.error("Error checking for duplicate report:", error);
      } finally {
        setIsCheckingDuplicate(false);
      }
    };

    checkDuplicate();
  }, [formData.date, formData.branchId, formData.reportType]);

  // Load draft from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        // Only load draft if it's for the same report type
        if (parsedDraft.reportType === reportType) {
          setFormData(parsedDraft);
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
  }, [reportType]);

  // Save draft to localStorage
  useEffect(() => {
    const saveDraft = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch (error) {
        console.error("Error saving draft:", error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [formData]);

  // Clear draft after successful submission
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  const validateForm = () => {
    try {
      // First validate against the schema
      reportFormSchema.parse(formData);

      // Then validate against organization rules if available
      if (validationRules) {
        const writeOffs = parseFloat(formData.writeOffs);
        const ninetyPlus = parseFloat(formData.ninetyPlus);

        // Check write-offs limits
        if (writeOffs > validationRules.writeOffs.maxAmount) {
          throw new Error(
            `Write-offs cannot exceed ${validationRules.writeOffs.maxAmount}`
          );
        }

        // Check 90+ days limits
        if (ninetyPlus > validationRules.ninetyPlus.maxAmount) {
          throw new Error(
            `90+ Days cannot exceed ${validationRules.ninetyPlus.maxAmount}`
          );
        }

        // Check comments requirements
        if (validationRules.comments.required && !formData.comments) {
          throw new Error("Comments are required");
        }
        if (
          formData.comments &&
          formData.comments.length < validationRules.comments.minLength
        ) {
          throw new Error(
            `Comments must be at least ${validationRules.comments.minLength} characters`
          );
        }
      }

      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      } else if (error instanceof Error) {
        setErrors({ general: error.message });
      }
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please check the form for errors",
        variant: "destructive",
      });
      return;
    }

    if (errors.general) {
      toast({
        title: "Error",
        description: errors.general,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          writeOffs: parseFloat(formData.writeOffs),
          ninetyPlus: parseFloat(formData.ninetyPlus),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create report");
      }

      clearDraft();
      onSuccess();
      toast({
        title: "Success",
        description: "Report created successfully",
      });
    } catch (error) {
      console.error("Error creating report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (
    field: keyof ReportFormData,
    value: ReportFormData[keyof ReportFormData]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for the field when it's updated
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: "" }));
    }
  };

  return {
    formData,
    errors,
    isSubmitting,
    isCheckingDuplicate,
    updateField,
    handleSubmit,
    validationRules,
  };
}

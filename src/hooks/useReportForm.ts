import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "@/components/ui/use-toast";
import type { ReportType, Branch } from "@/types/reports";
import { format } from "date-fns";

interface ValidationRules {
  writeOffs: {
    requireApproval: boolean;
  };
  ninetyPlus: {
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
  writeOffs: z.number().min(0, "Write-offs must be a positive number"),
  ninetyPlus: z.number().min(0, "90+ Days must be a positive number"),
  comments: z.string().optional(),
  reportType: z.enum(["plan", "actual"]),
  title: z.string().min(1, "Title is required"),
  planReportId: z.string().nullable().optional(),
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
    writeOffs: 0,
    ninetyPlus: 0,
    comments: "",
    reportType,
    title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(new Date(), "yyyy-MM-dd")}`,
    planReportId: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationRules, setValidationRules] = useState<ValidationRules>();
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
        
        if (!response.ok) {
          throw new Error("Failed to check for duplicate reports");
        }
        
        const data = await response.json();
        return data.exists;
      } catch (error) {
        console.error("Error checking for duplicate:", error);
        return false;
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
          // Convert string values to numbers for numeric fields
          const draftData = {
            ...parsedDraft,
            writeOffs: Number(parsedDraft.writeOffs),
            ninetyPlus: Number(parsedDraft.ninetyPlus),
          };
          setFormData(draftData);
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

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    try {
      // Convert numeric fields to numbers if they're strings
      const dataToValidate = {
        ...formData,
        writeOffs: Number(formData.writeOffs),
        ninetyPlus: Number(formData.ninetyPlus),
        title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(new Date(), "yyyy-MM-dd")}`,
      };

      // First validate against the schema
      reportFormSchema.parse(dataToValidate);

      // Then validate against organization rules if available
      if (validationRules) {
        // Check comments requirements
        if (validationRules.comments.required && !dataToValidate.comments) {
          errors.comments = "Comments are required";
        }
        if (
          dataToValidate.comments &&
          dataToValidate.comments.length < validationRules.comments.minLength
        ) {
          errors.comments = `Comments must be at least ${validationRules.comments.minLength} characters`;
        }
      }

      return errors;
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          if (err.path[0]) {
            const field = err.path[0].toString();
            errors[field] = err.message;
          }
        });
      } else if (error instanceof Error) {
        errors.general = error.message;
      }
      return errors;
    }
  };

  const handleSubmit = async () => {
    // Validate form data
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Ensure report type is set correctly
      const dataToSubmit = {
        ...formData,
        reportType: reportType, // Explicitly set from props
      };
      
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API validation errors
        if (response.status === 400) {
          const errorMessage = data.details || data.error || "Failed to create report";
          const fieldErrors: Record<string, string> = {};
          
          // Parse field-specific errors from the details
          if (data.details) {
            const fields = data.details.match(/The following fields are required: (.*)/);
            if (fields) {
              fields[1].split(", ").forEach((field: string) => {
                fieldErrors[field] = `${field} is required`;
              });
            }
          }
          
          setErrors({
            general: errorMessage,
            ...fieldErrors,
          });
          
          toast({
            title: "Validation Error",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error || "Failed to create report");
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
        description: error instanceof Error ? error.message : "Failed to create report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update a specific field in the form data
  const updateField = <K extends keyof ReportFormData>(
    field: K,
    value: ReportFormData[K]
  ) => {
    // Convert string values to numbers for numeric fields
    if (field === "writeOffs" || field === "ninetyPlus") {
      const numValue = typeof value === "string" ? Number(value) : value;
      setFormData((prev) => ({ ...prev, [field]: numValue }));
    } else if (field === "date" && value) {
      // If we're updating the date, also update the title accordingly
      setFormData((prev) => ({
        ...prev,
        [field]: value,
        title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(value as Date, "yyyy-MM-dd")}`,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    
    // Clear error for the field when it's updated
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: "" }));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      date: new Date(),
      branchId: '',
      writeOffs: 0,
      ninetyPlus: 0,
      comments: '',
      reportType: reportType,
      planReportId: null,
    });
    setErrors({});
  };

  return {
    formData,
    errors,
    isSubmitting,
    isCheckingDuplicate,
    updateField,
    handleSubmit,
    validationRules,
    setFormData,
  };
}

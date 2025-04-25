import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "@/components/ui/use-toast";
import type { ReportType, Branch, CommentItem } from "@/types/reports";
import { format } from "date-fns";
import { sanitizeString, sanitizeFormData } from "@/utils/clientSanitize";
import { v4 as uuidv4 } from "uuid";

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
  commentArray: z.array(z.any()).default([]),
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
    commentArray: [],
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
        if (!response.ok) {
          const errorData = await response.json();
          console.warn("Failed to fetch validation rules:", errorData);
          // Don't throw error, just use default validation
          return;
        }
        const rules = await response.json();
        setValidationRules(rules);
      } catch (error) {
        console.error("Error fetching validation rules:", error);
        // Don't throw error, just use default validation
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
        return data.isDuplicate;
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
        // NOTE: We show approval warnings but don't block submission
        // These will be handled during the approval workflow

        // Check commentArray requirements - these are required regardless of approval
        if (validationRules.comments.required &&
          (!dataToValidate.commentArray || dataToValidate.commentArray.length === 0)) {
          errors.commentArray = "Comments are required";
        }

        // Check if the first comment meets the minimum length requirement
        if (
          dataToValidate.commentArray &&
          dataToValidate.commentArray.length > 0 &&
          dataToValidate.commentArray[0].text &&
          dataToValidate.commentArray[0].text.length < validationRules.comments.minLength
        ) {
          errors.commentArray = `Comments must be at least ${validationRules.comments.minLength} characters`;
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

    // Additional validation for date field
    if (!formData.date || !(formData.date instanceof Date) || isNaN(formData.date.getTime())) {
      setErrors({
        ...validationErrors,
        date: "Please select a valid date",
      });
      toast({
        title: "Validation Error",
        description: "Please select a valid date",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a copy of formData with guaranteed valid date
      const validFormData = {
        ...formData,
        // Ensure date is a proper Date object
        date: formData.date instanceof Date && !isNaN(formData.date.getTime())
          ? formData.date
          : new Date(),
        reportType: reportType, // Explicitly set from props
      };

      // Log the date being submitted for debugging
      console.log("Submitting report with date:", validFormData.date);

      // Ensure report type is set correctly and sanitize the data
      const dataToSubmit = sanitizeFormData(validFormData);

      // Ensure commentArray is properly formatted and sanitized
      if (!dataToSubmit.commentArray || !Array.isArray(dataToSubmit.commentArray)) {
        dataToSubmit.commentArray = [];
      }

      // Sanitize each comment in the commentArray
      if (dataToSubmit.commentArray.length > 0) {
        dataToSubmit.commentArray = dataToSubmit.commentArray.map(comment => {
          if (comment.text) {
            return {
              ...comment,
              text: sanitizeString(comment.text) || ''
            };
          }
          return comment;
        });
      }

      // For backward compatibility with the API, generate a comments string from commentArray
      if (dataToSubmit.commentArray.length > 0) {
        const firstComment = dataToSubmit.commentArray[0];
        dataToSubmit.comments = firstComment.text || '';
      } else {
        dataToSubmit.comments = '';
      }

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

        // Handle permission errors
        if (response.status === 403) {
          toast({
            title: "Permission Error",
            description: data.error || "You don't have permission to create this report",
            variant: "destructive",
          });
          return;
        }

        // Handle any other error status codes
        toast({
          title: "Error",
          description: data.error || "Failed to create report",
          variant: "destructive",
        });
        return;
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
    } else if (field === "date") {
      // Ensure we have a valid date
      let validDate: Date;

      if (value instanceof Date && !isNaN(value.getTime())) {
        // Valid Date object
        validDate = value as Date;
      } else if (typeof value === 'string' && value) {
        // Try to parse string to Date
        const parsedDate = new Date(value);
        validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      } else {
        // Default to current date for any invalid value
        console.warn('Invalid date value, using current date');
        validDate = new Date();
      }

      // If we're updating the date, also update the title accordingly
      setFormData((prev) => ({
        ...prev,
        [field]: validDate,
        title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(validDate, "yyyy-MM-dd")}`,
      }));
    } else if (field === "commentArray") {
      // Handle commentArray updates directly
      setFormData((prev) => ({
        ...prev,
        commentArray: value as CommentItem[]
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
      commentArray: [],
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

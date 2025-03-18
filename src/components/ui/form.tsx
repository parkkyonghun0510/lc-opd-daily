"use client";

import * as React from "react";
import {
  FormProvider,
  useFormContext,
  useFormState,
  type FieldValues,
  UseFormReturn,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Form = FormProvider;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues
> {
  name: string;
  form: UseFormReturn<TFieldValues>;
}

const FormFieldContext = React.createContext<FormFieldContextValue>({
  name: "",
  form: {} as UseFormReturn<FieldValues>,
});

const FormItemContext = React.createContext<{ id: string }>({ id: "" });

const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <div
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

function FormField<TFieldValues extends FieldValues = FieldValues>({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const form = useFormContext<TFieldValues>();
  return (
    <FormFieldContext.Provider
      value={{ name, form } as FormFieldContextValue<TFieldValues>}
    >
      {children}
    </FormFieldContext.Provider>
  );
}

interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: string;
  error?: string;
}

function FormItem({
  label,
  description,
  error,
  className,
  children,
  ...props
}: FormItemProps) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props}>
        {label && (
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
        )}
        {children}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <Alert variant="destructive" className="text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </FormItemContext.Provider>
  );
}

interface FormInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> {
  name: string;
  label?: string;
  description?: string;
}

function FormInput({
  name,
  label,
  description,
  className,
  ...props
}: FormInputProps) {
  const { form } = React.useContext(FormFieldContext);
  const { register, formState } = form;
  const error = formState.errors[name]?.message as string;

  return (
    <FormItem label={label} description={description} error={error}>
      <Input
        {...register(name)}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </FormItem>
  );
}

interface FormTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> {
  name: string;
  label?: string;
  description?: string;
}

function FormTextarea({
  name,
  label,
  description,
  className,
  ...props
}: FormTextareaProps) {
  const { form } = React.useContext(FormFieldContext);
  const { register, formState } = form;
  const error = formState.errors[name]?.message as string;

  return (
    <FormItem label={label} description={description} error={error}>
      <Textarea
        {...register(name)}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </FormItem>
  );
}

interface FormSelectProps {
  name: string;
  label?: string;
  description?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

function FormSelect({
  name,
  label,
  description,
  options,
  placeholder = "Select an option",
  className,
}: FormSelectProps) {
  const { form } = React.useContext(FormFieldContext);
  const { setValue, formState } = form;
  const error = formState.errors[name]?.message as string;

  return (
    <FormItem label={label} description={description} error={error}>
      <Select
        onValueChange={(value) => setValue(name, value)}
        defaultValue={formState.defaultValues?.[name] as string}
      >
        <SelectTrigger
          className={cn(
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormItem>
  );
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

export {
  Form,
  FormField,
  FormItem,
  FormInput,
  FormTextarea,
  FormSelect,
  FormControl,
  FormLabel,
  FormMessage,
  useFormField,
};

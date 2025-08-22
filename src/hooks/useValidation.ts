/**
 * React hooks for form validation with real-time feedback
 * Integrates with the comprehensive validation system
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Validator,
  ValidationResult,
  ValidationSchema,
  ValidationSchemas,
  FieldValidator
} from '@/lib/validation/validators';
import { ValidationError } from '@/types/errors';
import { handleError } from '@/lib/errors/error-handler';

// Form validation state
export interface FormValidationState {
  isValid: boolean;
  isValidating: boolean;
  errors: Record<string, ValidationError[]>;
  touched: Record<string, boolean>;
  sanitizedValues: Record<string, unknown>;
  warnings: Record<string, string[]>;
}

// Field validation state
export interface FieldValidationState {
  isValid: boolean;
  isValidating: boolean;
  errors: ValidationError[];
  touched: boolean;
  sanitizedValue: unknown;
  warnings: string[];
}

// Validation options
export interface UseValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  schema?: ValidationSchema;
  onValidationComplete?: (result: ValidationResult) => void;
  onError?: (errors: ValidationError[]) => void;
}

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for validating individual form fields
 */
export function useFieldValidation(
  initialValue: unknown = '',
  fieldName: string,
  validationOptions: Record<string, unknown> = {},
  options: Omit<UseValidationOptions, 'schema'> = {}
) {
  const [value, setValue] = useState(initialValue);
  const [state, setState] = useState<FieldValidationState>({
    isValid: true,
    isValidating: false,
    errors: [],
    touched: false,
    sanitizedValue: initialValue,
    warnings: []
  });

  const debouncedValue = useDebounce(value, options.debounceMs || 300);

  // Validate field
  const validateField = useCallback(async (val: unknown, showErrors: boolean = true) => {
    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = Validator.validateField(val, fieldName, validationOptions);
      
      setState(prev => ({
        ...prev,
        isValid: result.isValid,
        isValidating: false,
        errors: showErrors ? result.errors : [],
        sanitizedValue: result.sanitizedValue,
        warnings: result.warnings || []
      }));

      if (options.onValidationComplete) {
        options.onValidationComplete(result);
      }

      if (!result.isValid && options.onError) {
        options.onError(result.errors);
      }

      return result;
    } catch (error) {
      await handleError(error as Error, {
        timestamp: new Date(),
        additionalData: { fieldName, value: val }
      });
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        isValid: false
      }));
      
      return { isValid: false, errors: [], sanitizedValue: val };
    }
  }, [fieldName, validationOptions, options]);

  // Handle value change
  const handleChange = useCallback((newValue: unknown) => {
    setValue(newValue);
    
    if (options.validateOnChange && state.touched) {
      validateField(newValue, true);
    }
  }, [options.validateOnChange, state.touched, validateField]);

  // Handle field blur
  const handleBlur = useCallback(() => {
    setState(prev => ({ ...prev, touched: true }));
    
    if (options.validateOnBlur) {
      validateField(value, true);
    }
  }, [options.validateOnBlur, value, validateField]);

  // Handle field focus
  const handleFocus = useCallback(() => {
    // Clear errors on focus if desired
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // Validate on debounced value change
  useEffect(() => {
    if (state.touched && options.validateOnChange) {
      validateField(debouncedValue, true);
    }
  }, [debouncedValue, state.touched, options.validateOnChange, validateField]);

  // Manual validation trigger
  const validate = useCallback(() => {
    setState(prev => ({ ...prev, touched: true }));
    return validateField(value, true);
  }, [value, validateField]);

  // Reset field state
  const reset = useCallback((newValue: unknown = initialValue) => {
    setValue(newValue);
    setState({
      isValid: true,
      isValidating: false,
      errors: [],
      touched: false,
      sanitizedValue: newValue,
      warnings: []
    });
  }, [initialValue]);

  return {
    value,
    setValue: handleChange,
    state,
    validate,
    reset,
    handleBlur,
    handleFocus,
    // Convenience getters
    isValid: state.isValid,
    isValidating: state.isValidating,
    errors: state.errors,
    hasErrors: state.errors.length > 0,
    touched: state.touched,
    sanitizedValue: state.sanitizedValue,
    warnings: state.warnings
  };
}

/**
 * Hook for validating entire forms with schema
 */
export function useFormValidation(
  initialValues: Record<string, unknown> = {},
  schema: ValidationSchema,
  options: UseValidationOptions = {}
) {
  const [values, setValues] = useState(initialValues);
  const [state, setState] = useState<FormValidationState>({
    isValid: true,
    isValidating: false,
    errors: {},
    touched: {},
    sanitizedValues: initialValues,
    warnings: {}
  });

  const debouncedValues = useDebounce(values, options.debounceMs || 300);

  // Validate entire form
  const validateForm = useCallback(async (vals: Record<string, any> = values, showErrors: boolean = true) => {
    setState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = Validator.validateSchema(vals, schema);
      
      // Group errors by field
      const errorsByField: Record<string, ValidationError[]> = {};
      const warningsByField: Record<string, string[]> = {};
      
      result.errors.forEach(error => {
        const fieldName = error.field || 'general';
        if (!errorsByField[fieldName]) {
          errorsByField[fieldName] = [];
        }
        errorsByField[fieldName].push(error);
      });
      
      // Group warnings by field
      if (result.warnings) {
        result.warnings.forEach(warning => {
          // Extract field name from warning message (simple approach)
          const fieldMatch = warning.match(/^(\w+)\s/);
          const fieldName = fieldMatch ? fieldMatch[1] : 'general';
          if (!warningsByField[fieldName]) {
            warningsByField[fieldName] = [];
          }
          warningsByField[fieldName].push(warning);
        });
      }
      
      setState(prev => ({
        ...prev,
        isValid: result.isValid,
        isValidating: false,
        errors: showErrors ? errorsByField : {},
        sanitizedValues: result.sanitizedValue || vals,
        warnings: warningsByField
      }));

      if (options.onValidationComplete) {
        options.onValidationComplete(result);
      }

      if (!result.isValid && options.onError) {
        options.onError(result.errors);
      }

      return result;
    } catch (error) {
      await handleError(error as Error, {
        timestamp: new Date(),
        additionalData: { formValues: vals }
      });
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        isValid: false
      }));
      
      return { isValid: false, errors: [], sanitizedValue: vals };
    }
  }, [values, schema, options]);

  // Handle field value change
  const setFieldValue = useCallback((fieldName: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
    
    if (options.validateOnChange && state.touched[fieldName]) {
      // Validate just this field for immediate feedback
      const fieldOptions = schema[fieldName];
      if (fieldOptions) {
        const result = Validator.validateField(value, fieldName, fieldOptions);
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [fieldName]: result.errors
          },
          sanitizedValues: {
            ...prev.sanitizedValues,
            [fieldName]: result.sanitizedValue
          }
        }));
      }
    }
  }, [options.validateOnChange, state.touched, schema]);

  // Handle field blur
  const setFieldTouched = useCallback((fieldName: string, touched: boolean = true) => {
    setState(prev => ({
      ...prev,
      touched: { ...prev.touched, [fieldName]: touched }
    }));
    
    if (touched && options.validateOnBlur) {
      const fieldOptions = schema[fieldName];
      if (fieldOptions) {
        const result = Validator.validateField(values[fieldName], fieldName, fieldOptions);
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [fieldName]: result.errors
          },
          sanitizedValues: {
            ...prev.sanitizedValues,
            [fieldName]: result.sanitizedValue
          }
        }));
      }
    }
  }, [options.validateOnBlur, values, schema]);

  // Validate on debounced values change
  useEffect(() => {
    const touchedFields = Object.keys(state.touched).filter(key => state.touched[key]);
    if (touchedFields.length > 0 && options.validateOnChange) {
      validateForm(debouncedValues, true);
    }
  }, [debouncedValues, state.touched, options.validateOnChange, validateForm]);

  // Manual validation trigger
  const validate = useCallback(() => {
    // Mark all fields as touched
    const allTouched = Object.keys(schema).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    setState(prev => ({ ...prev, touched: allTouched }));
    return validateForm(values, true);
  }, [values, schema, validateForm]);

  // Reset form state
  const reset = useCallback((newValues: Record<string, any> = initialValues) => {
    setValues(newValues);
    setState({
      isValid: true,
      isValidating: false,
      errors: {},
      touched: {},
      sanitizedValues: newValues,
      warnings: {}
    });
  }, [initialValues]);

  // Get field props for easy integration
  const getFieldProps = useCallback((fieldName: string) => {
    return {
      value: values[fieldName] || '',
      onChange: (value: any) => setFieldValue(fieldName, value),
      onBlur: () => setFieldTouched(fieldName, true),
      error: state.errors[fieldName]?.[0]?.message,
      errors: state.errors[fieldName] || [],
      touched: state.touched[fieldName] || false,
      isValid: !state.errors[fieldName] || state.errors[fieldName].length === 0
    };
  }, [values, state.errors, state.touched, setFieldValue, setFieldTouched]);

  return {
    values,
    setValues,
    setFieldValue,
    setFieldTouched,
    state,
    validate,
    reset,
    getFieldProps,
    // Convenience getters
    isValid: state.isValid,
    isValidating: state.isValidating,
    errors: state.errors,
    hasErrors: Object.keys(state.errors).some(key => state.errors[key].length > 0),
    touched: state.touched,
    sanitizedValues: state.sanitizedValues,
    warnings: state.warnings
  };
}

/**
 * Specialized hook for login form validation
 */
export function useLoginValidation(options: UseValidationOptions = {}) {
  return useFormValidation(
    { email: '', password: '' },
    ValidationSchemas.LOGIN,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      ...options
    }
  );
}

/**
 * Specialized hook for registration form validation
 */
export function useRegistrationValidation(options: UseValidationOptions = {}) {
  return useFormValidation(
    {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
      firstName: '',
      lastName: ''
    },
    ValidationSchemas.REGISTER,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      ...options
    }
  );
}

/**
 * Specialized hook for profile form validation
 */
export function useProfileValidation(initialValues: any = {}, options: UseValidationOptions = {}) {
  return useFormValidation(
    {
      firstName: '',
      lastName: '',
      phone: '',
      bio: '',
      ...initialValues
    },
    ValidationSchemas.PROFILE,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 500,
      ...options
    }
  );
}

/**
 * Hook for async validation (e.g., checking if username/email exists)
 */
export function useAsyncValidation(
  validationFn: (value: any) => Promise<ValidationResult>,
  dependencies: any[] = []
) {
  const [state, setState] = useState<{
    isValidating: boolean;
    result: ValidationResult | null;
  }>({ isValidating: false, result: null });

  const validate = useCallback(async (value: any) => {
    setState({ isValidating: true, result: null });
    
    try {
      const result = await validationFn(value);
      setState({ isValidating: false, result });
      return result;
    } catch (error) {
      await handleError(error as Error, {
        timestamp: new Date(),
        additionalData: { validationValue: value }
      });
      
      setState({ 
        isValidating: false, 
        result: { isValid: false, errors: [] }
      });
      
      return { isValid: false, errors: [] };
    }
  }, [validationFn, ...dependencies]);

  return {
    validate,
    isValidating: state.isValidating,
    result: state.result
  };
}
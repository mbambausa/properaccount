// src/lib/validation/schemas/auth.ts
import { z } from 'zod';

// Email validation with enhanced error messages and stronger validation
export const emailSchema = z
  .string({
    required_error: 'Email is required',
    invalid_type_error: 'Email must be a string',
  })
  .trim()
  .min(5, { message: 'Email must be at least 5 characters long' })
  .max(255, { message: 'Email must be less than 255 characters' })
  .email({ message: 'Please enter a valid email address' })
  .transform(val => val.toLowerCase()); // Normalize to lowercase

// Enhanced password validation with strength requirements
export const passwordSchema = z
  .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  })
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(100, { message: 'Password must be less than 100 characters' })
  .regex(/[a-z]/, { message: 'Password must include at least one lowercase letter' })
  .regex(/[A-Z]/, { message: 'Password must include at least one uppercase letter' })
  .regex(/[0-9]/, { message: 'Password must include at least one number' })
  .regex(/[^a-zA-Z0-9]/, { message: 'Password must include at least one special character' });

// Name validation
export const nameSchema = z
  .string({
    required_error: 'Name is required',
  })
  .trim()
  .min(2, { message: 'Name must be at least 2 characters' })
  .max(100, { message: 'Name must be less than 100 characters' });

// Extended user roles validation
export const userRoleSchema = z.enum(['admin', 'user', 'owner', 'manager', 'viewer'], {
  errorMap: (issue, ctx) => ({ message: 'Invalid user role selected' }),
});

// User registration schema
export const registerUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({
      required_error: 'Please confirm your password',
    }),
    name: nameSchema,
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({
    required_error: 'Password is required',
  }),
  rememberMe: z.boolean().optional().default(false),
});

// Password reset request schema
export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

// Password reset confirmation schema
export const resetPasswordConfirmSchema = z
  .object({
    token: z.string({
      required_error: 'Reset token is required',
    }),
    password: passwordSchema,
    confirmPassword: z.string({
      required_error: 'Please confirm your password',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Change password schema (when user is logged in)
export const changePasswordSchema = z
  .object({
    currentPassword: z.string({
      required_error: 'Current password is required',
    }),
    newPassword: passwordSchema,
    confirmNewPassword: z.string({
      required_error: 'Please confirm your new password',
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// Update profile schema
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  imageUrl: z.string().url({ message: 'Profile image must be a valid URL' }).optional().nullable(),
});

// Session schema with enhanced validation
export const sessionSchema = z.object({
  id: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
  userId: z.string().uuid({ message: 'User ID must be a valid UUID' }),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  data: z.record(z.unknown()).optional(),
}).refine((data) => data.expiresAt > data.createdAt, {
  message: 'Session expiry time must be after creation time',
  path: ['expiresAt'],
});

// Multi-factor authentication setup schema
export const mfaSetupSchema = z.object({
  type: z.enum(['totp', 'sms', 'email'], {
    errorMap: (issue, ctx) => ({ message: 'Invalid MFA type selected' }),
  }),
  phoneNumber: z.string().optional(), // Only required for SMS
  email: emailSchema.optional(), // Only required for email
});

// Multi-factor authentication verify schema
export const mfaVerifySchema = z.object({
  code: z.string().min(6).max(8),
  type: z.enum(['totp', 'sms', 'email']),
});

// Entity creation schema (for multi-tenancy)
export const entitySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['company', 'personal', 'trust', 'partnership']),
  parentId: z.string().uuid().optional().nullable(),
});

// User invite schema (for inviting users to entities)
export const userInviteSchema = z.object({
  email: emailSchema,
  role: userRoleSchema,
  entityId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

// Export types derived from schemas
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SessionData = z.infer<typeof sessionSchema>;
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type EntityInput = z.infer<typeof entitySchema>;
export type UserInviteInput = z.infer<typeof userInviteSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
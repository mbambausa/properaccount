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
  // FIXED: Prefix unused parameters with an underscore
  errorMap: (_issue, _ctx) => ({ message: 'Invalid user role selected' }),
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
  password: z.string({ // Not using passwordSchema here to allow simpler validation on login
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
    }).min(10, { message: 'Reset token appears to be invalid.' }), // Added min length for basic token validation
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
    }).min(1, 'Current password cannot be empty.'), // Ensure it's not empty
    newPassword: passwordSchema,
    confirmNewPassword: z.string({
      required_error: 'Please confirm your new password',
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match', // Clarified message
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

// Update profile schema
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(), // Consider if email changes need re-verification
  imageUrl: z.string().url({ message: 'Profile image must be a valid URL' }).optional().nullable(),
});

// Session schema with enhanced validation
// This likely represents the data stored *within* a session, not the session token itself.
export const sessionDataSchema = z.object({ // Renamed from sessionSchema to avoid conflict with Session type
  userId: z.string().uuid({ message: 'User ID must be a valid UUID' }),
  // createdAt and expiresAt for the session token are usually managed by the session store itself
  // and might not be part of the *data* payload within the session.
  // If they are part of the payload, ensure they are handled correctly.
  // createdAt: z.number().int().positive(),
  // expiresAt: z.number().int().positive(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  lastActivityAt: z.number().int().positive().optional(),
  currentEntityId: z.string().uuid().optional().nullable(),
  isMfaVerified: z.boolean().optional(),
  customData: z.record(z.unknown()).optional(), // Renamed from 'data' to 'customData'
});
// .refine((data) => data.expiresAt > data.createdAt, { // This refine might belong to the session token management
//   message: 'Session expiry time must be after creation time',
//   path: ['expiresAt'],
// });

// Multi-factor authentication setup schema
export const mfaSetupSchema = z.object({
  type: z.enum(['totp', 'sms', 'email'], {
    // FIXED: Prefix unused parameters with an underscore
    errorMap: (_issue, _ctx) => ({ message: 'Invalid MFA type selected' }),
  }),
  phoneNumber: z.string().optional().refine((val) => { // Conditional validation
    // `this` context in refine is tricky, safer to access through parent in superRefine if needed
    // For now, assume if type is 'sms', phoneNumber must be present. This needs to be handled
    // in a .superRefine on the object level if `type` is needed for conditional validation.
    return true; // Placeholder, actual conditional logic is more complex
  }, {message: 'Phone number is required for SMS MFA'}),
  email: emailSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'sms' && (!data.phoneNumber || data.phoneNumber.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number is required for SMS MFA.',
      path: ['phoneNumber'],
    });
  }
  if (data.type === 'email' && (!data.email || data.email.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email is required for Email MFA.',
      path: ['email'],
    });
  }
});

// Multi-factor authentication verify schema
export const mfaVerifySchema = z.object({
  code: z.string().min(6, {message: "Verification code must be at least 6 characters"})
                  .max(8, {message: "Verification code must be at most 8 characters"})
                  .regex(/^\d+$/, {message: "Verification code must be numeric"}),
  type: z.enum(['totp', 'sms', 'email']), // Should match the type used in setup
});

// Entity creation schema (simplified for auth context, e.g. first entity for new user)
// The main, more detailed entity schema should reside in 'entity.ts'.
export const authContextEntitySchema = z.object({ // Renamed from entitySchema
  name: z.string().min(2, {message: "Entity name must be at least 2 characters."})
                 .max(100, {message: "Entity name must be less than 100 characters."}),
  // Type here uses values from Tech Ref Zod entity schema (page 39)
  type: z.enum(['individual', 'company', 'trust', 'partnership'], {
    errorMap: () => ({message: "Invalid entity type selected."})
  }),
  description: z.string().max(500, {message: "Description must be less than 500 characters."}).optional(),
  // parentId might not be relevant when creating the *first* entity for a user.
  // parentId: z.string().uuid({message: "Parent ID must be a valid UUID."}).optional().nullable(),
});

// User invite schema (for inviting users to entities)
export const userInviteSchema = z.object({
  email: emailSchema,
  role: userRoleSchema, // Role to assign within the entity
  entityId: z.string().uuid({message: "Entity ID must be a valid UUID."}),
  message: z.string().max(500, {message: "Message must be less than 500 characters."}).optional(),
});

// Export types derived from schemas
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SessionPayloadData = z.infer<typeof sessionDataSchema>; // Renamed
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type AuthContextEntityInput = z.infer<typeof authContextEntitySchema>; // Renamed
export type UserInviteInput = z.infer<typeof userInviteSchema>;
export type UserRoleType = z.infer<typeof userRoleSchema>; // Renamed for clarity
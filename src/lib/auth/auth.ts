// src/lib/auth/auth.ts

import { z } from "zod";
import {
  registerUserSchema,
  loginSchema,
  // Other validation schemas as needed
} from "../validation/schemas/auth";
import type { User as AppUser, UserRole } from "@/types/auth";
import * as d1Helpers from "../cloudflare/d1";
import type { CloudflareEnv } from "../../env";
import {
  hashPassword as argon2Hash,
  verifyPassword as argon2Verify,
} from "../../utils/passwordUtils";

// DB user record type matching your schema
interface DbUserRecord {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  role: string;
  created_at: number;
  updated_at: number;
  verified_at: number | null;
  image_url: string | null;
}

// Token generator utility
export function generateToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password);
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  return argon2Verify(storedHash, password);
}

// Register a new user. No session logic. Returns user if successful.
export async function registerUser(
  env: CloudflareEnv,
  userData: unknown
): Promise<{
  success: boolean;
  user?: AppUser;
  error?: string;
  errors?: z.ZodIssue[];
}> {
  const validationResult = registerUserSchema.safeParse(userData);
  if (!validationResult.success) {
    return {
      success: false,
      error: "Validation failed",
      errors: validationResult.error.errors,
    };
  }
  const validatedData = validationResult.data;
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found.");

  // Check for existing user
  const existingUser = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(validatedData.email.toLowerCase())
    .first<{ id: string }>();
  if (existingUser) {
    return { success: false, error: "UserAlreadyExists" };
  }

  const passwordHash = await hashPassword(validatedData.password);
  const userId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const fullUserToInsert: DbUserRecord = {
    id: userId,
    email: validatedData.email.toLowerCase(),
    name: validatedData.name,
    password_hash: passwordHash,
    role: "user",
    created_at: now,
    updated_at: now,
    verified_at: null,
    image_url: null,
  };
  await d1Helpers.insert(db, "users", fullUserToInsert);

  // Insert a verification token (implementation as needed)
  const verificationTokenValue = generateToken();
  await d1Helpers.insert(db, "verification_tokens", {
    identifier: validatedData.email.toLowerCase(),
    token: verificationTokenValue,
    expires_at: now + 24 * 60 * 60, // 24 hours
    created_at: now,
    type: "EMAIL_VERIFICATION",
  });
  console.log(
    `TODO: Send verification email to ${validatedData.email} with token: ${verificationTokenValue}`
  );

  const registeredUser: AppUser = {
    id: userId,
    email: fullUserToInsert.email,
    name: fullUserToInsert.name ?? undefined,
    role: fullUserToInsert.role as UserRole,
    createdAt: fullUserToInsert.created_at,
    updatedAt: fullUserToInsert.updated_at,
    emailVerifiedAt: null,
    imageUrl: null,
  };
  return { success: true, user: registeredUser };
}

// Login an existing user. No session logic. Returns user if successful.
export async function loginUser(
  env: CloudflareEnv,
  loginData: unknown
): Promise<{
  success: boolean;
  user?: AppUser;
  error?: string;
  errors?: z.ZodIssue[];
}> {
  const validationResult = loginSchema.safeParse(loginData);
  if (!validationResult.success) {
    return {
      success: false,
      error: "Validation failed",
      errors: validationResult.error.errors,
    };
  }
  const validatedData = validationResult.data;
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found.");

  const userRecord = await db
    .prepare(
      "SELECT id, email, name, password_hash, role, created_at, updated_at, verified_at, image_url FROM users WHERE email = ?"
    )
    .bind(validatedData.email.toLowerCase())
    .first<DbUserRecord>();
  if (!userRecord || !userRecord.password_hash) {
    return { success: false, error: "CredentialsSignin" };
  }

  const passwordMatches = await verifyPassword(
    validatedData.password,
    userRecord.password_hash
  );
  if (!passwordMatches) {
    return { success: false, error: "CredentialsSignin" };
  }

  const userToReturn: AppUser = {
    id: userRecord.id,
    email: userRecord.email,
    name: userRecord.name ?? undefined,
    role: userRecord.role as UserRole,
    createdAt: userRecord.created_at,
    updatedAt: userRecord.updated_at,
    emailVerifiedAt: userRecord.verified_at ?? undefined,
    imageUrl: userRecord.image_url ?? undefined,
  };

  // Log successful login attempt
  try {
    await d1Helpers.insert(db, "activity_logs", {
      user_id: userRecord.id,
      action: "login_success_credentials",
      created_at: Math.floor(Date.now() / 1000),
    });
  } catch (logError) {
    console.error("Failed to log login activity:", logError);
  }

  return { success: true, user: userToReturn };
}

// All other utility/auth functions (e.g., password reset) remain unchanged, and do not include session logic.

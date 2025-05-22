// src/lib/passwordUtils.ts
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

/**
 * Hashes a plaintext password using Argon2.
 * The salt and parameters are automatically handled by the Argon2 library
 * and are included in the output hash string.
 *
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the Argon2 hash string.
 * @throws Throws an error if hashing fails.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    console.error("hashPassword: Password cannot be empty.");
    throw new Error("Password cannot be empty.");
  }
  try {
    const hashedPassword = await argon2Hash(password);
    return hashedPassword;
  } catch (error: unknown) {
    console.error("Error hashing password with Argon2:", error);
    if (error instanceof Error) {
      throw new Error(`Password hashing failed due to an internal error: ${error.message}`);
    }
    throw new Error("Password hashing failed due to an unexpected internal error.");
  }
}

/**
 * Verifies a plaintext password against a stored Argon2 hash.
 *
 * @param storedHash The Argon2 hash string retrieved from the database.
 * @param password The plaintext password to verify.
 * @returns A promise that resolves to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash || !password) {
    console.warn("verifyPassword called with empty storedHash or password. Verification will fail.");
    return false;
  }
  try {
    await argon2Verify(storedHash, password);
    return true; // If argon2Verify does not throw, the password is valid.
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("ERR_ARGON2_VERIFY_MISMATCH")) {
        console.info("Password verification failed: Mismatch.");
    } else {
        console.warn("Password verification failed (could be invalid hash, parameters, or operational error):", error instanceof Error ? error.message : error);
    }
    return false; 
  }
}
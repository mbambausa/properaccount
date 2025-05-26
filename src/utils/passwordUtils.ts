// src/utils/passwordUtils.ts
import { hash as argon2Hash, verify as argon2Verify, needsRehash as argon2NeedsRehash } from "@node-rs/argon2";

/**
 * Options for Argon2 hashing. These are sensible defaults.
 * - `memoryCost` (KiB): Amount of memory to use.
 * - `timeCost` (iterations): Number of iterations.
 * - `parallelism` (threads): Number of threads to use.
 * Consult OWASP recommendations for current best practices on these parameters.
 */
const ARGON2_HASH_OPTIONS = {
  // Consider making these configurable via environment variables for different security postures if needed.
  // Default values provided by @node-rs/argon2 are generally good starting points.
  // memoryCost: 65536, // example: 64MB
  // timeCost: 3,       // example: 3 iterations
  // parallelism: 4,    // example: 4 threads
};

/**
 * Hashes a plaintext password using Argon2.
 * This function is intended for server-side use (e.g., in Cloudflare Workers).
 * The salt and parameters are automatically handled by the Argon2 library
 * and are included in the output hash string.
 *
 * @param password The plaintext password to hash. Must not be empty.
 * @returns A promise that resolves to the Argon2 hash string.
 * @throws Throws an Error if hashing fails or if the password is empty.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.trim() === '') {
    const errorMessage = "Password cannot be empty or just whitespace.";
    console.error("hashPassword Error:", errorMessage);
    throw new Error(errorMessage);
  }
  try {
    // Pass options explicitly if you want to override library defaults
    const hashedPassword = await argon2Hash(password, ARGON2_HASH_OPTIONS);
    return hashedPassword;
  } catch (error: unknown) {
    console.error("Error hashing password with Argon2:", error);
    const message = error instanceof Error ? error.message : "Unknown hashing error";
    // Avoid leaking internal error details to less trusted contexts if this function were ever exposed more directly.
    throw new Error(`Password hashing failed due to an internal error.`);
  }
}

/**
 * Verifies a plaintext password against a stored Argon2 hash.
 * This function is intended for server-side use.
 *
 * @param storedHash The Argon2 hash string retrieved from the database.
 * @param password The plaintext password provided by the user for verification.
 * @returns A promise that resolves to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash || !password) {
    console.warn("verifyPassword called with empty storedHash or password. Verification will inherently fail.");
    return false;
  }
  try {
    // argon2Verify will return true if valid, or throw an error if there's a mismatch or other issue.
    // The @node-rs/argon2 library's verify function itself might return a boolean or throw.
    // Let's check its expected behavior: it throws on mismatch.
    await argon2Verify(storedHash, password);
    return true; // If argon2Verify does not throw, the password is valid.
  } catch (error: unknown) {
    // The @node-rs/argon2 library throws an error for mismatches.
    // Specific error messages or types might indicate a mismatch vs. an operational error.
    // Example: error.message often includes "ERR_ARGON2_VERIFY_MISMATCH"
    if (error instanceof Error && error.message.includes("ERR_ARGON2_VERIFY_MISMATCH")) {
        // This is an expected failure (password incorrect), not necessarily a system error.
        console.info("Password verification failed: Mismatch.");
    } else if (error instanceof Error && error.message.includes("ERR_ARGON2_SALT_INVALID")) {
        console.warn("Password verification failed: Invalid salt in stored hash.", error);
    } else {
        // Log other unexpected errors during verification more prominently.
        console.warn("Password verification failed due to an unexpected issue (e.g., invalid hash format, parameters, or operational error):", error instanceof Error ? error.message : error);
    }
    return false; // Password does not match or an error occurred.
  }
}

/**
 * Checks if a stored hash needs to be rehashed due to updated Argon2 parameters.
 * This is useful if you increase hashing strength (e.g., memoryCost, timeCost) over time.
 * This function is intended for server-side use.
 *
 * @param storedHash The Argon2 hash string to check.
 * @returns A promise that resolves to true if the hash should be updated, false otherwise.
 */
export async function needsRehash(storedHash: string): Promise<boolean> {
  if (!storedHash) {
    return false; // Cannot rehash an empty hash
  }
  try {
    // Pass the current desired options to needsRehash.
    // If the storedHash was created with weaker parameters, this will return true.
    return argon2NeedsRehash(storedHash, ARGON2_HASH_OPTIONS);
  } catch (error) {
    console.warn("Error checking if password needs rehash (possibly invalid hash format):", error);
    // If the hash is invalid, it might be prudent to treat it as needing a rehash
    // upon next successful login, or handle as an error case.
    // For now, returning false as we can't determine rehash status from an invalid hash.
    return false;
  }
}
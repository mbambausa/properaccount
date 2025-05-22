// tests/unit/validation.spec.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Example 1: Basic Zod schema validation
describe('Basic Zod Schema Validation', () => {
  const NameSchema = z.string().min(1, "Name cannot be empty").max(100, "Name too long");
  const EmailSchema = z.string().email("Invalid email format");
  const AgeSchema = z.number().int().positive("Age must be a positive integer").min(18, "Must be 18 or older");

  const UserSchema = z.object({
    name: NameSchema,
    email: EmailSchema,
    age: AgeSchema.optional(),
  });

  it('should validate a correct user object', () => {
    const validUser = { name: 'John Doe', email: 'john.doe@example.com', age: 30 };
    const result = UserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validUser);
    }
  });

  it('should invalidate an object with an empty name', () => {
    const invalidUser = { name: '', email: 'jane.doe@example.com' };
    const result = UserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Example of checking specific error messages
      expect(result.error.errors.some(e => e.path.includes('name') && e.message === "Name cannot be empty")).toBe(true);
    }
  });

  it('should invalidate an object with an invalid email', () => {
    const invalidUser = { name: 'Jane Doe', email: 'not-an-email' };
    const result = UserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(e => e.path.includes('email') && e.message === "Invalid email format")).toBe(true);
    }
  });

  it('should invalidate an object with an age below minimum', () => {
    const invalidUser = { name: 'Kid', email: 'kid@example.com', age: 17 };
    const result = UserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(e => e.path.includes('age') && e.message === "Must be 18 or older")).toBe(true);
    }
  });

  it('should allow an optional age to be undefined', () => {
    const validUserNoAge = { name: 'Ageless Wonder', email: 'ageless@example.com' };
    const result = UserSchema.safeParse(validUserNoAge);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBeUndefined();
    }
  });
});

// Example 2: Custom validation function tests
describe('Custom Validation Functions', () => {
  /**
   * Checks if a string is a valid US ZIP code (5 digits or 5+4 digits).
   * @param {string} zipCode
   * @returns {boolean}
   */
  function isValidUSZipCode(zipCode: string): boolean {
    if (!zipCode) return false;
    return /^\d{5}(-\d{4})?$/.test(zipCode);
  }

  it('should validate correct US ZIP codes', () => {
    expect(isValidUSZipCode('12345')).toBe(true);
    expect(isValidUSZipCode('90210-1234')).toBe(true);
  });

  it('should invalidate incorrect US ZIP codes', () => {
    expect(isValidUSZipCode('1234')).toBe(false);        // Too short
    expect(isValidUSZipCode('123456')).toBe(false);       // Too long
    expect(isValidUSZipCode('12345-678')).toBe(false);    // Invalid extension
    expect(isValidUSZipCode('abcde')).toBe(false);        // Non-numeric
    expect(isValidUSZipCode('12345-')).toBe(false);       // Incomplete extension
  });
});

// Example 3: Testing validation for financial amounts
describe('Financial Amount Validation', () => {
    // Schema for a transaction amount (e.g., in cents, positive integer)
    const AmountSchema = z.number()
        .int({ message: "Amount must be an integer (cents)." })
        .positive({ message: "Amount must be positive." })
        .max(1_000_000_000, { message: "Amount exceeds maximum limit." }); // Max $10M in cents

    it('should validate valid transaction amounts (cents)', () => {
        expect(AmountSchema.safeParse(100).success).toBe(true); // $1.00
        expect(AmountSchema.safeParse(500000).success).toBe(true); // $5,000.00
    });

    it('should invalidate zero or negative amounts', () => {
        const zeroResult = AmountSchema.safeParse(0);
        expect(zeroResult.success).toBe(false);
        if(!zeroResult.success) expect(zeroResult.error.errors[0].message).toBe("Amount must be positive.");

        const negativeResult = AmountSchema.safeParse(-100);
        expect(negativeResult.success).toBe(false);
        if(!negativeResult.success) expect(negativeResult.error.errors[0].message).toBe("Amount must be positive.");
    });

    it('should invalidate non-integer amounts', () => {
        const decimalResult = AmountSchema.safeParse(100.50);
        expect(decimalResult.success).toBe(false);
        if(!decimalResult.success) expect(decimalResult.error.errors[0].message).toBe("Amount must be an integer (cents).");
    });

     it('should invalidate amounts exceeding the maximum limit', () => {
        const largeAmountResult = AmountSchema.safeParse(2_000_000_000); // $20M
        expect(largeAmountResult.success).toBe(false);
        if(!largeAmountResult.success) expect(largeAmountResult.error.errors[0].message).toBe("Amount exceeds maximum limit.");
    });
});

// Placeholder for testing schemas from your application, e.g.,
// import { entityInputSchema } from '../../src/lib/validation/schemas/entity';
// describe('EntityInputSchema', () => {
//   it('should validate a correct entity input', () => { /* ... */ });
//   it('should require a name for an entity', () => { /* ... */ });
// });

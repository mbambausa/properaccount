// src/lib/accounting/account.ts

// This import should now correctly resolve to the type from your cloudflare/d1/schema.ts
import type { AccountSystemType as AccountD1SchemaType } from "@db/schema";
import type { ExpenseSubtype as TypeExpenseSubtype } from "../../types/accounting";
import { MojoDecimal, newMojoDecimal } from "./financial"; // Assumes financial.ts has the MojoDecimal class

export interface AccountDefinition {
  id: string;
  code: string;
  name: string;
  type: AccountD1SchemaType; // This will be 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  subtype?: TypeExpenseSubtype | string | null;
  description?: string | null;
  isActive: boolean;
  parentAccountId?: string | null;
  normalBalance?: "debit" | "credit";
  isControlAccount?: boolean;
  isRecoverable?: boolean;
}

export class Account {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public readonly type: AccountD1SchemaType;
  public subtype?: TypeExpenseSubtype | string | null;
  public description?: string | null;
  public isActive: boolean;
  public readonly parentAccountId?: string | null;
  public readonly normalBalance: "debit" | "credit";
  public readonly isControlAccount: boolean;
  public readonly isRecoverable: boolean;

  private _balance: MojoDecimal;

  constructor(definition: AccountDefinition) {
    this.id = definition.id;
    this.code = definition.code;
    this.name = definition.name;
    this.type = definition.type;
    this.subtype = definition.subtype;
    this.description = definition.description;
    this.isActive = definition.isActive;
    this.parentAccountId = definition.parentAccountId || null;

    if (definition.normalBalance) {
      this.normalBalance = definition.normalBalance;
    } else {
      // Aligning with the AccountD1SchemaType from your cloudflare/d1/schema.ts
      switch (definition.type) {
        case "asset":
        case "expense":
          this.normalBalance = "debit";
          break;
        case "liability":
        case "equity":
        case "income": // FIXED: Aligned with the provided d1/schema.ts which uses "income"
          this.normalBalance = "credit";
          break;
        default:
          // This exhaustive check helps catch if AccountD1SchemaType changes
          // and a case is missed here. If all cases are handled, `unhandledType` is 'never'.
          const unhandledType: never = definition.type;
          console.warn(
            `Account ${definition.code} (${definition.name}) has an unhandled type '${unhandledType}' and no explicit normalBalance. Defaulting to debit.`
          );
          this.normalBalance = "debit";
      }
    }

    this.isControlAccount = definition.isControlAccount ?? false;
    this.isRecoverable = definition.isRecoverable ?? false;
    this._balance = newMojoDecimal(0);
  }

  get balance(): string {
    return this._balance.toString();
  }

  get balanceMojoDecimal(): MojoDecimal {
    return this._balance;
  }

  public setBalance(newBalance: string | number | MojoDecimal): void {
    this._balance = newMojoDecimal(newBalance);
  }

  public isDebitNormal(): boolean {
    return this.normalBalance === "debit";
  }

  public isCreditNormal(): boolean {
    return this.normalBalance === "credit";
  }

  public applyTransaction(amount: string | number | MojoDecimal, isDebit: boolean): void {
    if (!this.isActive) {
      throw new Error(
        `Account [${this.code}] "${this.name}" is not active. Cannot apply transaction.`
      );
    }

    let decimalAmount = newMojoDecimal(amount);

    // Check if amount is negative using isPositive() and isZero()
    // from the provided MojoDecimal adapter (financial.ts)
    const isAmountNegative = !decimalAmount.isPositive() && !decimalAmount.isZero();

    if (isAmountNegative) {
      throw new Error(
        `Transaction amount for account ${this.code} must be positive. Received: ${amount}. Direction is specified by isDebit.`
      );
    }

    if (this.isDebitNormal()) {
      this._balance = isDebit
        ? this._balance.plus(decimalAmount)
        : this._balance.minus(decimalAmount);
    } else {
      this._balance = isDebit
        ? this._balance.minus(decimalAmount)
        : this._balance.plus(decimalAmount);
    }
  }

  public resetBalance(): void {
    this._balance = newMojoDecimal(0);
  }

  public toObject(): Readonly<AccountDefinition & { balance: string, normalBalance: "debit" | "credit" }> {
    return Object.freeze({
      id: this.id,
      code: this.code,
      name: this.name,
      type: this.type,
      subtype: this.subtype,
      description: this.description,
      isActive: this.isActive,
      parentAccountId: this.parentAccountId,
      normalBalance: this.normalBalance,
      isControlAccount: this.isControlAccount,
      isRecoverable: this.isRecoverable,
      balance: this.balance,
    });
  }
}
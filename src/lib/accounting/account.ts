// src/lib/accounting/account.ts

import type { AccountSystemType as AccountTypeFromSchema } from '@db/schema';
import type { ExpenseSubtype as TypeExpenseSubtype } from '../../types/account';
import { MojoDecimal, newMojoDecimal } from './financial';

export interface AccountDefinition {
  id: string;
  code: string;
  name: string;
  type: AccountTypeFromSchema;
  subtype?: TypeExpenseSubtype | string | null;
  description?: string | null;
  isActive: boolean;
  parentAccountId?: string | null;
  normalBalance: 'debit' | 'credit';
  isControlAccount?: boolean;
  isRecoverable?: boolean;
}

export class Account {
  public readonly id: string;
  public readonly code: string;
  public name: string;
  public readonly type: AccountTypeFromSchema;
  public subtype?: TypeExpenseSubtype | string | null;
  public description?: string | null;
  public isActive: boolean;
  public readonly parentAccountId?: string | null;
  public readonly normalBalance: 'debit' | 'credit';
  public readonly isControlAccount?: boolean;
  public readonly isRecoverable?: boolean;

  private _balance: MojoDecimal;

  constructor(definition: AccountDefinition) {
    this.id = definition.id;
    this.code = definition.code;
    this.name = definition.name;
    this.type = definition.type;
    this.subtype = definition.subtype;
    this.description = definition.description;
    this.isActive = definition.isActive;
    this.parentAccountId = definition.parentAccountId;

    if (definition.normalBalance) {
        this.normalBalance = definition.normalBalance;
    } else {
      switch (definition.type.toLowerCase() as AccountTypeFromSchema) {
        case 'asset':
        case 'expense':
          this.normalBalance = 'debit';
          break;
        case 'liability':
        case 'equity':
        case 'income':
          this.normalBalance = 'credit';
          break;
        default:
          console.warn(`Account ${definition.code} (${definition.name}) has unknown type '${definition.type}' and no explicit normalBalance. Defaulting to debit.`);
          this.normalBalance = 'debit';
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

  setBalance(newBalance: string | number): void {
    this._balance = newMojoDecimal(newBalance);
  }

  isDebitNormal(): boolean {
    return this.normalBalance === 'debit';
  }

  isCreditNormal(): boolean {
    return this.normalBalance === 'credit';
  }

  applyTransaction(amount: string | number, isDebit: boolean): void {
    if (!this.isActive) {
      throw new Error(`Account [${this.code}] "${this.name}" is not active. Cannot apply transaction.`);
    }

    let decimalAmount: MojoDecimal = newMojoDecimal(amount);
    if (decimalAmount.isPositive() === false && !decimalAmount.isZero()) {
        console.warn(`Transaction amount for account ${this.code} was negative (${amount}). Using absolute value.`);
        decimalAmount = decimalAmount.abs();
    }

    if (this.isDebitNormal()) {
      this._balance = isDebit ? this._balance.plus(decimalAmount) : this._balance.minus(decimalAmount);
    } else {
      this._balance = isDebit ? this._balance.minus(decimalAmount) : this._balance.plus(decimalAmount);
    }
  }

  resetBalance(): void {
    this._balance = newMojoDecimal(0);
  }
}
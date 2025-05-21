// src/lib/rules/ruleDefinitions.ts
import type { Rule, RuleCondition, RuleAction } from './engine';
import type { AccountMappingService, AccountMappingConfig } from '../../accounting/accountMapping';

/**
 * Valid keys for account mapping, derived from config shape
 */
type AccountKey = keyof AccountMappingConfig;

/**
 * Template for a default rule, with logical accountKey placeholder
 */
interface DefaultRuleTemplate extends Omit<Rule, 'action'> {
  action: Omit<RuleAction, 'accountId'> & { accountKey: AccountKey };
}

/**
 * Default rule definitions with logical account keys.
 * These keys get resolved via AccountMappingService at runtime.
 */
const defaultRuleTemplates: DefaultRuleTemplate[] = [
  {
    id: 'std-bank-fee-service',
    name: 'Bank Service Fee',
    description: 'Automatically categorize general bank service fees based on description.',
    isActive: true,
    priority: 100,
    conditions: [
      { field: 'description', operator: 'contains', value: 'SERVICE FEE', caseSensitive: false }
    ],
    action: {
      accountKey: 'bankFees',
      isDebit: true,
      description: 'Bank Service Fee'
    }
  },
  // Add additional default templates here...
];

/**
 * Resolve and validate default rules against the account mapping.
 */
export function getDefaultRules(accountMapping: AccountMappingService): Rule[] {
  const instantiated = defaultRuleTemplates.map(template => {
    const mappedId =
      accountMapping.getCategoryAccountId(template.action.accountKey) ??
      `unknown-account-for-${template.action.accountKey}`;

    return {
      ...template,
      action: {
        accountId: mappedId,
        isDebit: template.action.isDebit,
        description: template.action.description
      }
    } as Rule;
  });

  return instantiated.filter(rule => {
    const valid = accountMapping.accountExists(rule.action.accountId);
    if (!valid) {
      console.warn(
        `Rule "${rule.name}" (${rule.id}) has invalid accountId: ${rule.action.accountId}. Skipping.`
      );
    }
    return valid;
  });
}

/**
 * Input shape for dynamic custom rule creation
 */
export type CustomRuleConditionInput = {
  field: string;
  operator: RuleCondition['operator'];
  value?: any;
  caseSensitive?: boolean;
};

/**
 * Create a custom rule at runtime, with full typing
 */
export function createCustomRule(
  name: string,
  description: string,
  conditions: CustomRuleConditionInput[],
  accountId: string,
  isDebit: boolean,
  entityId?: string,
  priority: number = 50
): Rule {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    isActive: true,
    priority,
    entityId,
    conditions: conditions.map(c => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
      caseSensitive: c.caseSensitive ?? false
    })),
    action: {
      accountId,
      isDebit,
      description: name
    }
  };
}

// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import type { AccountSystemType } from '@db/schema';

// Define schemas for content collections
export const collections = {
  // Chart of Accounts templates
  'coa-templates': defineCollection({
    type: 'data', // JSON/YAML data collection
    schema: z.object({
      title: z.string(),
      description: z.string(),
      industry: z.string().optional(),
      version: z.string().optional(),
      accounts: z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
          subtype: z.string().optional(),
          isRecoverable: z.boolean().optional(),
          parentCode: z.string().nullable().optional(),
          isControlAccount: z.boolean().optional(),
          normalBalance: z.enum(['debit', 'credit']),
          description: z.string().nullable().optional(),
        })
      ),
    }),
  }),
  
  // Documentation pages
  'documentation': defineCollection({
    type: 'content', // Markdown/MDX content
    schema: z.object({
      title: z.string(),
      description: z.string(),
      category: z.enum(['getting-started', 'accounts', 'transactions', 'reports', 'entities', 'settings']),
      order: z.number().int().positive(),
      tags: z.array(z.string()).optional(),
      updated: z.date().optional(),
    }),
  }),
  
  // Transaction templates for common journal entries
  'transaction-templates': defineCollection({
    type: 'data',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      category: z.string().optional(),
      lines: z.array(
        z.object({
          accountCode: z.string(),
          isDebit: z.boolean(),
          description: z.string().optional(),
          amountPercentage: z.number().optional(), // For proportional amounts
        })
      ),
    }),
  }),
  
  // Report templates
  'report-templates': defineCollection({
    type: 'data',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['balance-sheet', 'income-statement', 'cash-flow', 'tax-summary']),
      sections: z.array(
        z.object({
          title: z.string(),
          accountCodes: z.array(z.string()),
          calculation: z.enum(['sum', 'subtotal', 'total']).optional(),
        })
      ),
    }),
  }),
};
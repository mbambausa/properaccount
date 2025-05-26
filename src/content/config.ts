// src/content/config.ts
import { defineCollection, z } from 'astro:content';

// Documentation collection
const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().optional(),
  }),
});

// Chart of Accounts templates
const coaTemplates = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    accounts: z.array(z.object({
      code: z.string(),
      name: z.string(),
      type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
      subtype: z.string().optional(),
      parent: z.string().optional(),
    })),
  }),
});

// Transaction templates
const transactionTemplates = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    lines: z.array(z.object({
      accountCode: z.string(),
      description: z.string(),
      isDebit: z.boolean(),
    })),
  }),
});

// Report templates
const reportTemplates = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.string(),
    configuration: z.record(z.any()),
  }),
});

export const collections = {
  docs,
  'coa-templates': coaTemplates,
  'transaction-templates': transactionTemplates,
  'report-templates': reportTemplates,
};
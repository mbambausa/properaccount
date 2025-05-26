// src/pages/api/transactions/index.js
import { z } from 'zod';
import { AppError, ErrorCode } from '../../../utils/errors.js';
import { Transaction } from '../../../lib/accounting/transaction.js';
import { createTransactionService } from '../../../lib/services/transaction-service.js';

// Input validation schema for creating transactions
const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().min(3, "Description must be at least 3 characters"),
  entityId: z.string().uuid("Entity ID must be a valid UUID"),
  reference: z.string().optional(),
  journalId: z.string().uuid("Journal ID must be a valid UUID").optional(),
  status: z.enum(['draft', 'posted']).optional().default('draft'),
  lines: z.array(z.object({
    accountId: z.string().uuid("Account ID must be a valid UUID"),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places"),
    isDebit: z.boolean(),
    memo: z.string().optional(),
  })).min(2, "Transaction must have at least 2 lines"),
});

export const onRequest = async ({ request, locals }) => {
  const user = locals.user;
  const env = locals.runtime.env;
  
  // Check if user is authenticated
  if (!user || !user.id) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication required',
    }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const transactionService = createTransactionService(env.DATABASE);

  // GET - Fetch transactions with optional filtering
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const entityId = url.searchParams.get('entityId');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '25');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const status = url.searchParams.get('status');
      const accountId = url.searchParams.get('accountId');
      
      // Entity ID is required for security - prevents accessing transactions from other entities
      if (!entityId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Entity ID is required',
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Check if user has access to this entity
      const hasAccess = await transactionService.hasEntityAccess(entityId, user.id);
      if (!hasAccess) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied to this entity',
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      // Build filter criteria from query parameters
      const filters = {
        entityId,
        userId: user.id,
        page,
        limit,
        status: status || undefined,
        accountId: accountId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const { transactions, total, totalPages } = await transactionService.getTransactions(filters);
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          }
        }
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred while fetching transactions';
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
      }), { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
  
  // POST - Create a new transaction
  else if (request.method === 'POST') {
    try {
      const data = await request.json();
      
      // Validate input data
      const validationResult = createTransactionSchema.safeParse(data);
      if (!validationResult.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Validation failed',
          errors: validationResult.error.errors,
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      const transactionData = validationResult.data;
      
      // Check if user has access to this entity
      const hasAccess = await transactionService.hasEntityAccess(transactionData.entityId, user.id);
      if (!hasAccess) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Access denied to this entity',
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Verify all accounts in the transaction belong to the specified entity
      const lineAccountIds = transactionData.lines.map(line => line.accountId);
      const validAccounts = await transactionService.validateEntityAccounts(
        transactionData.entityId, 
        lineAccountIds, 
        user.id
      );
      
      if (!validAccounts.success) {
        return new Response(JSON.stringify({
          success: false,
          error: validAccounts.error || 'Invalid accounts in transaction',
          invalidAccounts: validAccounts.invalidAccounts,
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Create transaction object for validation
      const transactionId = crypto.randomUUID();
      const txDate = new Date(transactionData.date);
      
      // Prepare transaction for validation
      const transaction = new Transaction({
        id: transactionId,
        date: txDate,
        description: transactionData.description,
        entityId: transactionData.entityId,
        lines: transactionData.lines.map(line => ({
          id: crypto.randomUUID(),
          accountId: line.accountId,
          amount: line.amount,
          isDebit: line.isDebit,
          description: line.memo
        })),
        status: transactionData.status,
        reference: transactionData.reference,
      });
      
      // Verify transaction is balanced
      if (!transaction.isBalanced()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Transaction is not balanced. Total debits must equal total credits.',
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Save the transaction
      const result = await transactionService.createTransaction(transaction, user.id);
      
      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: `Transaction created successfully ${result.status === 'posted' ? 'and posted to the ledger' : ''}`,
      }), { 
        status: 201,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred while creating the transaction';
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
      }), { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
  
  // Method not allowed
  else {
    return new Response(JSON.stringify({
      success: false,
      error: `Method ${request.method} not allowed`,
    }), { 
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Allow': 'GET, POST'  
      } 
    });
  }
};
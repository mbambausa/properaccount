// src/pages/api/transactions/[id].js
import { z } from 'zod';
import { AppError, ErrorCode } from '../../../utils/errors.js';
import { Transaction } from '../../../lib/accounting/transaction.js';
import { createTransactionService } from '../../../lib/services/transaction-service.js';

// Validation schema for updating transaction metadata (not lines)
const updateTransactionMetadataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  description: z.string().min(3, "Description must be at least 3 characters").optional(),
  reference: z.string().optional().nullable(),
  journalId: z.string().uuid("Journal ID must be a valid UUID").optional().nullable(),
});

// Validation schema for transaction lines updates
const updateTransactionLinesSchema = z.object({
  lines: z.array(z.object({
    id: z.string().uuid("Line ID must be a valid UUID").optional(),
    accountId: z.string().uuid("Account ID must be a valid UUID"),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places"),
    isDebit: z.boolean(),
    memo: z.string().optional().nullable(),
  })).min(2, "Transaction must have at least 2 lines"),
});

// Validation schema for action-based operations
const transactionActionSchema = z.object({
  action: z.enum(['post', 'void']),
});

export const onRequest = async ({ params, request, locals }) => {
  const user = locals.user;
  const env = locals.runtime.env;
  const transactionId = params.id;
  
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

  if (!transactionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Transaction ID is required',
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  const transactionService = createTransactionService(env.DATABASE);

  // GET - Fetch a specific transaction by ID
  if (request.method === 'GET') {
    try {
      const transaction = await transactionService.getTransactionById(transactionId, user.id);
      
      if (!transaction) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Transaction not found or access denied',
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: transaction,
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error fetching transaction:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred while fetching the transaction';
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
      }), { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
  
  // PUT - Update a transaction (metadata and/or lines)
  else if (request.method === 'PUT') {
    try {
      // Get the existing transaction
      const existingTransaction = await transactionService.getTransactionById(transactionId, user.id);
      
      if (!existingTransaction) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Transaction not found or access denied',
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Check if transaction is in draft status - only drafts can be updated
      if (existingTransaction.status !== 'draft') {
        return new Response(JSON.stringify({
          success: false,
          error: `Cannot update a transaction with status "${existingTransaction.status}". Only draft transactions can be modified.`,
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      const data = await request.json();
      
      // Validate input data - metadata and lines are validated separately
      let validatedMetadata = {};
      let validatedLines = null;
      let metadataValidationError = null;
      let linesValidationError = null;
      
      // Validate metadata if present
      if (data.date || data.description || data.reference !== undefined || data.journalId !== undefined) {
        const metadataResult = updateTransactionMetadataSchema.safeParse(data);
        if (metadataResult.success) {
          validatedMetadata = metadataResult.data;
        } else {
          metadataValidationError = metadataResult.error;
        }
      }
      
      // Validate lines if present
      if (data.lines) {
        const linesResult = updateTransactionLinesSchema.safeParse({ lines: data.lines });
        if (linesResult.success) {
          validatedLines = linesResult.data.lines;
        } else {
          linesValidationError = linesResult.error;
        }
      }
      
      // Return validation errors if any
      if (metadataValidationError || linesValidationError) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Validation failed',
          errors: {
            metadata: metadataValidationError ? metadataValidationError.errors : undefined,
            lines: linesValidationError ? linesValidationError.errors : undefined,
          },
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // When lines are updated, verify all accounts belong to the entity
      if (validatedLines) {
        const lineAccountIds = validatedLines.map(line => line.accountId);
        const validAccounts = await transactionService.validateEntityAccounts(
          existingTransaction.entityId, 
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
        
        // Rebuild the transaction object to validate balance
        const updatedTransaction = new Transaction({
          id: existingTransaction.id,
          date: validatedMetadata.date ? new Date(validatedMetadata.date) : existingTransaction.date,
          description: validatedMetadata.description || existingTransaction.description,
          entityId: existingTransaction.entityId,
          lines: validatedLines.map(line => ({
            id: line.id || crypto.randomUUID(),
            accountId: line.accountId,
            amount: line.amount,
            isDebit: line.isDebit,
            description: line.memo,
          })),
          status: 'draft',
          reference: validatedMetadata.reference !== undefined ? validatedMetadata.reference : existingTransaction.reference,
        });
        
        if (!updatedTransaction.isBalanced()) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Transaction is not balanced. Total debits must equal total credits.',
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' } 
          });
        }
      }
      
      // Update the transaction
      const updatedTransaction = await transactionService.updateTransaction(
        transactionId,
        {
          ...validatedMetadata,
          lines: validatedLines,
        },
        user.id
      );
      
      return new Response(JSON.stringify({
        success: true,
        data: updatedTransaction,
        message: 'Transaction updated successfully',
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred while updating the transaction';
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
      }), { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
  
  // PATCH - Special operations like posting or voiding
  else if (request.method === 'PATCH') {
    try {
      const data = await request.json();
      
      // Validate action
      const validationResult = transactionActionSchema.safeParse(data);
      if (!validationResult.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action',
          errors: validationResult.error.errors,
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      const { action } = validationResult.data;
      
      // Get the existing transaction
      const existingTransaction = await transactionService.getTransactionById(transactionId, user.id);
      
      if (!existingTransaction) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Transaction not found or access denied',
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      let result;
      
      if (action === 'post') {
        // Only drafts can be posted
        if (existingTransaction.status !== 'draft') {
          return new Response(JSON.stringify({
            success: false,
            error: `Cannot post a transaction with status "${existingTransaction.status}". Only draft transactions can be posted.`,
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' } 
          });
        }
        
        result = await transactionService.postTransaction(transactionId, user.id);
      } else if (action === 'void') {
        // Only posted transactions can be voided
        if (existingTransaction.status !== 'posted') {
          return new Response(JSON.stringify({
            success: false,
            error: `Cannot void a transaction with status "${existingTransaction.status}". Only posted transactions can be voided.`,
          }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' } 
          });
        }
        
        result = await transactionService.voidTransaction(transactionId, user.id);
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: result,
        message: `Transaction ${action === 'post' ? 'posted' : 'voided'} successfully`,
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error(`Error ${error.action} transaction:`, error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : `An unexpected error occurred while processing the transaction action`;
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage,
      }), { 
        status: statusCode,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
  
  // DELETE - Delete a transaction (only drafts can be deleted)
  else if (request.method === 'DELETE') {
    try {
      // Get the existing transaction
      const existingTransaction = await transactionService.getTransactionById(transactionId, user.id);
      
      if (!existingTransaction) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Transaction not found or access denied',
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Only drafts can be deleted
      if (existingTransaction.status !== 'draft') {
        return new Response(JSON.stringify({
          success: false,
          error: `Cannot delete a transaction with status "${existingTransaction.status}". Only draft transactions can be deleted.`,
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      const result = await transactionService.deleteTransaction(transactionId, user.id);
      
      if (!result) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to delete transaction',
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Transaction deleted successfully',
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      const errorMessage = error instanceof AppError 
        ? error.message 
        : 'An unexpected error occurred while deleting the transaction';
      
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
        'Allow': 'GET, PUT, PATCH, DELETE' 
      } 
    });
  }
};
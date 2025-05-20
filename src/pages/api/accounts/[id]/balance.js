// src/pages/api/accounts/[id]/balance.js
import { createAccountService } from '../../../../lib/services/account-service.js';
import { createEntityAccountService } from '../../../../lib/services/entity-account-service.js';
import { createTransactionService } from '../../../../lib/services/transaction-service.js';

export const onRequest = async ({ params, request, locals }) => {
  const user = locals.user;
  const env = locals.runtime.env;
  const accountId = params.id;
  
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

  if (!accountId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Account ID is required',
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  try {
    const url = new URL(request.url);
    const entityId = url.searchParams.get('entityId');
    const asOf = url.searchParams.get('asOf'); // Optional date to get balance as of a specific date
    
    if (!entityId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Entity ID is required as a query parameter',
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    const accountService = createAccountService(env.DATABASE);
    const entityAccountService = createEntityAccountService(env.DATABASE);
    const transactionService = createTransactionService(env.DATABASE);
    
    // Verify account exists and user has access to it
    const account = await accountService.getAccountById(accountId, user.id);
    if (!account) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Account not found or access denied',
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Verify account is linked to the specified entity
    const entityAccount = await entityAccountService.getEntityAccountByEntityAndAccount(
      entityId,
      accountId,
      user.id
    );
    if (!entityAccount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Account is not linked to the specified entity',
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Get account balance
    const balance = await transactionService.getAccountBalance(
      accountId, 
      entityId, 
      user.id,
      asOf ? new Date(asOf) : undefined
    );
    
    // Get unreconciled balance if needed
    const unreconciledBalance = await transactionService.getUnreconciledBalance(
      accountId,
      entityId,
      user.id
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        accountId,
        entityId,
        balance,
        unreconciledBalance,
        asOf: asOf || new Date().toISOString().split('T')[0],
      }
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
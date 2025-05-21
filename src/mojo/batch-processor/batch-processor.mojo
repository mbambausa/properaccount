# src/lib/mojo/batch-processor/batch-processor.mojo
from BigDecimal import BigDecimal

/**
 * Batch Transaction Processor for ProperAccount
 * 
 * This module provides high-performance processing of batch transactions,
 * including validation, categorization, and reconciliation.
 */

# Define rounding modes
const ROUND_HALF_EVEN = 0  # Banker's rounding (GAAP-compliant)

# Error codes
const ERROR_NONE = 0
const ERROR_UNBALANCED = 1
const ERROR_MISSING_REQUIRED = 2
const ERROR_INVALID_ACCOUNT = 3
const ERROR_INVALID_DATE = 4
const ERROR_DUPLICATE = 5

/**
 * Validate a transaction batch for proper accounting
 * 
 * @param transactions PythonObject array of transaction data
 * @param accounts PythonObject array of valid account IDs
 * @return PythonObject containing validation results
 */
fn validate_transactions(
    transactions: PythonObject,
    accounts: PythonObject
) -> PythonObject:
    var results = PythonObject({
        "valid": True,
        "errors": [],
        "warnings": []
    })
    
    # Build set of valid accounts
    var valid_accounts = PythonObject({})
    for i in range(accounts.length()):
        valid_accounts[accounts[i]] = True
    
    # Track transaction IDs to check for duplicates
    var transaction_ids = PythonObject({})
    
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var transaction_id = transaction.get("id", str(i))
        var lines = transaction.get("lines", PythonObject([]))
        
        # Check for duplicate transaction ID
        if transaction_ids.get(transaction_id, False):
            results["valid"] = False
            results["errors"].append({
                "transaction_id": transaction_id,
                "code": ERROR_DUPLICATE,
                "message": "Duplicate transaction ID"
            })
            continue
        
        transaction_ids[transaction_id] = True
        
        # Check for required fields
        if not transaction.get("date"):
            results["valid"] = False
            results["errors"].append({
                "transaction_id": transaction_id,
                "code": ERROR_MISSING_REQUIRED,
                "message": "Missing transaction date"
            })
        
        # Validate date format (simple check)
        var date_str = transaction.get("date", "")
        if not is_valid_date(date_str):
            results["valid"] = False
            results["errors"].append({
                "transaction_id": transaction_id,
                "code": ERROR_INVALID_DATE,
                "message": "Invalid date format: " + date_str
            })
        
        # Check for empty lines
        if lines.length() == 0:
            results["valid"] = False
            results["errors"].append({
                "transaction_id": transaction_id,
                "code": ERROR_MISSING_REQUIRED,
                "message": "Transaction has no lines"
            })
            continue
        
        # Validate transaction lines
        var debits = BigDecimal("0")
        var credits = BigDecimal("0")
        
        for j in range(lines.length()):
            var line = lines[j]
            
            # Validate account
            var account_id = line.get("account_id", "")
            if not valid_accounts.get(account_id, False):
                results["valid"] = False
                results["errors"].append({
                    "transaction_id": transaction_id,
                    "line": j,
                    "code": ERROR_INVALID_ACCOUNT,
                    "message": "Invalid account ID: " + account_id
                })
            
            # Sum debits and credits
            var amount = BigDecimal(line.get("amount", "0"))
            if line.get("is_debit", False):
                debits = debits.add(amount)
            else:
                credits = credits.add(amount)
        
        # Check if transaction is balanced
        if debits.compare(credits) != 0:
            results["valid"] = False
            results["errors"].append({
                "transaction_id": transaction_id,
                "code": ERROR_UNBALANCED,
                "message": "Transaction is not balanced. Debits: " + debits.to_string() + ", Credits: " + credits.to_string()
            })
    
    return results

/**
 * Process a batch of transactions, applying them to accounts
 * 
 * @param transactions PythonObject array of transaction data
 * @param accounts PythonObject dict of account data
 * @return PythonObject with processing results
 */
fn process_transaction_batch(
    transactions: PythonObject,
    accounts: PythonObject
) -> PythonObject:
    var results = validate_transactions(transactions, PythonObject(accounts.keys()))
    
    # If not valid, return validation errors
    if not results["valid"]:
        return results
    
    var processed_transactions = PythonObject([])
    var account_balances = PythonObject({})
    
    # Initialize account balances
    for account_id in accounts.keys():
        account_balances[account_id] = BigDecimal(accounts[account_id].get("balance", "0"))
    
    # Process each transaction
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var transaction_id = transaction.get("id", str(i))
        var lines = transaction.get("lines", PythonObject([]))
        
        var processed_lines = PythonObject([])
        
        for j in range(lines.length()):
            var line = lines[j]
            var account_id = line.get("account_id", "")
            var amount = BigDecimal(line.get("amount", "0"))
            var is_debit = line.get("is_debit", False)
            
            # Update account balance
            var account_type = accounts[account_id].get("type", "asset")
            var normal_balance_is_debit = (
                account_type == "asset" or 
                account_type == "expense"
            )
            
            # If debit and normal balance is debit, or credit and normal balance is credit, increase balance
            if (is_debit and normal_balance_is_debit) or (not is_debit and not normal_balance_is_debit):
                account_balances[account_id] = account_balances[account_id].add(amount)
            else:
                account_balances[account_id] = account_balances[account_id].subtract(amount)
            
            processed_lines.append({
                "account_id": account_id,
                "amount": amount.to_string(),
                "is_debit": is_debit,
                "account_type": account_type
            })
        
        processed_transactions.append({
            "id": transaction_id,
            "date": transaction.get("date", ""),
            "description": transaction.get("description", ""),
            "lines": processed_lines
        })
    
    # Prepare results
    var updated_accounts = PythonObject({})
    for account_id in account_balances.keys():
        updated_accounts[account_id] = {
            "id": account_id,
            "type": accounts[account_id].get("type", ""),
            "name": accounts[account_id].get("name", ""),
            "balance": account_balances[account_id].to_string()
        }
    
    results["processed_transactions"] = processed_transactions
    results["updated_accounts"] = updated_accounts
    
    return results

/**
 * Categorize transactions based on patterns
 * 
 * @param transactions PythonObject array of transaction data
 * @param patterns PythonObject array of categorization patterns
 * @return PythonObject with categorized transactions
 */
fn categorize_transactions(
    transactions: PythonObject,
    patterns: PythonObject
) -> PythonObject:
    var categorized = PythonObject([])
    
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var description = transaction.get("description", "").lower()
        var amount = BigDecimal(transaction.get("amount", "0"))
        var original_category = transaction.get("category", "")
        var matched_category = original_category
        var confidence = 0.0
        
        # Skip if already categorized with high confidence
        if transaction.get("category_confidence", 0.0) > 0.8:
            categorized.append(transaction)
            continue
        
        # Try to match patterns
        for j in range(patterns.length()):
            var pattern = patterns[j]
            var pattern_text = pattern.get("text", "").lower()
            var pattern_category = pattern.get("category", "")
            var pattern_min_amount = BigDecimal(pattern.get("min_amount", "-999999999"))
            var pattern_max_amount = BigDecimal(pattern.get("max_amount", "999999999"))
            
            # Check if description contains pattern text
            if pattern_text in description:
                # Check if amount is within range
                if amount.compare(pattern_min_amount) >= 0 and amount.compare(pattern_max_amount) <= 0:
                    # Calculate match confidence based on text length
                    var new_confidence = float(len(pattern_text)) / float(len(description))
                    
                    # Only update if confidence is higher
                    if new_confidence > confidence:
                        matched_category = pattern_category
                        confidence = new_confidence
        
        # Apply matched category
        var categorized_transaction = transaction.copy()
        categorized_transaction["category"] = matched_category
        categorized_transaction["category_confidence"] = confidence
        categorized_transaction["category_is_auto"] = matched_category != original_category
        
        categorized.append(categorized_transaction)
    
    return categorized

/**
 * Simple helper to validate date string format
 */
fn is_valid_date(date_str: String) -> Bool:
    # Basic implementation - should check for valid YYYY-MM-DD format
    if len(date_str) != 10:
        return False
    
    if date_str[4] != '-' or date_str[7] != '-':
        return False
    
    # Check if all other characters are digits
    for i in range(len(date_str)):
        if i != 4 and i != 7:
            if not (date_str[i] >= '0' and date_str[i] <= '9'):
                return False
    
    # Check month and day ranges
    var year = int(date_str[0:4])
    var month = int(date_str[5:7])
    var day = int(date_str[8:10])
    
    if month < 1 or month > 12:
        return False
    
    if day < 1 or day > 31:
        return False
    
    # Simplified validation - doesn't check for specific month lengths
    return True
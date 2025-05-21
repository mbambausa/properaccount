# src/lib/mojo/reporting-engine/reporting-engine.mojo

from BigDecimal import BigDecimal

/**
 * Reporting Engine for ProperAccount
 * 
 * This module provides GAAP-compliant financial reporting for real estate
 * accounting, generating balance sheets, income statements, and cash flow analysis.
 */

# Define constants
const REPORT_BALANCE_SHEET = 0
const REPORT_INCOME_STATEMENT = 1
const REPORT_CASH_FLOW = 2
const REPORT_TAX_SUMMARY = 3

/**
 * Generate a balance sheet report
 * 
 * @param accounts PythonObject dict of account data
 * @param date String representing the report date (YYYY-MM-DD)
 * @return PythonObject containing the balance sheet
 */
fn generate_balance_sheet(
    accounts: PythonObject,
    date: String
) -> PythonObject:
    var assets = PythonObject([])
    var liabilities = PythonObject([])
    var equity = PythonObject([])
    
    var total_assets = BigDecimal("0")
    var total_liabilities = BigDecimal("0")
    var total_equity = BigDecimal("0")
    
    # Categorize accounts and calculate totals
    for account_id in accounts.keys():
        var account = accounts[account_id]
        var account_type = account.get("type", "")
        var balance = BigDecimal(account.get("balance", "0"))
        
        var account_data = {
            "id": account_id,
            "name": account.get("name", ""),
            "balance": balance.to_string()
        }
        
        if account_type == "asset":
            assets.append(account_data)
            total_assets = total_assets.add(balance)
        elif account_type == "liability":
            liabilities.append(account_data)
            total_liabilities = total_liabilities.add(balance)
        elif account_type == "equity":
            equity.append(account_data)
            total_equity = total_equity.add(balance)
    
    # Check if balance sheet is balanced
    var is_balanced = total_assets.equals(total_liabilities.add(total_equity))
    var variance = BigDecimal("0")
    
    if not is_balanced:
        variance = total_assets.subtract(total_liabilities.add(total_equity))
    
    # Sort account sections
    assets = sort_accounts_by_name(assets)
    liabilities = sort_accounts_by_name(liabilities)
    equity = sort_accounts_by_name(equity)
    
    return PythonObject({
        "report_type": "balance_sheet",
        "date": date,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_assets": total_assets.to_string(),
        "total_liabilities": total_liabilities.to_string(),
        "total_equity": total_equity.to_string(),
        "is_balanced": is_balanced,
        "variance": variance.to_string()
    })

/**
 * Generate an income statement report
 * 
 * @param accounts PythonObject dict of account data
 * @param transactions PythonObject array of transactions
 * @param start_date String representing the start date (YYYY-MM-DD)
 * @param end_date String representing the end date (YYYY-MM-DD)
 * @return PythonObject containing the income statement
 */
fn generate_income_statement(
    accounts: PythonObject,
    transactions: PythonObject,
    start_date: String,
    end_date: String
) -> PythonObject:
    var revenue_accounts = PythonObject([])
    var expense_accounts = PythonObject([])
    
    var total_revenue = BigDecimal("0")
    var total_expenses = BigDecimal("0")
    
    # Find revenue and expense accounts
    for account_id in accounts.keys():
        var account = accounts[account_id]
        var account_type = account.get("type", "")
        
        if account_type == "revenue":
            revenue_accounts.append({
                "id": account_id,
                "name": account.get("name", ""),
                "balance": "0"  # Will be calculated from transactions
            })
        elif account_type == "expense":
            expense_accounts.append({
                "id": account_id,
                "name": account.get("name", ""),
                "balance": "0"  # Will be calculated from transactions
            })
    
    # Calculate account balances for the period
    var account_balances = PythonObject({})
    
    # Initialize account balances to zero
    for account_id in accounts.keys():
        account_balances[account_id] = BigDecimal("0")
    
    # Process transactions within date range
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var date = transaction.get("date", "")
        
        # Skip transactions outside date range
        if date < start_date or date > end_date:
            continue
        
        var lines = transaction.get("lines", PythonObject([]))
        
        for j in range(lines.length()):
            var line = lines[j]
            var account_id = line.get("account_id", "")
            var amount = BigDecimal(line.get("amount", "0"))
            var is_debit = line.get("is_debit", False)
            
            var account_type = accounts.get(account_id, PythonObject({})).get("type", "")
            
            # Skip accounts that are not revenue or expense
            if account_type != "revenue" and account_type != "expense":
                continue
            
            # For revenue: credit increases, debit decreases
            # For expense: debit increases, credit decreases
            if account_type == "revenue":
                if is_debit:
                    account_balances[account_id] = account_balances[account_id].subtract(amount)
                else:
                    account_balances[account_id] = account_balances[account_id].add(amount)
            elif account_type == "expense":
                if is_debit:
                    account_balances[account_id] = account_balances[account_id].add(amount)
                else:
                    account_balances[account_id] = account_balances[account_id].subtract(amount)
    
    # Update account balances and calculate totals
    for i in range(revenue_accounts.length()):
        var account_id = revenue_accounts[i]["id"]
        var balance = account_balances.get(account_id, BigDecimal("0"))
        revenue_accounts[i]["balance"] = balance.to_string()
        total_revenue = total_revenue.add(balance)
    
    for i in range(expense_accounts.length()):
        var account_id = expense_accounts[i]["id"]
        var balance = account_balances.get(account_id, BigDecimal("0"))
        expense_accounts[i]["balance"] = balance.to_string()
        total_expenses = total_expenses.add(balance)
    
    var net_income = total_revenue.subtract(total_expenses)
    
    # Sort account sections
    revenue_accounts = sort_accounts_by_name(revenue_accounts)
    expense_accounts = sort_accounts_by_name(expense_accounts)
    
    return PythonObject({
        "report_type": "income_statement",
        "start_date": start_date,
        "end_date": end_date,
        "revenue": revenue_accounts,
        "expenses": expense_accounts,
        "total_revenue": total_revenue.to_string(),
        "total_expenses": total_expenses.to_string(),
        "net_income": net_income.to_string()
    })

/**
 * Generate a cash flow report
 * 
 * @param accounts PythonObject dict of account data
 * @param transactions PythonObject array of transactions
 * @param start_date String representing the start date (YYYY-MM-DD)
 * @param end_date String representing the end date (YYYY-MM-DD)
 * @return PythonObject containing the cash flow report
 */
fn generate_cash_flow_report(
    accounts: PythonObject,
    transactions: PythonObject,
    start_date: String,
    end_date: String
) -> PythonObject:
    # Identify cash accounts
    var cash_account_ids = PythonObject([])
    for account_id in accounts.keys():
        var account = accounts[account_id]
        if account.get("type", "") == "asset" and "cash" in account.get("name", "").lower():
            cash_account_ids.append(account_id)
    
    # Calculate opening and closing balances
    var opening_balances = PythonObject({})
    var closing_balances = PythonObject({})
    
    for i in range(cash_account_ids.length()):
        var account_id = cash_account_ids[i]
        opening_balances[account_id] = BigDecimal("0")
        closing_balances[account_id] = BigDecimal("0")
    
    # Process all transactions to determine balances
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var date = transaction.get("date", "")
        var lines = transaction.get("lines", PythonObject([]))
        
        for j in range(lines.length()):
            var line = lines[j]
            var account_id = line.get("account_id", "")
            
            # Skip if not a cash account
            if not account_id in cash_account_ids:
                continue
            
            var amount = BigDecimal(line.get("amount", "0"))
            var is_debit = line.get("is_debit", False)
            
            # Update balances
            if date < start_date:
                # Affects opening balance
                if is_debit:
                    opening_balances[account_id] = opening_balances[account_id].add(amount)
                else:
                    opening_balances[account_id] = opening_balances[account_id].subtract(amount)
            
            # All transactions up to end date affect closing balance
            if date <= end_date:
                if is_debit:
                    closing_balances[account_id] = closing_balances[account_id].add(amount)
                else:
                    closing_balances[account_id] = closing_balances[account_id].subtract(amount)
    
    # Categorize cash flows
    var operating = PythonObject([])
    var investing = PythonObject([])
    var financing = PythonObject([])
    
    var total_operating = BigDecimal("0")
    var total_investing = BigDecimal("0")
    var total_financing = BigDecimal("0")
    
    # Process transactions within date range
    for i in range(transactions.length()):
        var transaction = transactions[i]
        var date = transaction.get("date", "")
        
        # Skip transactions outside date range
        if date < start_date or date > end_date:
            continue
        
        var description = transaction.get("description", "")
        var lines = transaction.get("lines", PythonObject([]))
        var cash_impact = BigDecimal("0")
        
        # Calculate net cash impact
        for j in range(lines.length()):
            var line = lines[j]
            var account_id = line.get("account_id", "")
            
            # If this line affects a cash account
            if account_id in cash_account_ids:
                var amount = BigDecimal(line.get("amount", "0"))
                var is_debit = line.get("is_debit", False)
                
                if is_debit:
                    cash_impact = cash_impact.add(amount)
                else:
                    cash_impact = cash_impact.subtract(amount)
            
        # Skip if no cash impact
        if cash_impact.is_zero():
            continue
        
        # Categorize by examining non-cash accounts in the transaction
        var category = "operating"  # Default
        
        for j in range(lines.length()):
            var line = lines[j]
            var account_id = line.get("account_id", "")
            
            # Skip cash accounts for categorization
            if account_id in cash_account_ids:
                continue
            
            var account_type = accounts.get(account_id, PythonObject({})).get("type", "")
            var account_name = accounts.get(account_id, PythonObject({})).get("name", "").lower()
            
            # Categorize based on account type and name
            if account_type == "asset" and ("equipment" in account_name or "property" in account_name):
                category = "investing"
                break
            elif account_type == "liability" and "loan" in account_name:
                category = "financing"
                break
            elif account_type == "equity" and ("capital" in account_name or "draw" in account_name):
                category = "financing"
                break
        
        # Add to appropriate category
        var cash_flow_item = {
            "date": date,
            "description": description,
            "amount": cash_impact.to_string()
        }
        
        if category == "operating":
            operating.append(cash_flow_item)
            total_operating = total_operating.add(cash_impact)
        elif category == "investing":
            investing.append(cash_flow_item)
            total_investing = total_investing.add(cash_impact)
        elif category == "financing":
            financing.append(cash_flow_item)
            total_financing = total_financing.add(cash_impact)
    
    # Calculate totals
    var total_cash_accounts = PythonObject([])
    var total_opening = BigDecimal("0")
    var total_closing = BigDecimal("0")
    var total_change = BigDecimal("0")
    
    for i in range(cash_account_ids.length()):
        var account_id = cash_account_ids[i]
        var account_name = accounts.get(account_id, PythonObject({})).get("name", "")
        var opening = opening_balances.get(account_id, BigDecimal("0"))
        var closing = closing_balances.get(account_id, BigDecimal("0"))
        var change = closing.subtract(opening)
        
        total_opening = total_opening.add(opening)
        total_closing = total_closing.add(closing)
        total_change = total_change.add(change)
        
        total_cash_accounts.append({
            "id": account_id,
            "name": account_name,
            "opening_balance": opening.to_string(),
            "closing_balance": closing.to_string(),
            "change": change.to_string()
        })
    
    var total_cash_flow = total_operating.add(total_investing).add(total_financing)
    var reconciliation = total_change.subtract(total_cash_flow)
    
    # Sort cash flow categories
    operating = sort_cash_flows_by_date(operating)
    investing = sort_cash_flows_by_date(investing)
    financing = sort_cash_flows_by_date(financing)
    
    return PythonObject({
        "report_type": "cash_flow",
        "start_date": start_date,
        "end_date": end_date,
        "cash_accounts": total_cash_accounts,
        "total_opening_balance": total_opening.to_string(),
        "total_closing_balance": total_closing.to_string(),
        "total_change": total_change.to_string(),
        "operating_activities": operating,
        "investing_activities": investing,
        "financing_activities": financing,
        "total_operating": total_operating.to_string(),
        "total_investing": total_investing.to_string(),
        "total_financing": total_financing.to_string(),
        "total_cash_flow": total_cash_flow.to_string(),
        "reconciliation_variance": reconciliation.to_string()
    })

/**
 * Generate a tax summary report
 * 
 * @param accounts PythonObject dict of account data
 * @param transactions PythonObject array of transactions
 * @param year Int representing the tax year
 * @return PythonObject containing the tax summary
 */
fn generate_tax_summary(
    accounts: PythonObject,
    transactions: PythonObject,
    year: Int
) -> PythonObject:
    var start_date = str(year) + "-01-01"
    var end_date = str(year) + "-12-31"
    
    # Generate income statement for the year
    var income_statement = generate_income_statement(accounts, transactions, start_date, end_date)
    
    # Extract tax-relevant information
    var revenue_items = income_statement["revenue"]
    var expense_items = income_statement["expenses"]
    
    var taxable_income = BigDecimal(income_statement["net_income"])
    
    # Identify tax-deductible expenses
    var deductible_expenses = PythonObject([])
    var total_deductible = BigDecimal("0")
    
    for i in range(expense_items.length()):
        var expense = expense_items[i]
        var expense_id = expense["id"]
        var account = accounts.get(expense_id, PythonObject({}))
        var tax_deductible = account.get("tax_deductible", True)
        
        if tax_deductible:
            deductible_expenses.append(expense)
            total_deductible = total_deductible.add(BigDecimal(expense["balance"]))
        
    # Calculate depreciation
    var depreciation_expense = BigDecimal("0")
    for i in range(expense_items.length()):
        var expense = expense_items[i]
        var name = expense["name"].lower()
        if "depreciation" in name:
            depreciation_expense = depreciation_expense.add(BigDecimal(expense["balance"]))
    
    # Generate tax summary
    return PythonObject({
        "report_type": "tax_summary",
        "year": year,
        "total_revenue": income_statement["total_revenue"],
        "deductible_expenses": deductible_expenses,
        "total_deductible_expenses": total_deductible.to_string(),
        "depreciation_expense": depreciation_expense.to_string(),
        "taxable_income": taxable_income.to_string()
    })

/**
 * Generate a financial report based on type
 * 
 * @param report_type Int representing the report type
 * @param accounts PythonObject dict of account data
 * @param transactions PythonObject array of transactions
 * @param params PythonObject containing report parameters
 * @return PythonObject containing the report
 */
fn generate_report(
    report_type: Int,
    accounts: PythonObject,
    transactions: PythonObject,
    params: PythonObject
) -> PythonObject:
    if report_type == REPORT_BALANCE_SHEET:
        var date = params.get("date", "")
        return generate_balance_sheet(accounts, date)
    
    elif report_type == REPORT_INCOME_STATEMENT:
        var start_date = params.get("start_date", "")
        var end_date = params.get("end_date", "")
        return generate_income_statement(accounts, transactions, start_date, end_date)
    
    elif report_type == REPORT_CASH_FLOW:
        var start_date = params.get("start_date", "")
        var end_date = params.get("end_date", "")
        return generate_cash_flow_report(accounts, transactions, start_date, end_date)
    
    elif report_type == REPORT_TAX_SUMMARY:
        var year = int(params.get("year", "0"))
        return generate_tax_summary(accounts, transactions, year)
    
    else:
        return PythonObject({
            "error": "Unknown report type"
        })

/**
 * Utility function to sort accounts by name
 */
fn sort_accounts_by_name(accounts: PythonObject) -> PythonObject:
    # Simple bubble sort implementation
    var length = accounts.length()
    for i in range(length):
        for j in range(length - i - 1):
            var name1 = accounts[j].get("name", "").lower()
            var name2 = accounts[j + 1].get("name", "").lower()
            if name1 > name2:
                var temp = accounts[j]
                accounts[j] = accounts[j + 1]
                accounts[j + 1] = temp
    
    return accounts

/**
 * Utility function to sort cash flows by date
 */
fn sort_cash_flows_by_date(cash_flows: PythonObject) -> PythonObject:
    # Simple bubble sort implementation
    var length = cash_flows.length()
    for i in range(length):
        for j in range(length - i - 1):
            var date1 = cash_flows[j].get("date", "")
            var date2 = cash_flows[j + 1].get("date", "")
            if date1 > date2:
                var temp = cash_flows[j]
                cash_flows[j] = cash_flows[j + 1]
                cash_flows[j + 1] = temp
    
    return cash_flows
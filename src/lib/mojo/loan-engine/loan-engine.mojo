# src/lib/mojo/loan-engine/loan-engine.mojo
from BigDecimal import BigDecimal

/**
 * Loan Engine for ProperAccount
 * 
 * This module provides high-precision financial calculations for loans with
 * GAAP-compliant rounding and accurate amortization schedules.
 */

# Define rounding modes
const ROUND_HALF_EVEN = 0  # Banker's rounding (GAAP-compliant)
const ROUND_HALF_UP = 1    # Round up on midpoint
const ROUND_UP = 2         # Always round away from zero
const ROUND_DOWN = 3       # Always round toward zero

/**
 * Calculate loan payment amount
 * 
 * @param principal The loan principal amount
 * @param annual_rate Annual interest rate as a decimal (e.g., 0.05 for 5%)
 * @param terms Number of payment periods
 * @param payment_frequency Payments per year (12 for monthly, 26 for bi-weekly, etc.)
 * @return Monthly payment amount
 */
fn calculate_loan_payment(
    principal: BigDecimal,
    annual_rate: BigDecimal,
    terms: Int,
    payment_frequency: Int = 12
) -> BigDecimal:
    # Convert annual rate to period rate
    var period_rate = annual_rate.divide(BigDecimal(payment_frequency), 10, ROUND_HALF_EVEN)
    
    # Handle zero interest case
    if period_rate.is_zero():
        return principal.divide(BigDecimal(terms), 2, ROUND_HALF_EVEN)
    
    # Formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
    var rate_plus_one = period_rate.add(BigDecimal("1"))
    var rate_plus_one_pow_terms = rate_plus_one.pow(terms)
    var numerator = principal.multiply(period_rate).multiply(rate_plus_one_pow_terms)
    var denominator = rate_plus_one_pow_terms.subtract(BigDecimal("1"))
    
    return numerator.divide(denominator, 6, ROUND_HALF_EVEN).round(2)

/**
 * Generate amortization schedule
 * 
 * @param principal The loan principal amount
 * @param annual_rate Annual interest rate as a decimal (e.g., 0.05 for 5%)
 * @param terms Number of payment periods
 * @param payment_frequency Payments per year (12 for monthly, 26 for bi-weekly, etc.)
 * @return PythonObject containing the amortization schedule
 */
fn generate_amortization_schedule(
    principal: BigDecimal,
    annual_rate: BigDecimal,
    terms: Int,
    payment_frequency: Int = 12
) -> PythonObject:
    # Calculate payment
    var payment = calculate_loan_payment(principal, annual_rate, terms, payment_frequency)
    
    # Convert annual rate to period rate
    var period_rate = annual_rate.divide(BigDecimal(payment_frequency), 10, ROUND_HALF_EVEN)
    
    # Initialize schedule
    var schedule = PythonObject([])
    var remaining_balance = principal
    
    for term in range(1, terms + 1):
        # Calculate interest for this period
        var interest_payment = remaining_balance.multiply(period_rate).round(2)
        
        # Calculate principal portion
        var principal_payment = payment.subtract(interest_payment)
        
        # Handle final payment rounding
        if term == terms:
            # Final payment - ensure remaining balance becomes exactly zero
            principal_payment = remaining_balance
            payment = principal_payment.add(interest_payment)
        
        # Update remaining balance
        remaining_balance = remaining_balance.subtract(principal_payment)
        
        # Add to schedule
        schedule.append({
            "term": term,
            "payment": payment.to_string(),
            "principal": principal_payment.to_string(),
            "interest": interest_payment.to_string(),
            "balance": remaining_balance.to_string()
        })
    
    return schedule

/**
 * Calculate total interest paid over loan term
 * 
 * @param principal The loan principal amount
 * @param annual_rate Annual interest rate as a decimal (e.g., 0.05 for 5%)
 * @param terms Number of payment periods
 * @param payment_frequency Payments per year (12 for monthly, 26 for bi-weekly, etc.)
 * @return Total interest paid
 */
fn calculate_total_interest(
    principal: BigDecimal,
    annual_rate: BigDecimal,
    terms: Int,
    payment_frequency: Int = 12
) -> BigDecimal:
    var payment = calculate_loan_payment(principal, annual_rate, terms, payment_frequency)
    var total_payments = payment.multiply(BigDecimal(terms))
    return total_payments.subtract(principal).round(2)

/**
 * Calculate loan scenarios to compare options
 * 
 * @param principal The loan principal amount
 * @param scenarios Array of [annual_rate, terms, payment_frequency] tuples
 * @return PythonObject containing comparison of scenarios
 */
fn compare_loan_scenarios(
    principal: BigDecimal,
    scenarios: PythonObject
) -> PythonObject:
    var results = PythonObject([])
    
    for i in range(scenarios.length()):
        var scenario = scenarios[i]
        var annual_rate = BigDecimal(scenario[0])
        var terms = Int(scenario[1])
        var payment_frequency = Int(scenario[2])
        
        var payment = calculate_loan_payment(principal, annual_rate, terms, payment_frequency)
        var total_interest = calculate_total_interest(principal, annual_rate, terms, payment_frequency)
        var total_cost = principal.add(total_interest)
        
        results.append({
            "scenario_id": i + 1,
            "principal": principal.to_string(),
            "annual_rate": annual_rate.to_string(),
            "terms": terms,
            "payment_frequency": payment_frequency,
            "payment": payment.to_string(),
            "total_interest": total_interest.to_string(),
            "total_cost": total_cost.to_string()
        })
    
    return results
# tests/mojo/big-decimal.spec.mojo
from testing import assert_equal, assert_not_equal, assert_true, assert_false
from BigDecimal import BigDecimal

fn test_big_decimal_precision():
    print("Testing BigDecimal precision...")
    
    # Create decimal values
    var a = BigDecimal("123.45")
    var b = BigDecimal("67.89")
    
    # Basic operations
    test_basic_operations(a, b)
    
    # Edge cases
    test_edge_cases()
    
    # Financial calculations
    test_financial_calculations()
    
    print("All BigDecimal precision tests passed!")

fn test_basic_operations(a: BigDecimal, b: BigDecimal):
    # Addition
    var sum = a.add(b)
    assert_equal(sum.to_string(), "191.34", "Addition should be exact")
    
    # Subtraction
    var diff = a.subtract(b)
    assert_equal(diff.to_string(), "55.56", "Subtraction should be exact")
    
    # Multiplication
    var product = a.multiply(b)
    assert_equal(product.to_string(), "8381.23", "Multiplication should be exact")
    
    # Division
    var quotient = a.divide(b, 20, 0) # 0 = ROUND_HALF_EVEN
    assert_equal(quotient.round(4).to_string(), "1.8185", "Division should be exact to 4 places")

fn test_edge_cases():
    # Zero
    var zero = BigDecimal("0")
    assert_true(zero.is_zero(), "Zero detection should work")
    
    # Negative values
    var neg = BigDecimal("-10.5")
    assert_false(neg.is_positive(), "Negative detection should work")
    assert_equal(neg.abs().to_string(), "10.5", "Absolute value should work")
    
    # Very small numbers
    var small = BigDecimal("0.0000000001")
    var smaller = small.divide(BigDecimal("10"), 20, 0)
    assert_equal(smaller.to_string(), "0.00000000001", "Small number precision should be maintained")
    
    # Very large numbers
    var large = BigDecimal("9999999999999999.99")
    var larger = large.multiply(BigDecimal("10"))
    assert_equal(larger.to_string(), "99999999999999999.90", "Large number precision should be maintained")

fn test_financial_calculations():
    # Test GAAP-compliant rounding (banker's rounding / round half to even)
    test_banker_rounding()
    
    # Loan calculations (simplified for test)
    test_loan_calculation()
    
    # Tax calculations (simplified for test)
    test_tax_calculation()

fn test_banker_rounding():
    # Round half to even
    var half_up = BigDecimal("2.5")
    var half_down = BigDecimal("1.5")
    assert_equal(half_up.round(0, 0).to_string(), "2", "2.5 rounds to 2 in banker's rounding")
    assert_equal(half_down.round(0, 0).to_string(), "2", "1.5 rounds to 2 in banker's rounding")
    
    # More examples
    var values = [
        # Original, rounded to 0 dp, rounded to 1 dp
        ("1.25", "1", "1.2"),
        ("1.35", "1", "1.4"),
        ("1.45", "1", "1.4"),
        ("1.55", "2", "1.6"),
        ("1.65", "2", "1.6"),
        ("1.75", "2", "1.8"),
        ("1.85", "2", "1.8"),
        ("1.95", "2", "2.0")
    ]
    
    for (original, round0, round1) in values:
        var bd = BigDecimal(original)
        assert_equal(bd.round(0, 0).to_string(), round0, original + " rounded to 0 dp")
        assert_equal(bd.round(1, 0).to_string(), round1, original + " rounded to 1 dp")

fn test_loan_calculation():
    # Loan amount: 100,000
    # Annual rate: 5%
    # Term: 12 months
    
    var principal = BigDecimal("100000")
    var annual_rate = BigDecimal("0.05")
    var monthly_rate = annual_rate.divide(BigDecimal("12"), 10, 0)
    var term = 12
    
    # Expected monthly payment formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
    var monthly_payment = calculate_loan_payment(principal, monthly_rate, term)
    
    # Expected monthly payment ≈ $8,560.75
    assert_equal(monthly_payment.round(2).to_string(), "8560.75", "Loan payment calculation should be correct")
    
    # Test amortization
    var remaining = principal
    var total_interest = BigDecimal("0")
    var total_payment = BigDecimal("0")
    
    for i in range(term):
        var interest = remaining.multiply(monthly_rate).round(2)
        var principal_payment = monthly_payment.subtract(interest)
        
        if i == term - 1:
            # Last payment - adjust to zero out the loan
            principal_payment = remaining
            monthly_payment = principal_payment.add(interest)
        
        remaining = remaining.subtract(principal_payment)
        total_interest = total_interest.add(interest)
        total_payment = total_payment.add(monthly_payment)
    
    # Total interest should be ~$2,729.00
    assert_equal(total_interest.round(2).to_string(), "2729.00", "Total interest calculation should be correct")
    
    # Remaining balance should be 0
    assert_true(remaining.is_zero() || remaining.abs().compare(BigDecimal("0.01")) < 0, 
        "Amortization should result in zero balance")

fn calculate_loan_payment(principal: BigDecimal, monthly_rate: BigDecimal, term: Int) -> BigDecimal:
    if monthly_rate.is_zero():
        return principal.divide(BigDecimal(term), 10, 0)
    
    var rate_plus_one = monthly_rate.add(BigDecimal("1"))
    var rate_plus_one_pow_term = rate_plus_one.pow(term)
    var numerator = principal.multiply(monthly_rate).multiply(rate_plus_one_pow_term)
    var denominator = rate_plus_one_pow_term.subtract(BigDecimal("1"))
    
    return numerator.divide(denominator, 10, 0).round(2)

fn test_tax_calculation():
    # Simple depreciation test
    var asset_cost = BigDecimal("50000")
    var salvage_value = BigDecimal("5000")
    var useful_life = 5
    
    # Straight-line depreciation
    var annual_depreciation = asset_cost.subtract(salvage_value).divide(BigDecimal(useful_life), 2, 0)
    
    # Expected annual depreciation = $9,000
    assert_equal(annual_depreciation.round(2).to_string(), "9000.00", "Depreciation calculation should be correct")

fn main():
    test_big_decimal_precision()
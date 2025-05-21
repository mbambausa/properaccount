#  src/lib/mojo/tax-engine/tax-engine.mojo
from BigDecimal import BigDecimal

/**
 * Tax Engine for ProperAccount
 * 
 * This module provides high-precision tax calculations for real estate
 * accounting, including depreciation methods and tax basis calculations.
 */

# Define rounding modes
const ROUND_HALF_EVEN = 0  # Banker's rounding (GAAP-compliant)
const ROUND_HALF_UP = 1    # Round up on midpoint
const ROUND_DOWN = 3       # Always round toward zero

# Depreciation methods
const DEPRECIATION_STRAIGHT_LINE = 0
const DEPRECIATION_DOUBLE_DECLINING = 1
const DEPRECIATION_SUM_OF_YEARS = 2
const DEPRECIATION_MACRS_RESIDENTIAL = 3
const DEPRECIATION_MACRS_COMMERCIAL = 4

# MACRS percentage tables (27.5 years residential, 39 years commercial)
fn get_macrs_residential_rate(year: Int) -> BigDecimal:
    # Simplified rates for residential property (27.5 year)
    if year == 1:
        return BigDecimal("0.03636")  # 3.636%
    elif year > 27:
        return BigDecimal("0.01818")  # 1.818% (half year in year 28)
    else:
        return BigDecimal("0.03636")  # 3.636%

fn get_macrs_commercial_rate(year: Int) -> BigDecimal:
    # Simplified rates for commercial property (39 year)
    if year == 1:
        return BigDecimal("0.02564")  # 2.564% (half year)
    elif year > 39:
        return BigDecimal("0.01282")  # 1.282% (half year in year 40)
    else:
        return BigDecimal("0.02564")  # 2.564%

/**
 * Calculate depreciation for an asset
 * 
 * @param cost Initial cost basis of the asset
 * @param salvage_value Estimated salvage value at end of useful life
 * @param useful_life Useful life in years
 * @param method Depreciation method to use
 * @param current_year Current year of depreciation (1-based)
 * @return Depreciation amount for the current year
 */
fn calculate_depreciation(
    cost: BigDecimal,
    salvage_value: BigDecimal,
    useful_life: Int,
    method: Int = DEPRECIATION_STRAIGHT_LINE,
    current_year: Int = 1,
    placed_in_service_month: Int = 1
) -> BigDecimal:
    # Validate inputs
    if current_year < 1 or current_year > useful_life + 1:
        return BigDecimal("0")
    
    # Calculate months in service for first year
    var first_year_factor = BigDecimal("1")
    if placed_in_service_month > 1:
        var months_in_service = 13 - placed_in_service_month
        first_year_factor = BigDecimal(months_in_service).divide(BigDecimal("12"), 4, ROUND_HALF_EVEN)
    
    # Apply the selected depreciation method
    if method == DEPRECIATION_STRAIGHT_LINE:
        # Straight-line: (cost - salvage) / useful_life
        var annual_depreciation = cost.subtract(salvage_value).divide(BigDecimal(useful_life), 6, ROUND_HALF_EVEN)
        if current_year == 1:
            return annual_depreciation.multiply(first_year_factor).round(2)
        elif current_year <= useful_life:
            return annual_depreciation.round(2)
        else:
            return BigDecimal("0")
    
    elif method == DEPRECIATION_DOUBLE_DECLINING:
        # Double-declining balance
        # Rate = 2 / useful_life
        var rate = BigDecimal("2").divide(BigDecimal(useful_life), 6, ROUND_HALF_EVEN)
        
        # Calculate remaining value after prior years' depreciation
        var book_value = cost
        for year in range(1, current_year):
            var depr_rate = rate
            if year == 1:
                depr_rate = rate.multiply(first_year_factor)
            var yearly_depreciation = book_value.multiply(depr_rate)
            book_value = book_value.subtract(yearly_depreciation)
        
        # Ensure we don't depreciate below salvage value
        var max_depreciation = book_value.subtract(salvage_value)
        if max_depreciation.is_negative():
            return BigDecimal("0")
        
        var depreciation = book_value.multiply(rate)
        if current_year == 1:
            depreciation = depreciation.multiply(first_year_factor)
        
        return depreciation.minimum(max_depreciation).round(2)
    
    elif method == DEPRECIATION_SUM_OF_YEARS:
        # Sum-of-years-digits
        # sum = n * (n + 1) / 2
        var n = useful_life
        var sum = n * (n + 1) / 2
        var factor = BigDecimal(useful_life - current_year + 1).divide(BigDecimal(sum), 6, ROUND_HALF_EVEN)
        var depreciation = cost.subtract(salvage_value).multiply(factor)
        
        if current_year == 1:
            return depreciation.multiply(first_year_factor).round(2)
        
        return depreciation.round(2)
    
    elif method == DEPRECIATION_MACRS_RESIDENTIAL:
        # MACRS for residential rental property (27.5 years)
        var rate = get_macrs_residential_rate(current_year)
        if current_year == 1:
            rate = rate.multiply(first_year_factor)
        return cost.multiply(rate).round(2)
    
    elif method == DEPRECIATION_MACRS_COMMERCIAL:
        # MACRS for commercial property (39 years)
        var rate = get_macrs_commercial_rate(current_year)
        if current_year == 1:
            rate = rate.multiply(first_year_factor)
        return cost.multiply(rate).round(2)
    
    # Default - straight line
    return cost.subtract(salvage_value).divide(BigDecimal(useful_life), 2, ROUND_HALF_EVEN).round(2)

/**
 * Generate a depreciation schedule
 * 
 * @param cost Initial cost basis of the asset
 * @param salvage_value Estimated salvage value at end of useful life
 * @param useful_life Useful life in years
 * @param method Depreciation method to use
 * @param placed_in_service_month Month the asset was placed in service (1-12)
 * @return PythonObject containing the depreciation schedule
 */
fn generate_depreciation_schedule(
    cost: BigDecimal,
    salvage_value: BigDecimal,
    useful_life: Int,
    method: Int = DEPRECIATION_STRAIGHT_LINE,
    placed_in_service_month: Int = 1
) -> PythonObject:
    var schedule = PythonObject([])
    var accumulated_depreciation = BigDecimal("0")
    var book_value = cost
    
    # Number of years to calculate (add 1 for partial final year)
    var years_to_calculate = useful_life
    if method == DEPRECIATION_MACRS_RESIDENTIAL and placed_in_service_month > 1:
        years_to_calculate = 28  # 27.5 years with partial first and last years
    elif method == DEPRECIATION_MACRS_COMMERCIAL and placed_in_service_month > 1:
        years_to_calculate = 40  # 39 years with partial first and last years
    
    for year in range(1, years_to_calculate + 1):
        var depreciation = calculate_depreciation(
            cost, salvage_value, useful_life, method, year, placed_in_service_month
        )
        
        # Skip years with zero depreciation
        if depreciation.is_zero():
            continue
        
        accumulated_depreciation = accumulated_depreciation.add(depreciation)
        book_value = cost.subtract(accumulated_depreciation)
        
        # Ensure book value doesn't go below salvage value
        if book_value.compare(salvage_value) < 0:
            book_value = salvage_value
            # Adjust final depreciation
            var adjusted_depreciation = cost.subtract(salvage_value).subtract(
                accumulated_depreciation.subtract(depreciation)
            )
            if adjusted_depreciation.is_positive():
                depreciation = adjusted_depreciation
                accumulated_depreciation = cost.subtract(salvage_value)
            else:
                # No more depreciation needed
                continue
        
        schedule.append({
            "year": year,
            "depreciation": depreciation.to_string(),
            "accumulated": accumulated_depreciation.to_string(),
            "book_value": book_value.to_string()
        })
    
    return schedule

/**
 * Calculate tax basis adjustments for real estate
 * 
 * @param original_basis Original cost basis of the property
 * @param improvements Array of improvement costs
 * @param depreciation_taken Total depreciation already taken
 * @return Adjusted tax basis
 */
fn calculate_tax_basis(
    original_basis: BigDecimal,
    improvements: PythonObject,  # Array of BigDecimal values
    depreciation_taken: BigDecimal
) -> BigDecimal:
    var basis = original_basis
    
    # Add improvements
    for i in range(improvements.length()):
        basis = basis.add(BigDecimal(improvements[i]))
    
    # Subtract depreciation
    basis = basis.subtract(depreciation_taken)
    
    # Ensure basis doesn't go negative
    if basis.is_negative():
        return BigDecimal("0")
    
    return basis.round(2)

/**
 * Calculate depreciation recapture for sold property
 * 
 * @param original_cost Original cost of the property
 * @param accumulated_depreciation Total accumulated depreciation
 * @param sale_price Sale price of the property
 * @return PythonObject with recapture details
 */
fn calculate_depreciation_recapture(
    original_cost: BigDecimal,
    accumulated_depreciation: BigDecimal,
    sale_price: BigDecimal
) -> PythonObject:
    var adjusted_basis = original_cost.subtract(accumulated_depreciation)
    var realized_gain = sale_price.subtract(adjusted_basis)
    
    # No gain? No recapture.
    if realized_gain.is_negative() or realized_gain.is_zero():
        return PythonObject({
            "realized_gain": "0.00",
            "recaptured_depreciation": "0.00",
            "capital_gain": "0.00"
        })
    
    # Calculate the portion that is recapture vs. capital gain
    var recapture = realized_gain.minimum(accumulated_depreciation)
    var capital_gain = realized_gain.subtract(recapture)
    
    return PythonObject({
        "realized_gain": realized_gain.to_string(),
        "recaptured_depreciation": recapture.to_string(),
        "capital_gain": capital_gain.to_string()
    })
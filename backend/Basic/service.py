import math
from .models import *

def Arithmetic_d_values(subdistrict):
    subdistrict_new_ids = [x['id'] for x in subdistrict]
    print("subdistrict_new_ids", subdistrict_new_ids)
        
        # Get population data for subdistricts
    subdistrict_2011 = list(Population_2011.objects.filter(
        subdistrict_code__in=subdistrict_new_ids
    ).values(
        'subdistrict_code', 'population_1951', 'population_1961', 
        'population_1971', 'population_1981', 'population_1991', 
        'population_2001', 'population_2011'
    ))
    
    print("subdistrict_2011",subdistrict_2011)
    
    # Calculate the total population for each decade
   
    d_values = []
    for subdistrict in subdistrict_2011:
        d_mean=(subdistrict['population_2011']-subdistrict['population_1951'])/6
        annual_growth_rate =math.floor(d_mean / 10)
        temp={
            "subdistrict_code": subdistrict['subdistrict_code'],
            "annual_growth_rate":annual_growth_rate,
            "total_p7":subdistrict['population_2011']
        }
        d_values.append(temp)

    return d_values


        
def Arithmetic_population_single_year(base_year,single_year,villages,subdistrict):
    output_year = {}
    ans=Arithmetic_d_values(subdistrict)
    print("ans ", ans)
    if single_year:
        target_year = int(single_year)
        for village in villages: 
            print("village", village)
            village_id, value ,vill_sub_id= village['id'],village['population'],village['subDistrictId']
            items= next(item for item in ans if item['subdistrict_code'] == vill_sub_id)
            output_year[village_id] = {
                "2011": value,
                str(target_year): int(value + ((items['annual_growth_rate'] * (target_year - base_year)) * (value / items['total_p7'])))
            }
        print(f"output year {output_year}")    
        Air_last_output={}
        Air_last_output['2011']=sum([values['2011'] for values in output_year.values()])
        Air_last_output[target_year]=sum([values[str(target_year)] for values in output_year.values()])
        print('Air_last_output',Air_last_output)
    return Air_last_output

def Arithmetic_population_range(base_year, start_year, end_year, villages, subdistrict):
    output_year = {}
    ans = Arithmetic_d_values(subdistrict)
    print("ans", ans)

    # Compute the population projections for each village separately
    for village in villages:
        village_id = village['id']
        value = village['population']
        vill_sub_id = village['subDistrictId']
        items = next((item for item in ans if item['subdistrict_code'] == vill_sub_id), None)

        if items:
            output_year[village_id] = {"2011": value}  # Store base population for 2011
            for year in range(start_year, end_year + 1):
                projected_value = int(value + ((items['annual_growth_rate'] * (year - base_year)) * (value / items['total_p7'])))
                output_year[village_id][year] = projected_value

    print(f"Output years Range {output_year}")

    # Now sum the populations across all villages to get the final output
    Air_last_output = {"2011": sum(values["2011"] for values in output_year.values())}
    for year in range(start_year, end_year + 1):
        Air_last_output[year] = sum(values[year] for values in output_year.values())

    print(f"Air_last_output {Air_last_output}")
    return Air_last_output

##### this is for special case to include 2025 always but currently it is implement in main site but it is correct 

# def Arithmetic_population_range(base_year, start_year, end_year, villages, subdistrict):
#     output_year = {}
#     ans = Arithmetic_d_values(subdistrict)
#     print("ans", ans)

#     # Force include base_year (2011) and final fixed year (2025) in the year range
#     fixed_years = {base_year, 2025}
#     full_years = set(range(start_year, end_year + 1)).union(fixed_years)
#     full_years = sorted(full_years)

#     for village in villages:
#         village_id = village['id']
#         value = village['population']
#         vill_sub_id = village['subDistrictId']
#         items = next((item for item in ans if item['subdistrict_code'] == vill_sub_id), None)

#         if items:
#             output_year[village_id] = {}
#             for year in full_years:
#                 if year == base_year:
#                     output_year[village_id][year] = value
#                 else:
#                     projected_value = int(value + ((items['annual_growth_rate'] * (year - base_year)) * (value / items['total_p7'])))
#                     output_year[village_id][year] = projected_value

#     print(f"Output years Range {output_year}")

#     # Aggregate population for each year
#     Air_last_output = {}
#     for year in full_years:
#         Air_last_output[year] = sum(values.get(year, 0) for values in output_year.values())

#     print(f"Air_last_output {Air_last_output}")
#     return Air_last_output
#####

    


def Geometric_d_values(subdistrict):
    subdistrict_new_ids = [x['id'] for x in subdistrict]

    # Fetch population data for given subdistricts
    subdistrict_2011 = list(Population_2011.objects.filter(
        subdistrict_code__in=subdistrict_new_ids
    ).values(
        'subdistrict_code', 'population_1951', 'population_1961', 
        'population_1971', 'population_1981', 'population_1991', 
        'population_2001', 'population_2011'
    ))

    g_values = []

    for sub in subdistrict_2011:
        p1, p2, p3, p4, p5, p6, p7 = (
            sub['population_1951'], sub['population_1961'], sub['population_1971'],
            sub['population_1981'], sub['population_1991'], sub['population_2001'],
            sub['population_2011']
        )

        # Calculate decadal population differences
        d1, d2, d3, d4, d5, d6 = [p2 - p1, p3 - p2, p4 - p3, p5 - p4, p6 - p5, p7 - p6]

        # Calculate decadal growth rates
        g1 = (d1 * 100) / p1 if p1 else 0
        g2 = (d2 * 100) / p2 if p2 else 0
        g3 = (d3 * 100) / p3 if p3 else 0
        g4 = (d4 * 100) / p4 if p4 else 0
        g5 = (d5 * 100) / p5 if p5 else 0
        g6 = (d6 * 100) / p6 if p6 else 0

        # Filter out non-positive growth rates
        valid_growth_values = [g for g in [g1, g2, g3, g4, g5, g6] if g > 0]

        if valid_growth_values:
            # Calculate geometric mean only for positive values
            product = 1
            for g in valid_growth_values:
                product *= g
            annual_growth_rate = math.pow(product, 1 / len(valid_growth_values))
        else:
            # Handle case where no valid growth rates exist
            annual_growth_rate = 0

        # Append results
        g_values.append({
            'subdistrict_code': sub['subdistrict_code'],
            'annual_growth_rate': round(annual_growth_rate, 4),  # Rounded for readability
            'total_p7': p7
        })

    return g_values


def Geometric_population_single_year(base_year,single_year,villages,subdistrict):
    output_year = {}
    ans = Geometric_d_values(subdistrict)
    print(f"ans {ans}")

    if single_year:
        target_year = int(single_year)
        base_year = int(base_year)
        n = (target_year-base_year)/10
        for village in villages: 
            print("village", village)
            village_id, value ,vill_sub_id= village['id'],village['population'],village['subDistrictId']
            items= next(item for item in ans if item['subdistrict_code'] == vill_sub_id)
            output_year[village_id] = {
                "2011": value,
                str(target_year): int(value * (math.pow((1 + (items['annual_growth_rate']/100)), n)))
            }
        print(f"output year_g {output_year}")    
        Air_last_output={}
        Air_last_output['2011']=sum([values['2011'] for values in output_year.values()])
        Air_last_output[target_year]=sum([values[str(target_year)] for values in output_year.values()])
        print('Air_last_output_g',Air_last_output)
    return Air_last_output

def Geometric_population_range(base_year, start_year, end_year, villages, subdistrict):
    output_year = {}
    ans = Geometric_d_values(subdistrict)
    print("ans-g", ans)
    base_year = int(base_year)
    start_year = int(start_year)
    end_year = int(end_year)

    # Compute the population projections for each village separately
    for village in villages:
        village_id = village['id']
        value = village['population']
        vill_sub_id = village['subDistrictId']
        items = next((item for item in ans if item['subdistrict_code'] == vill_sub_id), None)

        if items:
            output_year[village_id] = {"2011": value}  # Store base population for 2011
            for year in range(start_year, end_year + 1):
                n = (year - base_year) / 10
                projected_value =  int(value * (math.pow((1 + (items['annual_growth_rate']/100)), n)))
                output_year[village_id][year] = projected_value

    print(f"Output years Range {output_year}")

    # Now sum the populations across all villages to get the final output
    Air_last_output = {"2011": sum(values["2011"] for values in output_year.values())}
    for year in range(start_year, end_year + 1):
        Air_last_output[year] = sum(values[year] for values in output_year.values())

    print(f"Air_last_output {Air_last_output}")
    return Air_last_output
   

def Incremental_d_values(subdistrict):
    subdistrict_new_ids = [x['id'] for x in subdistrict]

    # Fetch population data for given subdistricts
    subdistrict_2011 = list(Population_2011.objects.filter(
        subdistrict_code__in=subdistrict_new_ids
    ).values(
        'subdistrict_code', 'population_1951', 'population_1961', 
        'population_1971', 'population_1981', 'population_1991', 
        'population_2001', 'population_2011'
    ))
    g_values = []
    for sub in subdistrict_2011:
        p1, p2, p3, p4, p5, p6, p7 = (
            sub['population_1951'], sub['population_1961'], sub['population_1971'],
            sub['population_1981'], sub['population_1991'], sub['population_2001'],
            sub['population_2011']
        )

        # Calculate decadal population differences
        d1, d2, d3, d4, d5, d6 = [p2 - p1, p3 - p2, p4 - p3, p5 - p4, p6 - p5, p7 - p6]

        d_mean = (d1+d2+d3+d4+d5+d6) / 6

        m1 = d2 - d1
        m2 = d3 - d2
        m3 = d4 - d3
        m4 = d5 - d4
        m5 = d6 - d5 
        m_mean = (m1+m2+m3+m4+m5) / 5

        g_values.append({
            'subdistrict_code': sub['subdistrict_code'],
            'd_mean': d_mean,
            'm_mean': m_mean,
            'total_p7': p7
        })

    return g_values



def Incremental_population_single_year(base_year,single_year,villages,subdistrict):
    output_year = {}
    ans = Incremental_d_values(subdistrict)
    print(f"ans_i {ans}")

    if single_year:
        target_year = int(single_year)
        base_year = int(base_year)
        n = (target_year-base_year)/10
        for village in villages: 
            print("village", village)
            village_id, value ,vill_sub_id= village['id'],village['population'],village['subDistrictId']
           
            items= next(item for item in ans if item['subdistrict_code'] == vill_sub_id)
            k = value / items['total_p7']
            output_year[village_id] = {
                "2011": value,
                str(target_year): int(value + k*n*items['d_mean'] + ((n*(n+1))*items['m_mean'] / 2)*k)
            }
        print(f"output year_g {output_year}")    
        Air_last_output={}
        Air_last_output['2011']=sum([values['2011'] for values in output_year.values()])
        Air_last_output[target_year]=sum([values[str(target_year)] for values in output_year.values()])
        print('Air_last_output_i',Air_last_output)
    return Air_last_output

def Incremental_population_range(base_year, start_year, end_year, villages, subdistrict):

    output_year = {}
    ans = Incremental_d_values(subdistrict)
    print("ans-g", ans)
    base_year = int(base_year)
    start_year = int(start_year)
    end_year = int(end_year)

    # Compute the population projections for each village separately
    for village in villages:
        village_id = village['id']
        value = village['population']
        vill_sub_id = village['subDistrictId']
        items = next((item for item in ans if item['subdistrict_code'] == vill_sub_id), None)
        k = value / items['total_p7']

        if items:
            output_year[village_id] = {"2011": value}  # Store base population for 2011
            for year in range(start_year, end_year + 1):
                n = (year - base_year) / 10

                projected_value = int(value + k*n*items['d_mean'] + ((n*(n+1))*items['m_mean'] / 2)*k)
                output_year[village_id][year] = projected_value

    print(f"Output years Range {output_year}")

    # Now sum the populations across all villages to get the final output
    Air_last_output = {"2011": sum(values["2011"] for values in output_year.values())}
    for year in range(start_year, end_year + 1):
        Air_last_output[year] = sum(values[year] for values in output_year.values())

    print(f"Air_last_output {Air_last_output}")
    return Air_last_output



def Exponential_d_values(subdistrict):
    subdistrict_new_ids = [x['id'] for x in subdistrict]
    base_year = 2011
    # Fetch population data for given subdistricts
    subdistrict_2011 = list(Population_2011.objects.filter(
        subdistrict_code__in=subdistrict_new_ids
    ).values(
        'subdistrict_code', 'population_1951', 'population_1961', 
        'population_1971', 'population_1981', 'population_1991', 
        'population_2001', 'population_2011'
    ))
    g_values = []
    for sub in subdistrict_2011:
        p1, p2, p3, p4, p5, p6, p7 = (
            sub['population_1951'], sub['population_1961'], sub['population_1971'],
            sub['population_1981'], sub['population_1991'], sub['population_2001'],
            sub['population_2011']
        )

        x1 =  1951-base_year
        x2 =   1961-base_year
        x3 =  1971-base_year
        x4 =  1981-base_year
        x5 = 1991-base_year
        x6 = 2001-base_year
        x7 = 2011-base_year

        y1 = math.log(p1,10)
        y2 = math.log(p2, 10)
        y3 = math.log(p3,10)
        y4 = math.log(p4, 10)
        y5 = math.log(p5,10)
        y6 = math.log(p6,10)
        y7 = math.log(p7,10)

        x_i_sum = x1+x2+x3+x4+x5+x6+x7
        y_i_sum = y1+y2+y3+y4+y5+y6+y7
        x_i_square_sum = x1**2 + x2**2 + x3**2 + x4**2 + x5**2 + x6**2 + x7**2
        x_y_prod_sum = x1*y1 + x2*y2 + x3*y3 + x4*y4 + x5*y5 + x6*y6 + x7*y7
        x_sum_prod_y_sum = x_i_sum * y_i_sum


        n = 7

        growth_rate = ((n*x_y_prod_sum) - x_sum_prod_y_sum) / (n*x_i_square_sum - (x_i_sum**2)) # r

        g_values.append({
            'subdistrict_code': sub['subdistrict_code'],
            'growth_rate': growth_rate,
            'total_p7': p7
        })
    return g_values    


def Exponential_population_single_year(base_year,single_year,villages,subdistrict):
    output_year = {}
    ans = Exponential_d_values(subdistrict)
    print(f"ans_i {ans}")

    if single_year:
        target_year = int(single_year)
        base_year = int(base_year)
        t = (target_year-base_year)
        for village in villages: 
            print("village", village)
            village_id, value ,vill_sub_id= village['id'],village['population'],village['subDistrictId']
           
            items= next(item for item in ans if item['subdistrict_code'] == vill_sub_id)
           
            output_year[village_id] = {
                "2011": value,
                str(target_year): int(value * math.exp(items['growth_rate']*t))
            }
        print(f"output year_g {output_year}")    
        Air_last_output={}
        Air_last_output['2011']=sum([values['2011'] for values in output_year.values()])
        Air_last_output[target_year]=sum([values[str(target_year)] for values in output_year.values()])
        print('Air_last_output_i',Air_last_output)
    return Air_last_output


def Exponential_population_range(base_year, start_year, end_year, villages, subdistrict):

    output_year = {}
    ans = Exponential_d_values(subdistrict)
    print("ans-g", ans)
    base_year = int(base_year)
    start_year = int(start_year)
    end_year = int(end_year)

    # Compute the population projections for each village separately
    for village in villages:
        village_id = village['id']
        value = village['population']
        vill_sub_id = village['subDistrictId']
        items = next((item for item in ans if item['subdistrict_code'] == vill_sub_id), None)
      

        if items:
            output_year[village_id] = {"2011": value}  # Store base population for 2011
            for year in range(start_year, end_year + 1):
                t = (year - base_year)

                projected_value = int(value * math.exp(items['growth_rate']*t))
                output_year[village_id][year] = projected_value

    print(f"Output years Range {output_year}")

    # Now sum the populations across all villages to get the final output
    Air_last_output = {"2011": sum(values["2011"] for values in output_year.values())}
    for year in range(start_year, end_year + 1):
        Air_last_output[year] = sum(values[year] for values in output_year.values())

    print(f"Air_last_output {Air_last_output}")
    return Air_last_output


def Demographic_population_single_year(base_year,single_year,villages,subdistrict,annual_birth_rate,annual_death_rate,annual_emigration_rate,annual_immigration_rate):
    output_year = {}
    if single_year:
        target_year = int(single_year)
        base_year = int(base_year)
        t = (target_year-base_year)
        for village in villages: 
            print("village", village)
            village_id, value ,vill_sub_id= village['id'],village['population'],village['subDistrictId']
            output_year[village_id] = {
                "2011": value,
                str(target_year): int( value + (value * t * (annual_birth_rate-annual_death_rate)) + (t * (annual_emigration_rate - annual_immigration_rate)))
            }
        print(f"output year {output_year}")
        Air_last_output={}
        Air_last_output['2011']=sum([values['2011'] for values in output_year.values()])
        Air_last_output[target_year]=sum([values[str(target_year)] for values in output_year.values()])
        print('Air_last_output_i',Air_last_output)
    return Air_last_output


def Demographic_population_range(base_year, start_year, end_year, villages, subdistrict, annual_birth_rate, annual_death_rate, annual_emigration_rate, annual_immigration_rate):
    output_year = {}
    base_year = int(base_year)
    start_year = int(start_year)
    end_year = int(end_year)

    for village in villages:
        village_id = village['id']
        value = village['population']
        output_year[village_id] = {"2011": value}  # Store base population for 2011
        for year in range(start_year, end_year + 1):
            t = (year - base_year)
            value + (value * t * (annual_birth_rate-annual_death_rate)) + (t * (annual_emigration_rate - annual_immigration_rate))
            projected_value = int(value + (value * t * (annual_birth_rate-annual_death_rate)) + (t * (annual_emigration_rate - annual_immigration_rate)))
            output_year[village_id][year] = projected_value

    Air_last_output = {"2011": sum(values["2011"] for values in output_year.values())}
    for year in range(start_year, end_year + 1):
        Air_last_output[year] = sum(values[year] for values in output_year.values())

    return Air_last_output
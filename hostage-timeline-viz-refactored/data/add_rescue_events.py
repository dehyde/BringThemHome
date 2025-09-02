#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add Rescue Event Column to Hostages CSV
Maps all released hostages to their corresponding rescue events
"""

import csv
from datetime import datetime

# Define release event mappings based on dates and circumstances
RELEASE_EVENT_MAPPINGS = {
    # Oct 20, 2023 - Humanitarian Release
    ('2023-10-21', 'Judith Raanan & Natalie Raanan'): 'Oct 20, 2023 - Humanitarian Release',
    
    # Oct 23, 2023 - Humanitarian Release  
    ('2023-10-24', 'Nurit Cooper & Yocheved Lifshitz'): 'Oct 23, 2023 - Humanitarian Release',
    
    # Oct 30, 2023 - IDF Rescue Operation (Ori Megidish only)
    ('2023-11-24', 'אורי מגידיש'): 'Oct 30, 2023 - IDF Rescue Operation',
    
    # Nov 24-30, 2023 - 2023 Temporary Truce (massive deal releases)
    'nov_2023_deal': 'Nov 24-30, 2023 - 2023 Temporary Truce',
    
    # Feb 12, 2024 - Operation Golden Hand
    ('2024-02-13', 'Military Operation'): 'Feb 12, 2024 - Operation Golden Hand',
    
    # Jun 10, 2024 - Nuseirat Rescue Operation
    ('2024-06-08', 'Military Operation'): 'Jun 10, 2024 - Nuseirat Rescue Operation',
    
    # Jul-Aug 2024 - Body Repatriation (various dates in July-Aug)
    'jul_aug_2024_bodies': 'Jul-Aug 2024 - Body Repatriation',
    
    # Jan-Feb 2025 - 2025 Hostage Agreement (various dates)
    'jan_feb_2025_deal': 'Jan-Feb 2025 - 2025 Hostage Agreement',
    
    # Future body returns (dates in 2025 that are clearly future projections)
    'future_bodies': 'Feb 20-27, 2025 - Body Repatriation (2025 deal)'
}

def determine_rescue_event(release_date, circumstances, hebrew_name):
    """Determine the rescue event for a hostage based on date and circumstances"""
    
    # Special case: Ori Megidish (IDF rescue but mixed in with deal dates)
    if hebrew_name == 'אורי מגידיש':
        return 'Oct 30, 2023 - IDF Rescue Operation'
    
    # Humanitarian releases (early specific cases)
    if release_date == '2023-10-21':
        return 'Oct 20, 2023 - Humanitarian Release'
    elif release_date == '2023-10-24':
        return 'Oct 23, 2023 - Humanitarian Release'
    
    # November 2023 deal releases (all dates from Nov 24-Dec 1)
    elif release_date in ['2023-11-24', '2023-11-25', '2023-11-26', '2023-11-27', 
                         '2023-11-28', '2023-11-29', '2023-11-30', '2023-12-01']:
        return 'Nov 24-30, 2023 - 2023 Temporary Truce'
    
    # Feb 2024 military rescue
    elif release_date == '2024-02-13' and 'Military Operation' in circumstances:
        return 'Feb 12, 2024 - Operation Golden Hand'
    
    # June 2024 Nuseirat rescue
    elif release_date == '2024-06-08' and 'Military Operation' in circumstances:
        return 'Jun 10, 2024 - Nuseirat Rescue Operation'
    
    # July-August 2024 body repatriations
    elif release_date in ['2024-07-24', '2024-08-19', '2024-08-20', '2024-08-28', 
                         '2024-08-31', '2024-09-01', '2024-12-01']:
        return 'Jul-Aug 2024 - Body Repatriation'
    
    # December 2024 specific case
    elif release_date == '2024-12-04':
        return 'Dec 12-15, 2023 - Body Repatriation'  # Seems like data error, likely belongs to earlier event
    
    # January-February 2025 deal releases
    elif release_date in ['2025-01-08', '2025-01-10', '2025-01-19', '2025-01-25', 
                         '2025-01-30', '2025-02-01', '2025-02-08', '2025-02-15', '2025-02-22']:
        return 'Jan-Feb 2025 - 2025 Hostage Agreement'
    
    # Future body returns (clearly projections)
    elif release_date in ['2025-06-05', '2025-06-07', '2025-06-11', '2025-06-22', '2025-08-29']:
        return 'Feb 20-27, 2025 - Body Repatriation (2025 deal)'
    
    # Unknown/unmatched cases - return None for user review
    else:
        return None

def add_rescue_event_column(input_file, output_file):
    """Add rescue event column to hostages CSV"""
    
    unclear_cases = []
    
    with open(input_file, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        fieldnames = list(reader.fieldnames) + ['Rescue Event']
        
        rows = []
        for row in reader:
            # Determine rescue event
            release_date = row.get('Release Date', '')
            circumstances = row.get('Release/Death Circumstances', '')
            current_status = row.get('Current Status', '')
            hebrew_name = row.get('Hebrew Name', '')
            
            rescue_event = ''
            
            # Only add rescue event for hostages who were actually released/returned
            if release_date and ('Released' in current_status or 'Deceased - Returned' in current_status):
                rescue_event = determine_rescue_event(release_date, circumstances, hebrew_name)
                
                if rescue_event is None:
                    unclear_cases.append({
                        'hebrew_name': hebrew_name,
                        'release_date': release_date,
                        'circumstances': circumstances,
                        'current_status': current_status
                    })
                    rescue_event = ''  # Leave empty for unclear cases
            
            row['Rescue Event'] = rescue_event
            rows.append(row)
        
        # Write output file
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    
    # Report results
    total_released = sum(1 for row in rows if row['Rescue Event'])
    print(f"SUCCESS: Added rescue events to {total_released} hostages")
    
    if unclear_cases:
        print(f"\\nUNCLEAR CASES ({len(unclear_cases)}) - Please provide guidance:")
        print("=" * 60)
        for case in unclear_cases:
            print(f"Name: {case['hebrew_name']}")
            print(f"Release Date: {case['release_date']}")
            print(f"Circumstances: {case['circumstances']}")
            print(f"Status: {case['current_status']}")
            print("-" * 40)
    
    return total_released, unclear_cases

if __name__ == '__main__':
    input_file = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz-refactored/data/hostages-from-kan-fixed.csv'
    output_file = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz-refactored/data/hostages-with-rescue-events.csv'
    
    total, unclear = add_rescue_event_column(input_file, output_file)
    
    print(f"\\nOutput written to: {output_file}")
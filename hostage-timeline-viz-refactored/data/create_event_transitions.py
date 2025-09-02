#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create Event-Based Hostage Transitions
Maps release events to hostages and creates event-based transition dates
"""

import csv
import re
from datetime import datetime
from collections import defaultdict

# Release event definitions from the CSV
RELEASE_EVENTS = [
    {
        'date_range': 'Oct 20, 2023',
        'event_title': 'Humanitarian Release',
        'event_type': 'Unilateral Release',
        'event_order': 1,
        'individuals': ['Judith Raanan', 'Natalie Raanan']
    },
    {
        'date_range': 'Oct 23, 2023', 
        'event_title': 'Humanitarian Release',
        'event_type': 'Unilateral Release',
        'event_order': 2,
        'individuals': ['Nurit Cooper', 'Yocheved Lifshitz']
    },
    {
        'date_range': 'Oct 30, 2023',
        'event_title': 'IDF Rescue Operation', 
        'event_type': 'Military Rescue',
        'event_order': 3,
        'individuals': ['Ori Megidish']
    },
    {
        'date_range': 'Nov 15-29, 2023',
        'event_title': 'Body Repatriation',
        'event_type': 'Body Repatriation', 
        'event_order': 4,
        'individuals': ['Yehudit Weiss', 'Noa Marciano', 'Ofir Tzarfati']
    },
    {
        'date_range': 'Nov 24-30, 2023',
        'event_title': '2023 Temporary Truce',
        'event_type': 'Negotiated Release',
        'event_order': 5,
        'individuals': [
            # Extracted specific names from the complex entry
            'Shani Goren', 'Nili Margalit', 'Ilana Gritzewsky Kimchi', 
            'Sapir Cohen', 'Bilal Ziyadne', 'Aisha Ziyadne', 
            'Mia Schem', 'Amit Soussana'
            # Note: Plus family groups that need separate parsing
        ]
    },
    {
        'date_range': 'Nov 29, 2023',
        'event_title': 'Unilateral Release',
        'event_type': 'Unilateral Release',
        'event_order': 6, 
        'individuals': ['Roni Krivoi', 'Yelena Trufanova', 'Irena Tati']
    },
    {
        'date_range': 'Dec 12-15, 2023',
        'event_title': 'Body Repatriation',
        'event_type': 'Body Repatriation',
        'event_order': 7,
        'individuals': ['Eden Zecharya', 'Ziv Dado', 'Elia Toledano', 'Nik Beizer', 'Ron Sherman']
    },
    {
        'date_range': 'Feb 12, 2024',
        'event_title': 'Operation Golden Hand',
        'event_type': 'Military Rescue', 
        'event_order': 8,
        'individuals': ['Fernando Simon Marman', 'Louis Har']
    },
    {
        'date_range': 'May 17-23, 2024',
        'event_title': 'Body Repatriation',
        'event_type': 'Body Repatriation',
        'event_order': 9,
        'individuals': ['Amit Buskila', 'Shani Louk', 'Ron Binyamin', 'Itzhak Gelernter', 
                       'Orión Hernández Radoux', 'Hanan Yablonka', 'Michel Nisenbaum']
    },
    {
        'date_range': 'Jun 10, 2024',
        'event_title': 'Nuseirat Rescue Operation',
        'event_type': 'Military Rescue',
        'event_order': 10,
        'individuals': ['Noa Argamani', 'Almog Meir', 'Andrey Kozlov', 'Shlomi Ziv']
    },
    {
        'date_range': 'Jul-Aug 2024',
        'event_title': 'Body Repatriation',
        'event_type': 'Body Repatriation',
        'event_order': 11,
        'individuals': ['Maya Goren', 'Oren Gildin', 'Tomer Ahimas', 'Kiril Brodski',
                       'Ravid Aryeh Katz', 'Yagev Buchshtab', 'Alexander Dancyg', 
                       'Avraham Munder', 'Yoram Metzger', 'Nadav Popplewell', 
                       'Haim Perry', 'Ori Danino', 'Alexander Lobanov', 'Almog Sarusi',
                       'Hersh Goldberg-Polin', 'Carmel Gat', 'Eden Yerushalmi']
    },
    {
        'date_range': 'Jan-Feb 2025',
        'event_title': '2025 Hostage Agreement',
        'event_type': 'Negotiated Release',
        'event_order': 12,
        'individuals': ['Romi Gonen', 'Emily Damari', 'Doron Steinbrecher', 'Naama Levy',
                       'Liri Albag', 'Daniella Gilboa', 'Karina Ariev', 'Arbel Yehoud',
                       'Agam Berger', 'Gadi Moshe', 'Keith Siegel', 'Ofer Kalderon',
                       'Yarden Bibas', 'Ohad Ben Ami', 'Eli Sharabi', 'Or Levy', 
                       'Alexander Troufanov', 'Yair Horn', 'Sagui Dekel-Chen',
                       'Omer Wenkert', 'Omer Shem-Tov', 'Eliya Cohen', 'Tal Shoham',
                       'Avera Mengistu', 'Hisham al-Sayed']
    },
    {
        'date_range': 'Feb 20-27, 2025',
        'event_title': 'Body Repatriation (2025 deal)',
        'event_type': 'Body Repatriation',
        'event_order': 13,
        'individuals': ['Oded Lifshitz', 'Ariel Bibas', 'Kfir Bibas', 'Shiri Bibas',
                       'Itzik Elgart', 'Tsahi Idan', 'Ohad Yahalomi', 'Shlomo Mansour']
    }
]

# English to Hebrew name mappings (verified from hostages CSV)
NAME_MAPPINGS = {
    'Noa Argamani': 'נועה ארגמני',
    'Eden Yerushalmi': 'עדן ירושלמי', 
    'Shani Louk': 'שני לוק',
    'Noa Marciano': 'נועה מרציאנו',
    'Eden Zecharya': 'עדן זכריה',
    'Shani Goren': 'שני גורן',
    'Carmel Gat': 'כרמל גת',
    'Hersh Goldberg-Polin': 'הירש גולדברג-פולין',
    'Almog Meir': 'אלמוג מאיר',
    'Andrey Kozlov': 'אנדריי קוזלוב', 
    'Shlomi Ziv': 'שלומי זיו',
    'Ori Megidish': 'אורי מגידיש',
    'Judith Raanan': 'יהודית ראנן',
    'Natalie Raanan': 'נטלי ראנן',
    'Romi Gonen': 'רומי גונן',
    'Emily Damari': 'אמילי דמרי', 
    'Doron Steinbrecher': 'דורון שטיינברכר',
    'Naama Levy': 'נעמה לוי',
    'Liri Albag': 'לירי אלבג',
    'Daniella Gilboa': 'דניאלה גלבוע',
    'Karina Ariev': 'קרינה אריב',
    'Arbel Yehoud': 'ארבל יהוד',
    'Agam Berger': 'אגם ברגר'
    # Add more mappings as needed...
}

def load_hostages_csv(filepath):
    """Load and parse the hostages CSV file"""
    hostages = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            hostages.append(row)
    return hostages

def find_hostage_by_name(hostages, english_name):
    """Find a hostage record by English name (using Hebrew mapping)"""
    hebrew_name = NAME_MAPPINGS.get(english_name)
    if not hebrew_name:
        return None
    
    for hostage in hostages:
        if hostage['Hebrew Name'] == hebrew_name:
            return hostage
    
    return None

def create_event_transitions(hostages_filepath, output_filepath):
    """Create event-based transitions mapping"""
    
    # Load hostages data
    hostages = load_hostages_csv(hostages_filepath)
    
    # Create the transition mapping
    event_transitions = []
    
    print("CREATING EVENT TRANSITIONS:")
    print("=" * 60)
    
    for event in RELEASE_EVENTS:
        event_order = event['event_order']
        event_type = event['event_type'] 
        event_title = event['event_title']
        date_range = event['date_range']
        
        print(f"\nEvent {event_order}: {event_title} ({date_range})")
        print(f"Type: {event_type}")
        
        found_count = 0
        for individual_name in event['individuals']:
            hostage = find_hostage_by_name(hostages, individual_name)
            
            if hostage:
                hebrew_name = hostage['Hebrew Name']
                current_status = hostage['Current Status']
                
                event_transitions.append({
                    'hebrew_name': hebrew_name,
                    'english_name': individual_name,
                    'event_order': event_order,
                    'event_title': event_title,
                    'event_type': event_type,
                    'date_range': date_range,
                    'current_status': current_status
                })
                
                print(f"  ✓ {hebrew_name} ({individual_name}) - {current_status}")
                found_count += 1
            else:
                print(f"  ✗ {individual_name} - NOT FOUND in hostages CSV")
        
        print(f"  Found: {found_count}/{len(event['individuals'])} hostages")
    
    # Write the output CSV
    with open(output_filepath, 'w', encoding='utf-8', newline='') as f:
        fieldnames = ['hebrew_name', 'english_name', 'event_order', 'event_title', 
                     'event_type', 'date_range', 'current_status']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        for transition in event_transitions:
            writer.writerow(transition)
    
    print(f"\n\nSUMMARY:")
    print(f"Total transitions created: {len(event_transitions)}")
    print(f"Output written to: {output_filepath}")
    
    # Group by event type for analysis
    by_type = defaultdict(int)
    for t in event_transitions:
        by_type[t['event_type']] += 1
    
    print(f"\nBy event type:")
    for event_type, count in by_type.items():
        print(f"  {event_type}: {count}")
    
    return event_transitions

if __name__ == '__main__':
    hostages_csv = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz-refactored/data/hostages-from-kan-fixed.csv'
    output_csv = '/Users/tombar-gal/BringThemHome/hostage-timeline-viz-refactored/data/event_transitions.csv'
    
    transitions = create_event_transitions(hostages_csv, output_csv)
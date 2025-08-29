import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict

print("=== CREATING HOSTAGE TIMELINE VISUALIZATION ===")

# Load data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

# Convert dates
start_date = datetime(2023, 10, 7)
end_date = datetime.now()

# Define convergence points with their positions on timeline
convergence_points = {
    'Kidnapped': {'date': start_date, 'y_pos': 0, 'hostages': [], 'color': 'red'},
    'Died Before/During Kidnapping': {'date': start_date, 'y_pos': 0.1, 'hostages': [], 'color': 'darkred'},
    'Died in Captivity - Killed by Hamas': {'date': datetime(2024, 5, 1), 'y_pos': 0.4, 'hostages': [], 'color': 'maroon'},
    'Still in Captivity': {'date': end_date, 'y_pos': 0.8, 'hostages': [], 'color': 'orange'},
    'Released via deal': {'date': datetime(2023, 11, 24), 'y_pos': 0.9, 'hostages': [], 'color': 'green'},
    'Returned in Military Operation': {'date': datetime(2024, 6, 8), 'y_pos': 0.95, 'hostages': [], 'color': 'blue'},
    'Returned in Military Operation - Body': {'date': datetime(2025, 1, 15), 'y_pos': 1.0, 'hostages': [], 'color': 'purple'}
}

# Status to color mapping
status_colors = {
    'Held in Gaza': 'orange',
    'Released': 'green', 
    'Deceased': 'darkred',
    'Deceased - Returned': 'purple',
    'Unknown': 'gray'
}

# Process each hostage
hostage_paths = []

for idx, row in df.iterrows():
    name = row['Hebrew Name']
    status = row['Current Status']
    death_context = str(row.get('Context of Death', ''))
    death_date = row.get('Date of Death')
    release_date = row.get('Release Date') 
    release_circumstances = str(row.get('Release/Death Circumstances', ''))
    
    # Create path for this hostage
    path = {
        'name': name,
        'status': status,
        'color': status_colors.get(status, 'gray'),
        'events': [{'point': 'Kidnapped', 'date': start_date, 'y': 0}]
    }
    
    # Add death event if applicable
    if death_context in ['Died Before/During Kidnapping']:
        convergence_points['Died Before/During Kidnapping']['hostages'].append(name)
        path['events'].append({
            'point': 'Died Before/During Kidnapping', 
            'date': start_date, 
            'y': 0.1
        })
    elif death_context in ['Died in Captivity - Killed by Hamas']:
        convergence_points['Died in Captivity - Killed by Hamas']['hostages'].append(name)
        # Use death date if available, otherwise estimate
        death_dt = datetime(2024, 5, 1)  # Default estimate
        if pd.notna(death_date):
            try:
                death_dt = datetime.strptime(str(death_date), '%Y-%m-%d')
            except:
                pass
        path['events'].append({
            'point': 'Died in Captivity - Killed by Hamas',
            'date': death_dt,
            'y': 0.4
        })
    
    # Add release/return event
    if status == 'Held in Gaza':
        convergence_points['Still in Captivity']['hostages'].append(name)
        path['events'].append({
            'point': 'Still in Captivity',
            'date': end_date,
            'y': 0.8
        })
        path['fade'] = True
        
    elif status == 'Released':
        if 'deal' in release_circumstances.lower():
            convergence_points['Released via deal']['hostages'].append(name)
            # Use release date if available
            release_dt = datetime(2023, 11, 24)  # Default
            if pd.notna(release_date):
                try:
                    release_dt = datetime.strptime(str(release_date), '%Y-%m-%d')
                except:
                    pass
            path['events'].append({
                'point': 'Released via deal',
                'date': release_dt,
                'y': 0.9
            })
        else:
            convergence_points['Returned in Military Operation']['hostages'].append(name)
            release_dt = datetime(2024, 6, 8)  # Default
            if pd.notna(release_date):
                try:
                    release_dt = datetime.strptime(str(release_date), '%Y-%m-%d')
                except:
                    pass
            path['events'].append({
                'point': 'Returned in Military Operation',
                'date': release_dt,
                'y': 0.95
            })
    
    elif status == 'Deceased - Returned':
        convergence_points['Returned in Military Operation - Body']['hostages'].append(name)
        # Use release date if available
        return_dt = datetime(2025, 1, 15)  # Default
        if pd.notna(release_date):
            try:
                return_dt = datetime.strptime(str(release_date), '%Y-%m-%d')
            except:
                pass
        path['events'].append({
            'point': 'Returned in Military Operation - Body',
            'date': return_dt,
            'y': 1.0
        })
    
    hostage_paths.append(path)

# Create the visualization
fig, ax = plt.subplots(figsize=(16, 20))

print(f"Creating visualization for {len(hostage_paths)} hostages...")

# Draw lines for each hostage
x_positions = np.linspace(0, 10, len(hostage_paths))

for i, path in enumerate(hostage_paths):
    x = x_positions[i]
    
    # Extract y positions for this path
    y_coords = [event['y'] for event in path['events']]
    
    # Draw the line
    line_alpha = 0.3 if path.get('fade', False) else 0.7
    ax.plot([x, x], [0, max(y_coords)], 
           color=path['color'], alpha=line_alpha, linewidth=0.8)
    
    # Add dots at convergence points
    for event in path['events']:
        ax.scatter(x, event['y'], color=path['color'], s=10, alpha=0.8, zorder=10)

# Add convergence point labels and emphasis
for point_name, point_data in convergence_points.items():
    if point_data['hostages']:  # Only show points that have hostages
        y = point_data['y_pos']
        count = len(point_data['hostages'])
        
        # Draw horizontal line across all hostages at this convergence point
        ax.axhline(y=y, color=point_data['color'], alpha=0.5, linewidth=2, zorder=5)
        
        # Add label
        ax.text(10.5, y, f"{point_name}\n({count} hostages)", 
               fontsize=10, fontweight='bold', 
               verticalalignment='center',
               bbox=dict(boxstyle="round,pad=0.3", 
                        facecolor=point_data['color'], alpha=0.2))

# Formatting
ax.set_xlim(-0.5, 13)
ax.set_ylim(-0.05, 1.1)
ax.set_ylabel('Timeline Progress', fontsize=14, fontweight='bold')
ax.set_title('October 7 Hostages: Paths of Fate\nFrom Kidnapping to Resolution', 
             fontsize=18, fontweight='bold', pad=20)

# Remove x-axis as it's just individual hostage positions
ax.set_xticks([])
ax.set_xlabel('Each line represents one hostage', fontsize=12, style='italic')

# Add timeline dates on right side
timeline_dates = [
    (0, 'Oct 7, 2023\nKidnapping'),
    (0.1, 'Oct 7, 2023\nImmediate Deaths'),
    (0.4, 'Mid-2024\nKilled in Captivity'),
    (0.8, 'Present\nStill Held'),
    (0.9, 'Nov 2023\nFirst Releases'),
    (0.95, 'Jun 2024\nMilitary Rescues'),
    (1.0, 'Early 2025\nBody Returns')
]

for y, label in timeline_dates:
    ax.text(12, y, label, fontsize=9, verticalalignment='center',
           bbox=dict(boxstyle="round,pad=0.2", facecolor='lightgray', alpha=0.3))

# Add legend for colors
legend_elements = []
for status, color in status_colors.items():
    count = len(df[df['Current Status'] == status])
    legend_elements.append(plt.Line2D([0], [0], color=color, lw=3, 
                                    label=f'{status} ({count})'))

ax.legend(handles=legend_elements, loc='upper left', 
         bbox_to_anchor=(0, 1), fontsize=10)

# Add grid
ax.grid(True, alpha=0.3, axis='y')

plt.tight_layout()
plt.savefig('hostage_timeline_convergence.png', dpi=300, bbox_inches='tight')
plt.show()

# Print statistics
print("\n=== CONVERGENCE POINT STATISTICS ===")
for point_name, point_data in convergence_points.items():
    count = len(point_data['hostages'])
    if count > 0:
        print(f"{point_name}: {count} hostages")

print(f"\n=== VISUALIZATION COMPLETE ===")
print(f"Saved as: hostage_timeline_convergence.png")
print(f"Total hostages visualized: {len(hostage_paths)}")
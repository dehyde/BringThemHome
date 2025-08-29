import pandas as pd
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
from datetime import datetime
import numpy as np

print("=== CREATING HOSTAGE TIMELINE VISUALIZATION ===")

# Load data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

# Define convergence points and their vertical positions
convergence_points = {
    'Kidnapped': {'y': 0.0, 'hostages': [], 'color': 'red'},
    'Died Before/During Kidnapping': {'y': 0.15, 'hostages': [], 'color': 'darkred'},
    'Died in Captivity': {'y': 0.4, 'hostages': [], 'color': 'maroon'},
    'Still in Captivity': {'y': 0.7, 'hostages': [], 'color': 'orange'},
    'Released via Deal': {'y': 0.85, 'hostages': [], 'color': 'green'},
    'Military Rescue': {'y': 0.92, 'hostages': [], 'color': 'blue'}, 
    'Body Returned': {'y': 1.0, 'hostages': [], 'color': 'purple'}
}

# Status colors
status_colors = {
    'Held in Gaza': 'orange',
    'Released': 'green', 
    'Deceased': 'darkred',
    'Deceased - Returned': 'purple',
    'Unknown': 'gray'
}

# Process hostages and assign to convergence points
hostage_data = []

for idx, row in df.iterrows():
    name = row['Hebrew Name']
    status = row['Current Status']
    death_context = str(row.get('Context of Death', ''))
    release_circumstances = str(row.get('Release/Death Circumstances', ''))
    
    # Everyone starts at kidnapping
    path_points = [0.0]  # Kidnapped
    convergence_points['Kidnapped']['hostages'].append(name)
    
    # Determine death convergence
    if 'Died Before/During Kidnapping' in death_context:
        path_points.append(0.15)
        convergence_points['Died Before/During Kidnapping']['hostages'].append(name)
    elif 'Died in Captivity' in death_context:
        path_points.append(0.4)
        convergence_points['Died in Captivity']['hostages'].append(name)
    
    # Determine final convergence
    if status == 'Held in Gaza':
        path_points.append(0.7)
        convergence_points['Still in Captivity']['hostages'].append(name)
        fade = True
    elif status == 'Released':
        if 'deal' in release_circumstances.lower():
            path_points.append(0.85)
            convergence_points['Released via Deal']['hostages'].append(name)
        else:
            path_points.append(0.92)
            convergence_points['Military Rescue']['hostages'].append(name)
        fade = False
    elif status == 'Deceased - Returned':
        path_points.append(1.0)
        convergence_points['Body Returned']['hostages'].append(name)
        fade = False
    elif status == 'Deceased':
        # Already handled in death context above
        fade = False
    else:  # Unknown
        path_points.append(0.7)
        convergence_points['Still in Captivity']['hostages'].append(name)
        fade = True
    
    hostage_data.append({
        'name': name,
        'status': status,
        'path': path_points,
        'color': status_colors.get(status, 'gray'),
        'fade': fade
    })

print(f"Processing {len(hostage_data)} hostages...")

# Create visualization
fig, ax = plt.subplots(figsize=(16, 20))

# Generate x positions for hostages
num_hostages = len(hostage_data)
x_positions = np.linspace(0.5, 9.5, num_hostages)

# Draw lines for each hostage
for i, hostage in enumerate(hostage_data):
    x = x_positions[i]
    path = hostage['path']
    color = hostage['color']
    alpha = 0.3 if hostage.get('fade', False) else 0.6
    
    # Draw vertical line through all convergence points this hostage hits
    if len(path) > 1:
        ax.plot([x, x], [min(path), max(path)], 
               color=color, alpha=alpha, linewidth=1.5, solid_capstyle='round')
    
    # Add dots at each convergence point
    for y in path:
        ax.scatter(x, y, color=color, s=15, alpha=min(alpha + 0.3, 1.0), zorder=10)

# Add convergence point indicators
for point_name, point_data in convergence_points.items():
    if point_data['hostages']:  # Only show points with hostages
        y = point_data['y']
        count = len(point_data['hostages'])
        
        # Draw horizontal convergence line
        ax.axhline(y=y, color=point_data['color'], alpha=0.4, linewidth=3, zorder=5)
        
        # Add label with count
        ax.text(10.2, y, f"{point_name}\n{count} hostages", 
               fontsize=11, fontweight='bold', 
               verticalalignment='center',
               bbox=dict(boxstyle="round,pad=0.4", 
                        facecolor=point_data['color'], alpha=0.2))

# Formatting
ax.set_xlim(0, 13)
ax.set_ylim(-0.05, 1.1)
ax.set_ylabel('Timeline from Kidnapping to Resolution', fontsize=14, fontweight='bold')
ax.set_title('October 7 Hostages: Convergent Paths of Fate\nEach vertical line represents one hostage\'s journey', 
             fontsize=16, fontweight='bold', pad=20)

# Timeline labels on left
timeline_labels = [
    (0.0, 'Oct 7, 2023\nKIDNAPPED'),
    (0.15, 'Oct 7, 2023\nKILLED IMMEDIATELY'),
    (0.4, 'During Captivity\nKILLED BY CAPTORS'),
    (0.7, 'Present Day\nSTILL HELD'),
    (0.85, 'Nov 2023 - Jan 2025\nRELEASED IN DEALS'),
    (0.92, '2024-2025\nMILITARY RESCUES'),
    (1.0, '2024-2025\nBODIES RETURNED')
]

for y, label in timeline_labels:
    ax.text(-0.3, y, label, fontsize=10, fontweight='bold',
           verticalalignment='center', horizontalalignment='right',
           bbox=dict(boxstyle="round,pad=0.3", facecolor='lightblue', alpha=0.3))

# Remove x-axis labels
ax.set_xticks([])
ax.set_xlabel('Each line represents one of the 240 hostages taken on October 7, 2023', 
             fontsize=12, style='italic', fontweight='bold')

# Add legend
legend_elements = []
for status, color in status_colors.items():
    count = len(df[df['Current Status'] == status])
    if count > 0:
        legend_elements.append(plt.Line2D([0], [0], color=color, lw=4, 
                                        label=f'{status} ({count})'))

ax.legend(handles=legend_elements, loc='upper left', fontsize=11, framealpha=0.9)

# Add grid
ax.grid(True, alpha=0.2, axis='y', linestyle='--')

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['bottom'].set_visible(False)

plt.tight_layout()
plt.savefig('hostage_convergence_timeline.png', dpi=300, bbox_inches='tight', 
           facecolor='white', edgecolor='none')

print("\n=== CONVERGENCE STATISTICS ===")
for point_name, point_data in convergence_points.items():
    count = len(point_data['hostages'])
    if count > 0:
        percentage = (count / len(df)) * 100
        print(f"{point_name}: {count} hostages ({percentage:.1f}%)")

print(f"\n=== VISUALIZATION SAVED ===")
print(f"File: hostage_convergence_timeline.png")
print(f"Hostages visualized: {len(hostage_data)}")
print("Each vertical line shows one hostage's journey from kidnapping to their current fate")
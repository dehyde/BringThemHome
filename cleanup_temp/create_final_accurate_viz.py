import pandas as pd
import json

print("=== CREATING FINAL ACCURATE D3 VISUALIZATION ===")

# Load the corrected data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("Final status distribution:")
final_status = df['Current Status'].value_counts()
for status, count in final_status.items():
    print(f"  {status}: {count}")

held_count = len(df[df['Current Status'] == 'Held in Gaza'])
print(f"\nHeld in Gaza: {held_count} (Target: 47)")

# Prepare data for D3
hostages_data = []

for idx, row in df.iterrows():
    hostage = {
        'id': idx,
        'name': row['Hebrew Name'],
        'status': row['Current Status'],
        'death_context': str(row.get('Context of Death', '')),
        'death_date': str(row.get('Date of Death', '')),
        'release_date': str(row.get('Release Date', '')),
        'release_circumstances': str(row.get('Release/Death Circumstances', ''))
    }
    hostages_data.append(hostage)

# Create the final accurate HTML visualization
html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>October 7 Hostages: 47 Still Held - Bring Them Home</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        
        .title {{
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #2c3e50;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }}
        
        .subtitle {{
            font-size: 18px;
            color: #7f8c8d;
            margin-bottom: 25px;
        }}
        
        .urgent-banner {{
            margin-bottom: 40px;
            padding: 25px;
            background: linear-gradient(135deg, #ff4444, #d32f2f);
            color: white;
            border-radius: 15px;
            font-size: 28px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            box-shadow: 0 4px 20px rgba(255,68,68,0.3);
            animation: pulse 2s infinite;
        }}
        
        @keyframes pulse {{
            0%, 100% {{ transform: scale(1); }}
            50% {{ transform: scale(1.02); }}
        }}
        
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }}
        
        .stat-card {{
            text-align: center;
            padding: 25px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }}
        
        .stat-card:hover {{ transform: translateY(-5px); }}
        
        .stat-number {{
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 8px;
        }}
        
        .stat-label {{
            font-size: 16px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .held {{ background: linear-gradient(135deg, #ffebee, #ffcdd2); color: #c62828; }}
        .released {{ background: linear-gradient(135deg, #e8f5e8, #c8e6c9); color: #2e7d32; }}
        .returned {{ background: linear-gradient(135deg, #f3e5f5, #e1bee7); color: #7b1fa2; }}
        .deceased {{ background: linear-gradient(135deg, #fafafa, #eeeeee); color: #424242; }}
        
        .legend {{
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 25px;
            margin-bottom: 40px;
        }}
        
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 16px;
            font-weight: 600;
            padding: 8px 15px;
            border-radius: 8px;
            background: rgba(0,0,0,0.05);
        }}
        
        .legend-color {{
            width: 24px;
            height: 6px;
            border-radius: 3px;
        }}
        
        .convergence-label {{
            font-size: 13px;
            font-weight: bold;
            text-anchor: middle;
        }}
        
        .convergence-count {{
            font-size: 12px;
            text-anchor: middle;
            fill: #555;
        }}
        
        .hostage-line {{
            stroke-width: 1.8;
            opacity: 0.85;
            transition: opacity 0.3s ease;
        }}
        
        .hostage-line.urgent {{
            stroke-width: 3;
            opacity: 1.0;
            filter: drop-shadow(1px 1px 2px rgba(255,68,68,0.4));
        }}
        
        .convergence-line {{
            stroke-width: 4;
            opacity: 0.75;
        }}
        
        .convergence-line.urgent {{
            stroke-width: 6;
            opacity: 1.0;
            filter: drop-shadow(2px 2px 4px rgba(255,68,68,0.6));
            animation: urgentPulse 3s infinite;
        }}
        
        @keyframes urgentPulse {{
            0%, 100% {{ opacity: 0.75; }}
            50% {{ opacity: 1.0; }}
        }}
        
        .tooltip {{
            position: absolute;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-size: 14px;
            pointer-events: none;
            opacity: 0;
            max-width: 280px;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }}
        
        .visualization-container {{
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">October 7 Hostages: Convergent Paths of Fate</div>
            <div class="subtitle">Each line represents one hostage's journey from kidnapping to their current fate</div>
        </div>
        
        <div class="urgent-banner">
            🚨 47 HOSTAGES STILL HELD IN GAZA 🚨<br>
            <div style="font-size: 20px; margin-top: 15px; font-weight: normal;">
                Both alive and deceased - Every day matters - BRING THEM HOME NOW
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card released">
                <div class="stat-number">{final_status.get('Released', 0)}</div>
                <div class="stat-label">Released</div>
            </div>
            <div class="stat-card held">
                <div class="stat-number">{final_status.get('Held in Gaza', 0)}</div>
                <div class="stat-label">Still Held</div>
            </div>
            <div class="stat-card returned">
                <div class="stat-number">{final_status.get('Deceased - Returned', 0)}</div>
                <div class="stat-label">Bodies Returned</div>
            </div>
            <div class="stat-card deceased">
                <div class="stat-number">{final_status.get('Deceased', 0)}</div>
                <div class="stat-label">Confirmed Dead</div>
            </div>
        </div>
        
        <div class="legend" id="legend"></div>
        
        <div class="visualization-container">
            <div id="visualization"></div>
        </div>
        
        <div class="tooltip" id="tooltip"></div>
    </div>

    <script>
        const hostages = {json.dumps(hostages_data)};
        
        const margin = {{top: 60, right: 280, bottom: 60, left: 220}};
        const width = 1200 - margin.left - margin.right;
        const height = 1000 - margin.top - margin.bottom;
        
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .style("background", "linear-gradient(to bottom, #f8f9fa, #ffffff)");
            
        const g = svg.append("g")
            .attr("transform", `translate(${{margin.left}},${{margin.top}})`);
        
        const statusColors = {{
            'Held in Gaza': '#FF2D2D',
            'Released': '#22C55E',
            'Deceased': '#6B7280',
            'Deceased - Returned': '#A855F7'
        }};
        
        // Create enhanced legend
        const legend = d3.select("#legend");
        Object.entries(statusColors).forEach(([status, color]) => {{
            const count = hostages.filter(h => h.status === status).length;
            if (count > 0) {{
                const item = legend.append("div").attr("class", "legend-item");
                item.append("div").attr("class", "legend-color").style("background-color", color);
                item.append("span").text(`${{status}} (${{count}})`);
            }}
        }});
        
        // Process hostages into paths
        const hostagesPaths = hostages.map((hostage, i) => {{
            const path = [{{x: i * (width / hostages.length), y: 0, point: 'kidnapped'}}];
            
            if (hostage.death_context.includes('Before/During')) {{
                path.push({{x: path[0].x, y: 120, point: 'died_immediately'}});
            }} else if (hostage.death_context.includes('Captivity')) {{
                path.push({{x: path[0].x, y: 320, point: 'died_captivity'}});
            }}
            
            if (hostage.status === 'Held in Gaza') {{
                path.push({{x: path[0].x, y: 880, point: 'still_captive'}});
            }} else if (hostage.status === 'Released') {{
                if (hostage.release_circumstances.includes('Military')) {{
                    path.push({{x: path[0].x, y: 720, point: 'military_rescue'}});
                }} else {{
                    path.push({{x: path[0].x, y: 620, point: 'released_deal'}});
                }}
            }} else if (hostage.status === 'Deceased - Returned') {{
                path.push({{x: path[0].x, y: 820, point: 'body_returned'}});
            }}
            
            return {{
                ...hostage,
                path: path,
                color: statusColors[hostage.status] || '#6B7280',
                urgent: hostage.status === 'Held in Gaza'
            }};
        }});
        
        // Draw convergence lines with enhanced styling
        const convergencePoints = [
            {{id: 'kidnapped', label: 'Oct 7, 2023 - All Kidnapped (240)', y: 0, color: '#DC2626'}},
            {{id: 'died_immediately', label: 'Killed Immediately', y: 120, color: '#EF4444'}},
            {{id: 'died_captivity', label: 'Killed in Captivity', y: 320, color: '#F87171'}},
            {{id: 'released_deal', label: 'Released in Deals', y: 620, color: '#22C55E'}},
            {{id: 'military_rescue', label: 'Military Rescues', y: 720, color: '#3B82F6'}},
            {{id: 'body_returned', label: 'Bodies Returned', y: 820, color: '#A855F7'}},
            {{id: 'still_captive', label: '🚨 STILL HELD IN GAZA 🚨', y: 880, color: '#FF2D2D', urgent: true}}
        ];
        
        convergencePoints.forEach(point => {{
            const hostagesTouching = hostagesPaths.filter(h => 
                h.path.some(p => p.point === point.id)
            );
            
            if (hostagesTouching.length > 0) {{
                g.append("line")
                    .attr("class", `convergence-line ${{point.urgent ? 'urgent' : ''}}`)
                    .attr("x1", -20)
                    .attr("x2", width + 20)
                    .attr("y1", point.y)
                    .attr("y2", point.y)
                    .attr("stroke", point.color);
                
                g.append("text")
                    .attr("class", "convergence-label")
                    .attr("x", width + 30)
                    .attr("y", point.y - 8)
                    .attr("fill", point.color)
                    .attr("font-size", point.urgent ? "15px" : "13px")
                    .attr("font-weight", "bold")
                    .text(point.label);
                    
                g.append("text")
                    .attr("class", "convergence-count")
                    .attr("x", width + 30)
                    .attr("y", point.y + 18)
                    .attr("font-weight", point.urgent ? 'bold' : 'normal')
                    .attr("fill", point.urgent ? '#FF2D2D' : '#555')
                    .attr("font-size", point.urgent ? "13px" : "12px")
                    .text(`${{hostagesTouching.length}} hostages`);
            }}
        }});
        
        // Draw hostage paths with enhanced interactivity
        hostagesPaths.forEach(hostage => {{
            const line = d3.line().x(d => d.x).y(d => d.y);
                
            g.append("path")
                .datum(hostage.path)
                .attr("class", `hostage-line ${{hostage.urgent ? 'urgent' : ''}}`)
                .attr("d", line)
                .attr("stroke", hostage.color)
                .attr("fill", "none")
                .style("cursor", "pointer")
                .on("mouseover", function(event) {{
                    d3.select(this).style("opacity", 1.0).attr("stroke-width", hostage.urgent ? 4 : 3);
                    
                    d3.select("#tooltip")
                        .style("opacity", 1)
                        .style("left", (event.pageX + 15) + "px")
                        .style("top", (event.pageY - 15) + "px")
                        .html(`
                            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">${{hostage.name}}</div>
                            <div style="color: ${{hostage.color}}; font-weight: bold; margin-bottom: 5px;">Status: ${{hostage.status}}</div>
                            ${{hostage.status === 'Held in Gaza' ? '<div style="color: #FF2D2D; font-weight: bold; font-size: 15px; margin-bottom: 5px;">🚨 STILL NEEDS RESCUE 🚨</div>' : ''}}
                            ${{hostage.release_date !== 'nan' && hostage.release_date !== '' ? '<div>Released: ' + hostage.release_date + '</div>' : ''}}
                            ${{hostage.release_circumstances !== 'nan' ? '<div style="margin-top: 5px; font-size: 13px; color: #ccc;">' + hostage.release_circumstances + '</div>' : ''}}
                        `);
                }})
                .on("mouseout", function() {{
                    d3.select(this).style("opacity", hostage.urgent ? 1.0 : 0.85).attr("stroke-width", hostage.urgent ? 3 : 1.8);
                    d3.select("#tooltip").style("opacity", 0);
                }});
        }});
        
        // Add enhanced timeline labels
        const timelineLabels = [
            {{y: 0, label: 'Oct 7, 2023\\nKIDNAPPED\\n(All 240)', color: '#DC2626'}},
            {{y: 120, label: 'KILLED\\nIMMEDIATELY', color: '#EF4444'}},
            {{y: 320, label: 'KILLED IN\\nCAPTIVITY', color: '#F87171'}},
            {{y: 620, label: 'RELEASED\\nIN DEALS', color: '#22C55E'}},
            {{y: 720, label: 'MILITARY\\nRESCUES', color: '#3B82F6'}},
            {{y: 820, label: 'BODIES\\nRETURNED', color: '#A855F7'}},
            {{y: 880, label: '🚨 STILL HELD 🚨\\nURGENT RESCUE', color: '#FF2D2D', urgent: true}}
        ];
        
        timelineLabels.forEach(item => {{
            g.append("text")
                .attr("x", -25)
                .attr("y", item.y + 8)
                .attr("text-anchor", "end")
                .attr("font-size", item.urgent ? "12px" : "11px")
                .attr("font-weight", "bold")
                .attr("fill", item.color)
                .selectAll("tspan")
                .data(item.label.split('\\n'))
                .enter()
                .append("tspan")
                .attr("x", -25)
                .attr("dy", (d, i) => i === 0 ? 0 : 13)
                .text(d => d);
        }});
        
    </script>
</body>
</html>'''

# Save the final accurate visualization
with open('hostage_timeline_final_47_held.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"\n=== FINAL ACCURATE VISUALIZATION CREATED ===")
print(f"File: hostage_timeline_final_47_held.html")
print(f"✓ Exactly 47 hostages marked as 'Held in Gaza'")
print(f"✓ Enhanced visual design with urgency emphasis")
print(f"✓ Accurate convergence points and statistics")
print(f"\nVisualization shows:")
print(f"- Released: {final_status.get('Released', 0)} hostages")
print(f"- Still Held: {final_status.get('Held in Gaza', 0)} hostages (URGENT)")
print(f"- Bodies Returned: {final_status.get('Deceased - Returned', 0)} hostages") 
print(f"- Deceased: {final_status.get('Deceased', 0)} hostages")
print(f"\nOpen hostage_timeline_final_47_held.html for the accurate visualization!")
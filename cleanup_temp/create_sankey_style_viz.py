import pandas as pd
import json

print("=== CREATING ELEGANT SANKEY-STYLE VISUALIZATION ===")

# Load the data
df = pd.read_csv('hostages-from-kan.csv', encoding='utf-8-sig')

print("Status distribution:")
final_status = df['Current Status'].value_counts()
for status, count in final_status.items():
    print(f"  {status}: {count}")

# Prepare data for the Sankey-style visualization
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

# Create the enhanced Sankey-style HTML visualization
html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>October 7 Hostages: Flowing Paths of Fate - 47 Still Held</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
        }}
        
        .container {{
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 50px;
        }}
        
        .title {{
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1e293b;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }}
        
        .subtitle {{
            font-size: 20px;
            color: #64748b;
            margin-bottom: 25px;
        }}
        
        .urgent-banner {{
            margin-bottom: 40px;
            padding: 30px;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            border-radius: 20px;
            font-size: 32px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            box-shadow: 0 8px 32px rgba(239,68,68,0.3);
            animation: urgentPulse 3s ease-in-out infinite;
        }}
        
        @keyframes urgentPulse {{
            0%, 100% {{ transform: scale(1); box-shadow: 0 8px 32px rgba(239,68,68,0.3); }}
            50% {{ transform: scale(1.02); box-shadow: 0 12px 40px rgba(239,68,68,0.5); }}
        }}
        
        .stats-container {{
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-bottom: 50px;
            flex-wrap: wrap;
        }}
        
        .stat-box {{
            text-align: center;
            padding: 25px 30px;
            border-radius: 15px;
            min-width: 140px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }}
        
        .stat-box:hover {{ transform: translateY(-5px); }}
        
        .stat-number {{
            font-size: 42px;
            font-weight: bold;
            margin-bottom: 8px;
        }}
        
        .stat-label {{
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }}
        
        .held {{ background: linear-gradient(135deg, #fee2e2, #fecaca); color: #dc2626; }}
        .released {{ background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #16a34a; }}
        .returned {{ background: linear-gradient(135deg, #f3e8ff, #e9d5ff); color: #9333ea; }}
        .deceased {{ background: linear-gradient(135deg, #f8fafc, #e2e8f0); color: #475569; }}
        
        .visualization-area {{
            background: linear-gradient(to bottom, #ffffff, #f8fafc);
            border-radius: 15px;
            padding: 30px;
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
        }}
        
        .hostage-path {{
            fill: none;
            stroke-width: 1.5;
            opacity: 0.8;
            transition: all 0.3s ease;
        }}
        
        .hostage-path.urgent {{
            stroke-width: 2.5;
            opacity: 1.0;
            filter: drop-shadow(1px 1px 3px rgba(239,68,68,0.4));
        }}
        
        .hostage-path:hover {{
            stroke-width: 3.5;
            opacity: 1.0;
            filter: drop-shadow(2px 2px 5px rgba(0,0,0,0.3));
        }}
        
        .group-node {{
            filter: drop-shadow(2px 2px 8px rgba(0,0,0,0.15));
        }}
        
        .group-rect {{
            rx: 12;
            ry: 12;
            stroke-width: 2;
            stroke-opacity: 0.3;
        }}
        
        .group-rect.urgent {{
            stroke-width: 3;
            stroke-opacity: 0.8;
            filter: drop-shadow(0 0 15px rgba(239,68,68,0.6));
            animation: urgentGlow 2s ease-in-out infinite alternate;
        }}
        
        @keyframes urgentGlow {{
            from {{ filter: drop-shadow(0 0 15px rgba(239,68,68,0.6)); }}
            to {{ filter: drop-shadow(0 0 25px rgba(239,68,68,0.9)); }}
        }}
        
        .group-label {{
            font-size: 16px;
            font-weight: bold;
            text-anchor: middle;
            dominant-baseline: middle;
            fill: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }}
        
        .group-count {{
            font-size: 22px;
            font-weight: bold;
            text-anchor: middle;
            dominant-baseline: middle;
            fill: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }}
        
        .timeline-label {{
            font-size: 14px;
            font-weight: bold;
            fill: #334155;
            text-anchor: middle;
            dominant-baseline: middle;
        }}
        
        .tooltip {{
            position: absolute;
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(30,41,59,0.95));
            color: white;
            padding: 18px;
            border-radius: 12px;
            font-size: 14px;
            pointer-events: none;
            opacity: 0;
            max-width: 300px;
            z-index: 1000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">October 7 Hostages: Flowing Paths of Fate</div>
            <div class="subtitle">Each curved line represents one hostage's journey from kidnapping to their current status</div>
        </div>
        
        <div class="urgent-banner">
            🚨 47 HOSTAGES STILL HELD IN GAZA 🚨<br>
            <div style="font-size: 22px; margin-top: 15px; font-weight: normal;">
                Every curved line matters - Every day counts - BRING THEM HOME
            </div>
        </div>
        
        <div class="stats-container">
            <div class="stat-box released">
                <div class="stat-number">{final_status.get('Released', 0)}</div>
                <div class="stat-label">Released</div>
            </div>
            <div class="stat-box held">
                <div class="stat-number">{final_status.get('Held in Gaza', 0)}</div>
                <div class="stat-label">Still Held</div>
            </div>
            <div class="stat-box returned">
                <div class="stat-number">{final_status.get('Deceased - Returned', 0)}</div>
                <div class="stat-label">Bodies Returned</div>
            </div>
            <div class="stat-box deceased">
                <div class="stat-number">{final_status.get('Deceased', 0)}</div>
                <div class="stat-label">Confirmed Dead</div>
            </div>
        </div>
        
        <div class="visualization-area">
            <div id="visualization"></div>
        </div>
        
        <div class="tooltip" id="tooltip"></div>
    </div>

    <script>
        const hostages = {json.dumps(hostages_data)};
        
        const margin = {{top: 40, right: 40, bottom: 40, left: 40}};
        const width = 1400 - margin.left - margin.right;
        const height = 900 - margin.top - margin.bottom;
        
        const svg = d3.select("#visualization")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
            
        const g = svg.append("g")
            .attr("transform", `translate(${{margin.left}},${{margin.top}})`);
        
        // Colors for different statuses
        const statusColors = {{
            'Held in Gaza': '#ef4444',
            'Released': '#22c55e',
            'Deceased': '#6b7280',
            'Deceased - Returned': '#a855f7'
        }};
        
        // Define the flow stages and their positions
        const stages = [
            {{ id: 'start', label: 'Oct 7, 2023\\nKIDNAPPED', x: 100, y: height / 2, width: 120 }},
            {{ id: 'end_groups', x: width - 200, y: 150, groupHeight: 120, groupGap: 30 }}
        ];
        
        // Group hostages by their final status
        const statusGroups = {{}};
        const groupOrder = ['Released', 'Held in Gaza', 'Deceased - Returned', 'Deceased'];
        
        hostages.forEach(hostage => {{
            const status = hostage.status;
            if (!statusGroups[status]) {{
                statusGroups[status] = [];
            }}
            statusGroups[status].push(hostage);
        }});
        
        // Calculate group positions
        const groups = [];
        let currentY = 80;
        
        groupOrder.forEach(status => {{
            if (statusGroups[status] && statusGroups[status].length > 0) {{
                const count = statusGroups[status].length;
                const groupHeight = Math.max(80, count * 1.8);
                
                groups.push({{
                    id: status,
                    label: status,
                    count: count,
                    x: stages[1].x,
                    y: currentY,
                    width: 180,
                    height: groupHeight,
                    color: statusColors[status],
                    hostages: statusGroups[status],
                    urgent: status === 'Held in Gaza'
                }});
                
                currentY += groupHeight + 25;
            }}
        }});
        
        // Draw the start point
        const startGroup = g.append("g").attr("class", "group-node");
        
        startGroup.append("rect")
            .attr("class", "group-rect")
            .attr("x", stages[0].x - stages[0].width/2)
            .attr("y", stages[0].y - 40)
            .attr("width", stages[0].width)
            .attr("height", 80)
            .attr("fill", "#1e293b")
            .attr("stroke", "#334155");
        
        startGroup.append("text")
            .attr("class", "group-count")
            .attr("x", stages[0].x)
            .attr("y", stages[0].y - 10)
            .text("240");
            
        startGroup.append("text")
            .attr("class", "group-label")
            .attr("x", stages[0].x)
            .attr("y", stages[0].y + 15)
            .attr("font-size", "14px")
            .text("KIDNAPPED");
        
        // Draw the end groups
        groups.forEach(group => {{
            const groupNode = g.append("g").attr("class", "group-node");
            
            groupNode.append("rect")
                .attr("class", `group-rect ${{group.urgent ? 'urgent' : ''}}`)
                .attr("x", group.x - group.width/2)
                .attr("y", group.y - group.height/2)
                .attr("width", group.width)
                .attr("height", group.height)
                .attr("fill", group.color)
                .attr("stroke", d3.color(group.color).darker(0.5));
            
            groupNode.append("text")
                .attr("class", "group-count")
                .attr("x", group.x)
                .attr("y", group.y - 15)
                .text(group.count);
                
            groupNode.append("text")
                .attr("class", "group-label")
                .attr("x", group.x)
                .attr("y", group.y + 10)
                .attr("font-size", group.urgent ? "16px" : "14px")
                .text(group.label);
                
            if (group.urgent) {{
                groupNode.append("text")
                    .attr("class", "group-label")
                    .attr("x", group.x)
                    .attr("y", group.y + 30)
                    .attr("font-size", "12px")
                    .text("🚨 URGENT 🚨");
            }}
        }});
        
        // Draw flowing curves for each hostage
        let pathIndex = 0;
        groups.forEach(group => {{
            group.hostages.forEach((hostage, i) => {{
                // Calculate start and end positions
                const startX = stages[0].x + stages[0].width/2;
                const startY = stages[0].y + (Math.random() - 0.5) * 60; // Small random spread
                
                const endX = group.x - group.width/2;
                const endY = group.y - group.height/2 + (i / group.count) * group.height + group.height/group.count/2;
                
                // Create smooth curved path
                const midX = startX + (endX - startX) * 0.6;
                const midY = startY + (endY - startY) * 0.3;
                
                const path = d3.path();
                path.moveTo(startX, startY);
                path.bezierCurveTo(
                    startX + 150, startY, // Control point 1
                    midX, midY,           // Control point 2
                    endX, endY            // End point
                );
                
                g.append("path")
                    .attr("class", `hostage-path ${{group.urgent ? 'urgent' : ''}}`)
                    .attr("d", path.toString())
                    .attr("stroke", group.color)
                    .style("cursor", "pointer")
                    .on("mouseover", function(event) {{
                        d3.select(this).classed("highlight", true);
                        
                        d3.select("#tooltip")
                            .style("opacity", 1)
                            .style("left", (event.pageX + 15) + "px")
                            .style("top", (event.pageY - 15) + "px")
                            .html(`
                                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: ${{group.color}};">
                                    ${{hostage.name}}
                                </div>
                                <div style="margin-bottom: 8px;">
                                    <strong>Status:</strong> <span style="color: ${{group.color}};">${{hostage.status}}</span>
                                </div>
                                ${{hostage.status === 'Held in Gaza' ? 
                                    '<div style="color: #ef4444; font-weight: bold; font-size: 16px; margin: 10px 0; text-align: center;">🚨 STILL NEEDS RESCUE 🚨</div>' : 
                                    ''
                                }}
                                ${{hostage.release_date !== 'nan' && hostage.release_date !== '' ? 
                                    '<div><strong>Released:</strong> ' + hostage.release_date + '</div>' : 
                                    ''
                                }}
                                ${{hostage.release_circumstances !== 'nan' && hostage.release_circumstances !== 'Currently Held Captive' ? 
                                    '<div style="margin-top: 8px; font-size: 13px; opacity: 0.9;"><strong>Circumstances:</strong> ' + hostage.release_circumstances + '</div>' : 
                                    ''
                                }}
                                <div style="margin-top: 10px; font-size: 12px; opacity: 0.7; text-align: center;">
                                    Journey from Oct 7 to ${{hostage.status.toLowerCase()}}
                                </div>
                            `);
                    }})
                    .on("mouseout", function() {{
                        d3.select(this).classed("highlight", false);
                        d3.select("#tooltip").style("opacity", 0);
                    }});
                    
                pathIndex++;
            }});
        }});
        
        // Add title annotations
        g.append("text")
            .attr("class", "timeline-label")
            .attr("x", stages[0].x)
            .attr("y", 20)
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text("October 7, 2023");
            
        g.append("text")
            .attr("class", "timeline-label")
            .attr("x", stages[1].x)
            .attr("y", 20)
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text("Current Status (2025)");
        
        // Add flowing animation effect
        const flowAnimation = () => {{
            g.selectAll(".hostage-path")
                .style("stroke-dasharray", "5,5")
                .style("stroke-dashoffset", 10)
                .transition()
                .duration(3000)
                .ease(d3.easeLinear)
                .style("stroke-dashoffset", 0)
                .on("end", () => {{
                    setTimeout(flowAnimation, 5000);
                }});
        }};
        
        // Start the flow animation after a delay
        setTimeout(flowAnimation, 1000);
        
    </script>
</body>
</html>'''

# Save the Sankey-style visualization
with open('hostage_timeline_sankey_style.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"\n=== ELEGANT SANKEY-STYLE VISUALIZATION CREATED ===")
print(f"File: hostage_timeline_sankey_style.html")
print(f"Features:")
print(f"- Curved flowing lines from start to grouped endpoints")
print(f"- Compact grouped destination boxes")
print(f"- 47 red urgent lines flowing to 'Held in Gaza' group")
print(f"- Smooth Bezier curves for elegant flow")
print(f"- Animated flow effects")
print(f"- Enhanced tooltips and interactions")
print(f"\nOpen hostage_timeline_sankey_style.html for the elegant flow visualization!")
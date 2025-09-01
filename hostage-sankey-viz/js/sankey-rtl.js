/**
 * RTL Sankey Diagram Implementation
 * Custom D3-Sankey wrapper with right-to-left layout and individual path highlighting
 */

class SankeyRTL {
    constructor(container, options = {}) {
        this.container = d3.select(container);
        this.options = {
            width: options.width || 1200,
            height: options.height || 600,
            nodeWidth: options.nodeWidth || 20,
            nodePadding: options.nodePadding || 10,
            margin: options.margin || { top: 60, right: 50, bottom: 20, left: 50 },
            ...options
        };
        
        this.data = null;
        this.individualPaths = [];
        this.svg = null;
        this.sankey = null;
        this.selectedPaths = new Set();
        
        this.setupSVG();
        this.setupSankey();
    }

    /**
     * Setup SVG container
     */
    setupSVG() {
        const { width, height, margin } = this.options;
        
        this.svg = this.container
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.bottom + margin.top)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Add step labels
        this.addStepLabels();
    }

    /**
     * Setup D3-Sankey with RTL modifications
     */
    setupSankey() {
        const { width, height, nodeWidth, nodePadding } = this.options;
        
        // Check if we have the real d3-sankey library
        if (typeof d3.sankey === 'undefined') {
            console.error('🔴 TOPPATH-ERROR: d3.sankey is undefined - using fallback');
        } else {
            console.log('✅ TOPPATH-SANKEY: Using real d3-sankey library');
        }
        
        this.sankey = d3.sankey()
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .extent([[0, 0], [width, height]])
            .nodeAlign(d3.sankeyJustify)
            .iterations(50);
            
        console.log(`🔍 TOPPATH-SANKEY-SETUP: extent=[0,0,${width},${height}] nodeWidth=${nodeWidth} nodePadding=${nodePadding}`);
    }

    /**
     * Add step labels at the top
     */
    addStepLabels() {
        const { width } = this.options;
        
        const steps = [
            { title: 'תוצאה סופית', x: width * 0.2 },           // Left - Final outcome with subgroups
            { title: 'מצב ב-7 באוקטובר', x: width * 0.8 }       // Right - Oct 7th status
        ];
        
        this.svg.selectAll('.step-label')
            .data(steps)
            .enter()
            .append('text')
            .attr('class', 'step-label')
            .attr('x', d => d.x)
            .attr('y', -20)
            .text(d => d.title);
    }

    /**
     * Render Sankey diagram with RTL layout
     */
    render(sankeyData, individualPaths = []) {
        this.data = sankeyData;
        this.individualPaths = individualPaths;
        
        // Create a copy for processing
        const rtlData = {
            nodes: sankeyData.nodes.map(node => ({ ...node })),
            links: sankeyData.links.map(link => ({ ...link }))
        };
        
        // 🔍 TOPPATH: Debug node and link values before Sankey
        console.log(`🔍 TOPPATH-PRE-SANKEY: Checking data integrity`);
        rtlData.nodes.forEach(node => {
            if (node.id === 'alive-oct7' || node.id?.includes('released-deal') || node.id?.includes('released-military')) {
                console.log(`🔍 NODE-VALUES: ${node.id} value=${node.value} hostageCount=${node.hostageCount}`);
            }
        });
        
        rtlData.links.forEach(link => {
            if (link.source.id === 'alive-oct7' && (link.target.id?.includes('released-deal') || link.target.id?.includes('released-military'))) {
                console.log(`🔍 LINK-VALUES: ${link.source.id}->${link.target.id} value=${link.value} hostages=${link.hostages?.length}`);
            }
        });
        
        // Check which Sankey implementation we're using
        console.log(`🔍 TOPPATH-SANKEY-TYPE: Using ${typeof d3.sankey} sankey, nodeAlign: ${typeof this.sankey.nodeAlign}`);
        
        // Let D3 Sankey do the layout calculation first
        const processedData = this.sankey.call(this.sankey, rtlData);
        
        // 🔍 TOPPATH: Check computed positions after Sankey
        console.log(`🔍 TOPPATH-POST-SANKEY: Node positions and link calculations`);
        rtlData.nodes.forEach(node => {
            if (node.id === 'alive-oct7' || node.id === 'released-deal' || node.id === 'released-military') {
                console.log(`🔍 NODE-POS: ${node.id} y0=${node.y0} y1=${node.y1} height=${node.y1-node.y0} value=${node.value}`);
            }
        });
        
        rtlData.links.forEach((link, index) => {
            if (link.source?.id === 'alive-oct7') {
                console.log(`🔍 LINK-POS: ${link.source.id}->${link.target.id} y0=${link.y0} y1=${link.y1} width=${link.width} value=${link.value}`);
            }
        });
        
        // Apply RTL transformation (flip x-coordinates only, preserve D3's y positions)
        this.applyRTLTransformation(rtlData);
        
        // Create visual groups for Step 2 nodes
        const visualGroups = this.createVisualGroups(rtlData);
        
        // Apply controlled positioning that maintains path connections
        this.applyControlledGroupPositioning(rtlData, visualGroups);
        
        // Clear previous rendering
        this.svg.selectAll('.sankey-node, .sankey-link, .step-label').remove();
        
        // Re-add step labels after clearing
        this.addStepLabels();
        
        
        // Render links first (so they appear behind nodes)
        this.renderLinks(rtlData);
        
        // Render nodes with visual grouping
        this.renderNodes(rtlData, visualGroups);
        
        // Setup interactions
        this.setupInteractions();
        
        // 🔍 TOPPATH: Final verification
        const finalLinks = this.svg.selectAll('.sankey-link').filter(function(d) {
            return d.source?.id === 'alive-oct7' && 
                (d.target?.id === 'released-deal-living' || d.target?.id === 'released-military-living');
        });
        console.log(`🔍 TOPPATH-FINAL: ${finalLinks.size()} critical living released links rendered in DOM`);
    }

    /**
     * Apply RTL transformation - flip horizontally but preserve D3's y positions
     */
    applyRTLTransformation(data) {
        const { width } = this.options;
        
        console.log(`🔍 ALIGNMENT-FIX: Applying RTL transformation, preserving D3 positions`);
        
        // Apply ONLY horizontal flip for RTL, preserve all y positions calculated by D3
        data.nodes.forEach(node => {
            // Store original D3-calculated positions
            const originalX0 = node.x0;
            const originalX1 = node.x1;
            
            // Flip horizontally for RTL layout
            node.x0 = width - originalX1;
            node.x1 = width - originalX0;
            
            console.log(`🔍 ALIGNMENT-FIX: ${node.id} RTL flip: x=${originalX0}-${originalX1} → ${node.x0}-${node.x1}, y=${node.y0}-${node.y1} (preserved)`);
        });
        
        // Links will automatically use the updated node positions via linkGenerator
        console.log(`🔍 ALIGNMENT-FIX: RTL transformation complete - paths will align with nodes`);
    }

    /**
     * Create visual groups from individual nodes
     */
    createVisualGroups(data) {
        console.log(`🔍 GROUPING: Creating visual groups from step 2 nodes`);
        
        // Group nodes by their groupId
        const groups = new Map();
        
        data.nodes.forEach(node => {
            if (node.step === 2 && node.groupId) {
                if (!groups.has(node.groupId)) {
                    groups.set(node.groupId, {
                        id: node.groupId,
                        nodes: [],
                        x0: null,
                        x1: null,
                        y0: null,
                        y1: null,
                        livingNode: null,
                        deceasedNode: null
                    });
                }
                
                const group = groups.get(node.groupId);
                group.nodes.push(node);
                
                if (node.isLiving) {
                    group.livingNode = node;
                } else {
                    group.deceasedNode = node;
                }
            }
        });
        
        // Calculate group bounds
        groups.forEach(group => {
            // X position is same for all nodes in group (leftmost for RTL)
            group.x0 = Math.min(...group.nodes.map(n => n.x0));
            group.x1 = Math.max(...group.nodes.map(n => n.x1));
            
            // Y position spans all nodes in group
            group.y0 = Math.min(...group.nodes.map(n => n.y0));
            group.y1 = Math.max(...group.nodes.map(n => n.y1));
            
            console.log(`🔍 GROUPING: ${group.id} bounds: x=${group.x0}-${group.x1}, y=${group.y0}-${group.y1}, nodes=${group.nodes.length}`);
        });
        
        return groups;
    }

    /**
     * Apply controlled group positioning while maintaining path connections
     */
    applyControlledGroupPositioning(data, groups) {
        const { height } = this.options;
        const subdivisionGap = 5;
        
        console.log(`🔍 GROUPING: Applying controlled positioning for ${groups.size} groups`);
        
        // Define desired group positions (top to bottom: deals, military, still-held)
        const groupPositions = {
            'released-deal': 0.2,      // Top 20% of height
            'released-military': 0.5,  // Middle 50% of height
            'still-held': 0.8          // Bottom 80% of height
        };
        
        // Calculate desired positions
        const desiredPositions = new Map();
        for (const [groupId, fraction] of Object.entries(groupPositions)) {
            if (groups.has(groupId)) {
                const group = groups.get(groupId);
                const groupHeight = group.y1 - group.y0;
                desiredPositions.set(groupId, {
                    center: height * fraction,
                    height: groupHeight
                });
            }
        }
        
        // Apply smooth transitions that maintain link connections
        groups.forEach((group, groupId) => {
            const desired = desiredPositions.get(groupId);
            if (!desired) return;
            
            const currentCenter = (group.y0 + group.y1) / 2;
            const offset = desired.center - currentCenter;
            
            console.log(`🔍 GROUPING: ${groupId} moving by offset=${offset.toFixed(1)}px`);
            
            // Apply offset to all nodes in group
            group.nodes.forEach(node => {
                node.y0 += offset;
                node.y1 += offset;
            });
            
            // CRITICAL: Update link positions to follow nodes
            data.links.forEach(link => {
                if (link.target && group.nodes.includes(link.target)) {
                    // Recalculate link end position
                    const targetCenter = (link.target.y0 + link.target.y1) / 2;
                    link.y1 = targetCenter;
                }
                if (link.source && group.nodes.includes(link.source)) {
                    // Recalculate link start position
                    const sourceCenter = (link.source.y0 + link.source.y1) / 2;
                    link.y0 = sourceCenter;
                }
            });
            
            // Ensure living is above deceased within each group
            if (group.livingNode && group.deceasedNode) {
                const totalHeight = group.y1 - group.y0 - subdivisionGap;
                
                // Position living at top of group space
                const livingHeight = Math.max(20, totalHeight * group.livingNode.proportionInGroup);
                group.livingNode.y0 = group.y0;
                group.livingNode.y1 = group.y0 + livingHeight;
                
                // Position deceased below with gap
                const deceasedHeight = Math.max(20, totalHeight * group.deceasedNode.proportionInGroup);
                group.deceasedNode.y0 = group.livingNode.y1 + subdivisionGap;
                group.deceasedNode.y1 = group.deceasedNode.y0 + deceasedHeight;
                
                console.log(`🔍 GROUPING: ${groupId} subdivisions: living=${livingHeight.toFixed(1)}px, deceased=${deceasedHeight.toFixed(1)}px, gap=${subdivisionGap}px`);
            }
        });
    }


    /**
     * Render Sankey links with gradient effects for deceased hostages
     */
    renderLinks(data) {
        const linkGenerator = d3.sankeyLinkHorizontal();
        
        // Create gradients for deceased hostages
        this.createDeceasedGradients(data);
        
        
        const links = this.svg.selectAll('.sankey-link')
            .data(data.links)
            .enter()
            .append('path')
            .attr('class', 'sankey-link')
            .attr('d', linkGenerator)
            .style('stroke', d => this.getLinkStroke(d))
            .style('stroke-width', d => Math.max(1, d.width))
            .style('fill', 'none')
            .style('stroke-opacity', 0.8);
        
        // Store link data for individual path highlighting
        // Store link data and check critical links in DOM
        links.each(function(d) {
            d3.select(this).datum().element = this;
            const isCritical = d.source?.id === 'alive-oct7' && 
                (d.target?.id === 'released-deal-living' || d.target?.id === 'released-military-living');
            if (isCritical) {
                const style = window.getComputedStyle(this);
                const bbox = this.getBBox();
                console.log(`🔍 TOPPATH-RENDER: ${d.source.id}->${d.target.id} width=${style.strokeWidth} visible=${style.opacity}`);
                console.log(`🔍 TOPPATH-POSITION: x=${bbox.x} y=${bbox.y} width=${bbox.width} height=${bbox.height}`);
                if (bbox.height === 0) {
                    console.error(`🔴 TOPPATH-ERROR: STILL ZERO HEIGHT! Link y0=${d.y0} y1=${d.y1}`);
                    console.error(`🔴 TOPPATH-DEBUG: source=${d.source.id} target=${d.target.id} link.value=${d.value}`);
                    console.error(`🔴 TOPPATH-DEBUG: source.value=${d.source.value} target.value=${d.target.value}`);
                    
                    // TEMPORARILY REMOVE REPAIR TO SEE RAW SANKEY CALCULATION
                    console.log(`🔴 TOPPATH-ERROR: Leaving flat - need to fix Sankey calculation first`);
                } else {
                    console.log(`✅ TOPPATH-SUCCESS: Link has height=${bbox.height}`);
                }
            }
        });
    }

    /**
     * Create gradient definitions for deceased hostages
     */
    createDeceasedGradients(data) {
        // Remove existing gradients
        this.svg.select('defs').remove();
        
        const defs = this.svg.append('defs');
        
        data.links.forEach((link, index) => {
            // 🔍 TOP-PATH-DEBUG: Track critical links during rendering  
            const isLivingReleasedLink = link.source && link.target &&
                link.source.id === 'alive-oct7' && 
                (link.target.id === 'released-deal-living' || link.target.id === 'released-military-living');
            
            if (isLivingReleasedLink) {
                console.log(`🔍 TOPPATH-GRADIENT: ${link.source.id}->${link.target.id}`);
                
                const gradient = defs.append('linearGradient')
                    .attr('id', `living-released-gradient-${index}`)
                    .attr('x1', '0%')
                    .attr('y1', '0%')
                    .attr('x2', '100%')
                    .attr('y2', '0%');
                
                const outcomeColor = this.getLinkColor(link);
                
                gradient.append('stop')
                    .attr('offset', '0%')  // Left side - outcome color
                    .style('stop-color', outcomeColor)  // Blue/green for outcome
                    .style('stop-opacity', 1);
                
                gradient.append('stop')
                    .attr('offset', '100%')  // Right side - gray
                    .style('stop-color', '#bdc3c7')  // Light gray for captivity
                    .style('stop-opacity', 1);
                    
                link.gradientId = `living-released-gradient-${index}`;
            }
        });
        
        /* OLD CODE - commented out for testing
        data.links.forEach((link, index) => {
            const hasDeceasedOct7 = link.hostages && link.hostages.some(h => h.step1 === 'deceased-oct7');
            const hasDiedInCaptivity = link.hostages && link.hostages.some(h => 
                h.step1 === 'alive-oct7' && ((h.step2 && h.step2.includes('deceased')) || 
                this.isDeceasedInCaptivity(h)));
            const hasLivingReleased = link.hostages && link.hostages.some(h => 
                h.step1 === 'alive-oct7' && h.isAlive === true && 
                (h.step2 === 'released-deal' || h.step2 === 'released-military'));
            
            if (hasLivingReleased && !hasDeceasedOct7 && !hasDiedInCaptivity) {
                // ... 
            } else if (hasDeceasedOct7) {
                // Gradient: dark red to transparent gray
                const gradient = defs.append('linearGradient')
                    .attr('id', `deceased-oct7-gradient-${index}`)
                    .attr('gradientUnits', 'userSpaceOnUse')
                    .attr('x1', link.source.x1)
                    .attr('y1', (link.source.y0 + link.source.y1) / 2)
                    .attr('x2', link.target.x0)
                    .attr('y2', (link.target.y0 + link.target.y1) / 2);
                
                gradient.append('stop')
                    .attr('offset', '0%')
                    .style('stop-color', '#c0392b')  // Dark red
                    .style('stop-opacity', 1);
                
                gradient.append('stop')
                    .attr('offset', '100%')
                    .style('stop-color', '#95a5a6')  // Transparent gray
                    .style('stop-opacity', 0.3);
                    
                link.gradientId = `deceased-oct7-gradient-${index}`;
                
            } else if (hasDiedInCaptivity) {
                // Gradient: solid color to gray early (15% transition point)
                const gradient = defs.append('linearGradient')
                    .attr('id', `died-captivity-gradient-${index}`)
                    .attr('gradientUnits', 'userSpaceOnUse')
                    .attr('x1', link.source.x1)
                    .attr('y1', (link.source.y0 + link.source.y1) / 2)
                    .attr('x2', link.target.x0)
                    .attr('y2', (link.target.y0 + link.target.y1) / 2);
                
                const solidColor = this.getLinkColor(link);
                
                gradient.append('stop')
                    .attr('offset', '0%')
                    .style('stop-color', solidColor)
                    .style('stop-opacity', 1);
                
                gradient.append('stop')
                    .attr('offset', '15%')  // Early transition - 15% with shades of red
                    .style('stop-color', solidColor)
                    .style('stop-opacity', 1);
                
                gradient.append('stop')
                    .attr('offset', '100%')
                    .style('stop-color', '#95a5a6')  // Gray all the way to the end
                    .style('stop-opacity', 0.7);
                    
                link.gradientId = `died-captivity-gradient-${index}`;
            }
        });
        */
    }

    /**
     * Check if hostage died in captivity
     */
    isDeceasedInCaptivity(hostage) {
        const deathContext = hostage['Context of Death'] || '';
        const currentStatus = hostage['Current Status'] || '';
        
        return (deathContext && (deathContext.includes('Died in Captivity') ||
               deathContext.includes('Killed in captivity'))) ||
               (currentStatus && currentStatus.includes('Deceased') && hostage.step1 === 'alive-oct7');
    }

    /**
     * Get link stroke (color or gradient)
     */
    getLinkStroke(link) {
        if (link.gradientId) {
            return `url(#${link.gradientId})`;
        }
        return this.getLinkColor(link);
    }

    /**
     * Render Sankey nodes with visual grouping for Step 2
     */
    renderNodes(data, visualGroups) {
        console.log(`🔍 GROUPING: Starting node rendering with ${visualGroups ? visualGroups.size : 0} visual groups`);
        
        // Render Step 1 nodes (individual, no grouping)
        const step1Nodes = data.nodes.filter(n => n.step === 1);
        const step1Selection = this.svg.selectAll('.sankey-node-step1')
            .data(step1Nodes)
            .enter()
            .append('g')
            .attr('class', 'sankey-node sankey-node-step1');
        
        step1Selection.each((d, i) => {
            const nodeGroup = d3.select(step1Selection.nodes()[i]);
            console.log(`🔍 GROUPING: Rendering Step 1 node ${d.id} at x=${d.x0}-${d.x1}, y=${d.y0}-${d.y1}`);
            this.renderSimpleNode(nodeGroup, d);
        });
        
        // Add Step 1 labels
        step1Selection.append('text')
            .attr('x', d => d.x0 - 6)  // RTL: label to the right
            .attr('y', d => (d.y1 + d.y0) / 2)
            .attr('dy', '0.35em')
            .style('text-anchor', 'end')
            .style('font-size', '12px')
            .style('fill', '#2c3e50')
            .text(d => d.name);
        
        // Render Step 2 nodes as grouped visual elements
        if (visualGroups) {
            this.renderGroupedNodes(data, visualGroups);
        } else {
            // Fallback to individual rendering if no groups
            const step2Nodes = data.nodes.filter(n => n.step === 2);
            const step2Selection = this.svg.selectAll('.sankey-node-step2')
                .data(step2Nodes)
                .enter()
                .append('g')
                .attr('class', 'sankey-node sankey-node-step2');
            
            step2Selection.each((d, i) => {
                const nodeGroup = d3.select(step2Selection.nodes()[i]);
                this.renderSimpleNode(nodeGroup, d);
            });
        }
    }
    
    /**
     * Render grouped nodes as unified visual elements
     */
    renderGroupedNodes(data, groups) {
        console.log(`🔍 GROUPING: Rendering ${groups.size} visual groups`);
        
        groups.forEach(group => {
            const groupElement = this.svg.append('g')
                .attr('class', `sankey-group group-${group.id}`)
                .attr('data-group-id', group.id);
            
            console.log(`🔍 GROUPING: Rendering group ${group.id} with ${group.nodes.length} nodes`);
            
            // Render background rectangle for entire group
            groupElement.append('rect')
                .attr('class', 'group-background')
                .attr('x', group.x0 - 2)
                .attr('y', group.y0)
                .attr('width', group.x1 - group.x0 + 4)
                .attr('height', group.y1 - group.y0)
                .style('fill', 'transparent')
                .style('stroke', '#ddd')
                .style('stroke-width', 1)
                .style('stroke-dasharray', '2,2');
            
            // Render living subdivision
            if (group.livingNode) {
                this.renderSubdivision(groupElement, group.livingNode, 'living');
            }
            
            // Render deceased subdivision
            if (group.deceasedNode) {
                this.renderSubdivision(groupElement, group.deceasedNode, 'deceased');
            }
            
            // Add group label
            groupElement.append('text')
                .attr('class', 'group-label')
                .attr('x', group.x1 + 10) // RTL: label to the left
                .attr('y', (group.y0 + group.y1) / 2)
                .attr('dy', '0.35em')
                .style('text-anchor', 'start')
                .style('font-weight', 'bold')
                .style('font-size', '14px')
                .style('fill', '#2c3e50')
                .text(this.getGroupLabel(group.id));
        });
    }
    
    /**
     * Render individual subdivision within a group
     */
    renderSubdivision(groupElement, node, type) {
        console.log(`🔍 GROUPING: Rendering ${type} subdivision for ${node.id} at y=${node.y0}-${node.y1}`);
        
        const rect = groupElement.append('rect')
            .attr('class', `subdivision subdivision-${type}`)
            .attr('x', node.x0)
            .attr('y', node.y0)
            .attr('width', node.x1 - node.x0)
            .attr('height', node.y1 - node.y0)
            .style('fill', type === 'living' ? node.color || '#3498db' : '#95a5a6')
            .style('stroke', '#2c3e50')
            .style('stroke-width', 1);
        
        // Add count label if space permits
        if (node.y1 - node.y0 > 20) {
            groupElement.append('text')
                .attr('class', 'subdivision-label')
                .attr('x', (node.x0 + node.x1) / 2)
                .attr('y', (node.y0 + node.y1) / 2)
                .attr('dy', '0.35em')
                .style('text-anchor', 'middle')
                .style('fill', 'white')
                .style('font-size', '11px')
                .style('font-weight', 'bold')
                .text(node.value);
        }
    }
    
    /**
     * Get display label for group
     */
    getGroupLabel(groupId) {
        const labels = {
            'released-deal': 'שוחררו בעסקה',
            'released-military': 'שוחררו במבצע',
            'still-held': 'עדיין בשבי'
        };
        return labels[groupId] || groupId;
    }
    
    /**
     * Render simple node (for Step 1)
     */
    renderSimpleNode(nodeGroup, nodeData) {
        nodeGroup.append('rect')
            .attr('x', nodeData.x0)
            .attr('y', nodeData.y0)
            .attr('height', nodeData.y1 - nodeData.y0)
            .attr('width', nodeData.x1 - nodeData.x0)
            .style('fill', nodeData.color || '#34495e')
            .style('stroke', '#2c3e50')
            .style('stroke-width', 1);
            
        // Add value label
        nodeGroup.append('text')
            .attr('x', (nodeData.x0 + nodeData.x1) / 2)
            .attr('y', (nodeData.y0 + nodeData.y1) / 2)
            .attr('dy', '0.35em')
            .style('text-anchor', 'middle')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .text(nodeData.value || this.getNodeValue(nodeData, this.data.links));
    }
    
    /**
     * Render subdivided node (for Step 2 with alive/deceased breakdown)
     */
    renderSubdividedNode(nodeGroup, nodeData) {
        const nodeHeight = nodeData.y1 - nodeData.y0;
        const nodeWidth = nodeData.x1 - nodeData.x0;
        const totalCount = nodeData.subdivisions.total;
        
        if (totalCount === 0) {
            this.renderSimpleNode(nodeGroup, nodeData);
            return;
        }
        
        const livingHeight = (nodeData.subdivisions.living / totalCount) * nodeHeight;
        const deceasedHeight = (nodeData.subdivisions.deceased / totalCount) * nodeHeight;
        
        // Living subdivision (top)
        if (nodeData.subdivisions.living > 0) {
            nodeGroup.append('rect')
                .attr('class', 'subdivision living')
                .attr('x', nodeData.x0)
                .attr('y', nodeData.y0)
                .attr('height', livingHeight)
                .attr('width', nodeWidth)
                .style('fill', nodeData.color || '#34495e')
                .style('stroke', '#2c3e50')
                .style('stroke-width', 1);
                
            // Living count label
            if (livingHeight > 15) {
                nodeGroup.append('text')
                    .attr('x', (nodeData.x0 + nodeData.x1) / 2)
                    .attr('y', nodeData.y0 + livingHeight / 2)
                    .attr('dy', '0.35em')
                    .style('text-anchor', 'middle')
                    .style('font-size', '9px')
                    .style('font-weight', 'bold')
                    .style('fill', 'white')
                    .text(nodeData.subdivisions.living);
            }
        }
        
        // Deceased subdivision (bottom)
        if (nodeData.subdivisions.deceased > 0) {
            nodeGroup.append('rect')
                .attr('class', 'subdivision deceased')
                .attr('x', nodeData.x0)
                .attr('y', nodeData.y0 + livingHeight)
                .attr('height', deceasedHeight)
                .attr('width', nodeWidth)
                .style('fill', '#95a5a6')  // Gray for deceased
                .style('stroke', '#2c3e50')
                .style('stroke-width', 1);
                
            // Deceased count label
            if (deceasedHeight > 15) {
                nodeGroup.append('text')
                    .attr('x', (nodeData.x0 + nodeData.x1) / 2)
                    .attr('y', nodeData.y0 + livingHeight + deceasedHeight / 2)
                    .attr('dy', '0.35em')
                    .style('text-anchor', 'middle')
                    .style('font-size', '9px')
                    .style('font-weight', 'bold')
                    .style('fill', 'white')
                    .text(nodeData.subdivisions.deceased);
            }
        }
        
        // Add dividing line between subdivisions if both exist
        if (nodeData.subdivisions.living > 0 && nodeData.subdivisions.deceased > 0) {
            nodeGroup.append('line')
                .attr('class', 'subdivision-divider')
                .attr('x1', nodeData.x0)
                .attr('x2', nodeData.x1)
                .attr('y1', nodeData.y0 + livingHeight)
                .attr('y2', nodeData.y0 + livingHeight)
                .style('stroke', '#2c3e50')
                .style('stroke-width', 2);
        }
    }

    /**
     * Get node value from connected links
     */
    getNodeValue(node, links) {
        return links
            .filter(link => link.source === node || link.target === node)
            .reduce((sum, link) => sum + link.value, 0);
    }

    /**
     * Get link color based on flow type and outcome
     */
    getLinkColor(link) {
        // Check if this is a link to an outcome node and determine color
        if (link.target && link.target.step === 2) {
            if (link.target.id === 'released-deal') {
                return '#27ae60'; // Green for deal releases
            } else if (link.target.id === 'released-military') {
                return '#2980b9'; // Blue for military releases  
            } else if (link.target.id === 'still-held') {
                return '#f39c12'; // Orange for still in captivity
            }
        }
        
        // Color based on source node for consistency (fallback)
        return link.source.color || '#7f8c8d';
    }

    /**
     * Setup mouse interactions
     */
    setupInteractions() {
        const links = this.svg.selectAll('.sankey-link');
        const nodes = this.svg.selectAll('.sankey-node');
        
        // Link hover effects
        links
            .on('mouseover', (event, d) => {
                this.highlightLink(d, true);
                this.showTooltip(event, d, 'link');
            })
            .on('mouseout', (event, d) => {
                this.highlightLink(d, false);
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.showIndividualPathsInLink(d);
            });
        
        // Node hover effects
        nodes
            .on('mouseover', (event, d) => {
                this.highlightNode(d, true);
                this.showTooltip(event, d, 'node');
            })
            .on('mouseout', (event, d) => {
                this.highlightNode(d, false);
                this.hideTooltip();
            });
    }

    /**
     * Highlight individual link
     */
    highlightLink(linkData, highlight) {
        const link = d3.select(linkData.element || null);
        if (link.empty()) return;
        
        if (highlight) {
            link.classed('highlighted', true);
            this.dimOtherLinks(linkData);
        } else {
            link.classed('highlighted', false);
            this.svg.selectAll('.sankey-link').classed('dimmed', false);
        }
    }

    /**
     * Dim other links when highlighting one
     */
    dimOtherLinks(activeLink) {
        this.svg.selectAll('.sankey-link')
            .classed('dimmed', d => d !== activeLink);
    }

    /**
     * Highlight node and connected links
     */
    highlightNode(nodeData, highlight) {
        const allLinks = this.svg.selectAll('.sankey-link');
        
        if (highlight) {
            allLinks.classed('dimmed', d => 
                d.source !== nodeData && d.target !== nodeData);
        } else {
            allLinks.classed('dimmed', false);
        }
    }

    /**
     * Toggle link selection for individual path highlighting
     */
    toggleLinkSelection(linkData) {
        const linkKey = `${linkData.source.id}-${linkData.target.id}`;
        
        if (this.selectedPaths.has(linkKey)) {
            this.selectedPaths.delete(linkKey);
        } else {
            this.selectedPaths.add(linkKey);
        }
        
        this.updatePathHighlighting();
    }

    /**
     * Update visual highlighting of selected paths
     */
    updatePathHighlighting() {
        const links = this.svg.selectAll('.sankey-link');
        
        links.classed('selected-path', d => {
            const linkKey = `${d.source.id}-${d.target.id}`;
            return this.selectedPaths.has(linkKey);
        });
        
        // If any paths are selected, dim unselected ones
        const hasSelection = this.selectedPaths.size > 0;
        links.classed('path-dimmed', d => {
            if (!hasSelection) return false;
            const linkKey = `${d.source.id}-${d.target.id}`;
            return !this.selectedPaths.has(linkKey);
        });
    }

    /**
     * Show tooltip
     */
    showTooltip(event, data, type) {
        const tooltip = d3.select('#tooltip');
        const content = this.getTooltipContent(data, type);
        
        tooltip.select('.tooltip-content').html(content);
        tooltip.classed('hidden', false);
        
        // Position tooltip
        const [x, y] = d3.pointer(event, document.body);
        tooltip
            .style('left', (x + 10) + 'px')
            .style('top', (y - 10) + 'px');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        d3.select('#tooltip').classed('hidden', true);
    }

    /**
     * Generate tooltip content
     */
    getTooltipContent(data, type) {
        if (type === 'link') {
            const hostageCount = data.hostages ? data.hostages.length : data.value;
            const examples = data.hostages ? 
                data.hostages.slice(0, 3).map(h => h['Hebrew Name'] || 'ללא שם').join(', ') : '';
            
            return `
                <div class="name">זרימה: ${data.source.name} → ${data.target.name}</div>
                <div class="details">
                    מספר חטופים: ${hostageCount}<br>
                    ${examples ? `דוגמאות: ${examples}${hostageCount > 3 ? '...' : ''}` : ''}
                </div>
            `;
        } else if (type === 'node') {
            const value = data.value || this.getNodeValue(data, this.data.links);
            return `
                <div class="name">${data.name}</div>
                <div class="details">מספר חטופים: ${value}</div>
            `;
        }
        
        return '';
    }

    /**
     * Show individual paths within a clicked link (WaPo-style)
     */
    showIndividualPathsInLink(linkData) {
        // Clear existing individual paths
        this.svg.selectAll('.individual-flow-path').remove();
        
        if (!linkData.hostages || linkData.hostages.length === 0) return;
        
        // Create individual flow paths within this link
        const linkPath = d3.sankeyLinkHorizontal()(linkData);
        const pathCommands = this.parseSVGPath(linkPath);
        
        // Create individual paths for each hostage in this link
        linkData.hostages.forEach((hostage, index) => {
            this.createIndividualFlowPath(hostage, linkData, index, pathCommands);
        });
        
        // Dim the main link to highlight individual paths
        d3.select(linkData.element).style('stroke-opacity', 0.1);
        
        console.log(`Showing ${linkData.hostages.length} individual paths in link`);
    }
    
    /**
     * Create individual flow path for a single hostage within a link
     */
    createIndividualFlowPath(hostage, linkData, index, pathCommands) {
        const totalPaths = linkData.hostages.length;
        const pathWidth = Math.max(1, linkData.width / totalPaths);
        const offset = (index - (totalPaths - 1) / 2) * (pathWidth * 0.8);
        
        // Create offset path
        const offsetPath = this.createOffsetPath(pathCommands, offset);
        
        const pathElement = this.svg
            .append('path')
            .attr('class', 'individual-flow-path')
            .attr('d', offsetPath)
            .style('fill', 'none')
            .style('stroke', this.getHostageColor(hostage))
            .style('stroke-width', Math.max(1.5, pathWidth))
            .style('stroke-opacity', 0.8)
            .style('cursor', 'pointer')
            .datum(hostage);
        
        // Add interactions for individual path
        pathElement
            .on('mouseover', (event, d) => {
                pathElement.style('stroke-width', Math.max(3, pathWidth * 1.5));
                this.showHostageTooltip(event, d);
            })
            .on('mouseout', () => {
                pathElement.style('stroke-width', Math.max(1.5, pathWidth));
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.highlightCompleteHostagePath(d);
            });
    }
    
    /**
     * Parse SVG path commands for manipulation
     */
    parseSVGPath(pathString) {
        // Simplified path parsing for Bezier curves
        const commands = [];
        const matches = pathString.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
        
        if (matches) {
            matches.forEach(match => {
                const command = match[0];
                const coords = match.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
                commands.push({ command, coords });
            });
        }
        
        return commands;
    }
    
    /**
     * Create offset path for individual flows
     */
    createOffsetPath(pathCommands, offset) {
        let offsetPath = '';
        
        pathCommands.forEach(({ command, coords }) => {
            if (command === 'M') {
                offsetPath += `M ${coords[0]} ${coords[1] + offset} `;
            } else if (command === 'C') {
                offsetPath += `C ${coords[0]} ${coords[1] + offset} ${coords[2]} ${coords[3] + offset} ${coords[4]} ${coords[5] + offset} `;
            } else if (command === 'L') {
                offsetPath += `L ${coords[0]} ${coords[1] + offset} `;
            }
        });
        
        return offsetPath;
    }
    
    /**
     * Get color for individual hostage based on their complete path
     */
    getHostageColor(hostage) {
        const step2 = hostage.step2;
        
        // If hostage is deceased, use gray color
        if (step2 && step2.includes('deceased')) {
            return '#95a5a6'; // Gray for all deceased hostages
        }
        
        // Otherwise use category colors for living hostages
        const colors = {
            'released-deal-living': '#27ae60',          // Living released via deal
            'released-military-living': '#2980b9',      // Living released via military
            'still-held-living': '#f39c12'              // Living still held
        };
        
        return colors[step2] || '#7f8c8d';
    }
    
    /**
     * Show detailed hostage tooltip
     */
    showHostageTooltip(event, hostage) {
        const content = `
            <div class="name">${hostage['Hebrew Name'] || 'ללא שם'}</div>
            <div class="details">
                גיל: ${hostage['Age at Kidnapping'] || 'לא ידוע'}<br>
                מיקום חטיפה: ${hostage['Location Kidnapped (Hebrew)'] || 'לא ידוע'}<br>
                סטטוס: ${hostage['Civilian/Soldier Status'] || 'לא ידוע'}<br>
                מסלול: ${hostage.step1} → ${hostage.step2}
            </div>
        `;
        
        const tooltip = d3.select('#tooltip');
        tooltip.select('.tooltip-content').html(content);
        tooltip.classed('hidden', false);
        
        const [x, y] = d3.pointer(event, document.body);
        tooltip
            .style('left', (x + 10) + 'px')
            .style('top', (y - 10) + 'px');
    }
    
    /**
     * Highlight complete hostage path across all links
     */
    highlightCompleteHostagePath(hostage) {
        // Clear existing highlights
        this.svg.selectAll('.complete-hostage-path').remove();
        
        // Find all links this hostage passes through
        const hostageLinks = this.data.links.filter(link => 
            link.hostages && link.hostages.includes(hostage)
        );
        
        // Create complete path visualization
        hostageLinks.forEach(link => {
            this.svg
                .append('path')
                .attr('class', 'complete-hostage-path')
                .attr('d', d3.sankeyLinkHorizontal()(link))
                .style('fill', 'none')
                .style('stroke', this.getHostageColor(hostage))
                .style('stroke-width', 4)
                .style('stroke-opacity', 1)
                .style('pointer-events', 'none');
        });
        
        console.log(`Highlighted complete path for ${hostage['Hebrew Name']}`);
    }

    /**
     * Clear all selections
     */
    clearSelections() {
        this.selectedPaths.clear();
        this.svg.selectAll('.individual-flow-path').remove();
        this.svg.selectAll('.complete-hostage-path').remove();
        this.svg.selectAll('.sankey-link').style('stroke-opacity', 0.6);
        this.updatePathHighlighting();
    }

    /**
     * Resize diagram
     */
    resize(width, height) {
        this.options.width = width;
        this.options.height = height;
        
        this.container
            .attr('width', width + this.options.margin.left + this.options.margin.right)
            .attr('height', height + this.options.margin.top + this.options.margin.bottom);
        
        // Re-render with new dimensions
        if (this.data) {
            this.render(this.data, this.individualPaths);
        }
    }
}
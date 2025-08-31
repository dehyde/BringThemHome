/**
 * Basic Sankey Implementation using core D3
 * Fallback when d3-sankey library is not available
 */

class BasicSankey {
    constructor() {
        this.nodeWidth = 20;
        this.nodePadding = 10;
        this.size = [1200, 600];
        this.nodes = [];
        this.links = [];
    }

    nodeWidth(width) {
        if (arguments.length === 0) return this._nodeWidth || 20;
        this._nodeWidth = width;
        return this;
    }

    nodePadding(padding) {
        if (arguments.length === 0) return this._nodePadding || 10;
        this._nodePadding = padding;
        return this;
    }

    extent(extent) {
        if (arguments.length === 0) return [[0, 0], this.size];
        this.size = [extent[1][0] - extent[0][0], extent[1][1] - extent[0][1]];
        return this;
    }

    nodeAlign(align) {
        // For compatibility, but we'll use a simple center alignment
        this._nodeAlign = align;
        return this;
    }

    iterations(count) {
        this._iterations = count;
        return this;
    }

    /**
     * Process the sankey data
     */
    call(data) {
        this.nodes = data.nodes.map(d => ({ ...d }));
        this.links = data.links.map(d => ({ ...d }));
        
        // Skip computeNodeDepths - let RTL handler manage x positions
        this.computeNodeValues();
        this.computeNodePositions();
        this.computeLinkPositions();
        
        return data;
    }

    /**
     * Compute node depths (x positions)
     */
    computeNodeDepths() {
        const stepWidth = this.size[0] / 3;
        
        this.nodes.forEach(node => {
            const nodeWidth = this._nodeWidth || 20;
            // RTL: Step 1 (Oct 7) on RIGHT, Step 2 (Final with subgroups) on LEFT
            if (node.step === 1) {
                // Oct 7th status - rightmost position
                node.x0 = this.size[0] - stepWidth;
                node.x1 = node.x0 + nodeWidth;
            } else if (node.step === 2) {
                // Final outcome with subgrouping - leftmost position
                node.x0 = 50; // Leave space for labels
                node.x1 = node.x0 + nodeWidth;
            }
        });
    }

    /**
     * Compute node values from connected links
     */
    computeNodeValues() {
        this.nodes.forEach(node => {
            node.value = 0;
            node.sourceLinks = [];
            node.targetLinks = [];
        });

        this.links.forEach(link => {
            const source = this.nodes[link.source];
            const target = this.nodes[link.target];
            
            source.sourceLinks.push(link);
            target.targetLinks.push(link);
            
            source.value += link.value;
            link.source = source;
            link.target = target;
        });
    }

    /**
     * Compute node vertical positions with subgrouping
     */
    computeNodePositions() {
        // Group nodes by step
        const nodesByStep = {};
        this.nodes.forEach(node => {
            if (!nodesByStep[node.step]) nodesByStep[node.step] = [];
            nodesByStep[node.step].push(node);
        });

        // Position Step 1 nodes (simple)
        if (nodesByStep[1]) {
            const step1Nodes = nodesByStep[1];
            const totalValue = step1Nodes.reduce((sum, node) => sum + node.value, 0);
            const availableHeight = this.size[1] * 0.8;
            
            let y = this.size[1] * 0.1;
            step1Nodes.forEach(node => {
                node.y0 = y;
                const nodeHeight = Math.max(20, (node.value / totalValue) * availableHeight);
                node.y1 = node.y0 + nodeHeight;
                y = node.y1 + (this._nodePadding || 15);
            });
        }

        // Position Step 2 nodes with visual grouping (living/deceased pairs)
        if (nodesByStep[2]) {
            const step2Nodes = nodesByStep[2];
            
            // Group by main category (deal, military, held)
            const subgroups = {
                'deal': step2Nodes.filter(n => n.id && n.id.includes('deal')),
                'military': step2Nodes.filter(n => n.id && n.id.includes('military')), 
                'held': step2Nodes.filter(n => n.id && n.id.includes('held'))
            };
            
            const sectionHeight = this.size[1] / 3;
            let sectionY = 0;
            
            Object.values(subgroups).forEach(groupNodes => {
                if (groupNodes.length === 0) return;
                
                // Sort: living first (top), then deceased (bottom)
                groupNodes.sort((a, b) => {
                    const aSubgroup = a.subgroup || 'none';
                    const bSubgroup = b.subgroup || 'none';
                    if (aSubgroup === 'living' && bSubgroup === 'deceased') return -1;
                    if (aSubgroup === 'deceased' && bSubgroup === 'living') return 1;
                    return 0;
                });
                
                const totalValue = groupNodes.reduce((sum, node) => sum + node.value, 0);
                let y = sectionY + 20; // More padding between groups
                
                groupNodes.forEach((node, index) => {
                    node.y0 = y;
                    // Make nodes proportional to their values but with minimum height
                    const proportion = totalValue > 0 ? node.value / totalValue : 1 / groupNodes.length;
                    const nodeHeight = Math.max(20, proportion * (sectionHeight - 60));
                    node.y1 = node.y0 + nodeHeight;
                    y = node.y1 + 2; // Small gap between living/deceased pair
                });
                
                sectionY += sectionHeight;
            });
        }
    }

    /**
     * Compute link positions
     */
    computeLinkPositions() {
        this.links.forEach(link => {
            link.y0 = link.source.y0 + link.source.sourceLinks.indexOf(link) * 2;
            link.y1 = link.target.y0 + link.target.targetLinks.indexOf(link) * 2;
            link.width = Math.max(1, link.value * 3);
        });
    }
}

/**
 * Basic Sankey Link Path Generator
 */
class BasicSankeyLinkHorizontal {
    call(link) {
        const x0 = link.source.x1;
        const x1 = link.target.x0;
        const xi = d3.interpolateNumber(x0, x1);
        const x2 = xi(0.75);
        const x3 = xi(0.25);
        const y0 = link.y0;
        const y1 = link.y1;

        return `M${x0},${y0}C${x2},${y0} ${x3},${y1} ${x1},${y1}`;
    }
}

// Export basic sankey functions to global d3 object if d3-sankey is not available
if (typeof d3 !== 'undefined' && typeof d3.sankey === 'undefined') {
    console.log('Using basic Sankey implementation as fallback');
    
    d3.sankey = function() {
        return new BasicSankey();
    };
    
    d3.sankeyLinkHorizontal = function() {
        const link = new BasicSankeyLinkHorizontal();
        return function(d) {
            return link.call(d);
        };
    };
    
    // Add other sankey functions for compatibility
    d3.sankeyJustify = function() { return 0; };
}
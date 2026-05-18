(function (global) {
    const NODE_RADIUS = 32;
    const GRAPH_HEIGHT = 460;
    const HORIZONTAL_PADDING = 52;
    const VERTICAL_PADDING = 48;

    function resolveNodeId(nodeOrId) {
        return typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
    }

    function edgeMatches(edge, leftId, rightId) {
        const sourceId = resolveNodeId(edge.source);
        const targetId = resolveNodeId(edge.target);

        return (sourceId === leftId && targetId === rightId) || (sourceId === rightId && targetId === leftId);
    }

    function formatContributionLabel(contribution, options = {}) {
        const coefficientLabel = global.GNNCore.formatNumber(contribution.coefficient, 2);

        if (typeof contribution.attentionLogit === "number") {
            return options.isSelf ? `self \u03b1=${coefficientLabel}` : `\u03b1=${coefficientLabel}`;
        }

        return options.isSelf ? `self \u00d7 ${coefficientLabel}` : `\u00d7 ${coefficientLabel}`;
    }

    function getEdgeLabelPosition(sourceNode, targetNode, offsetDistance = 20) {
        const deltaX = targetNode.x - sourceNode.x;
        const deltaY = targetNode.y - sourceNode.y;
        const edgeLength = Math.hypot(deltaX, deltaY) || 1;
        let normalX = -deltaY / edgeLength;
        let normalY = deltaX / edgeLength;

        if (normalY > 0) {
            normalX *= -1;
            normalY *= -1;
        }

        return {
            x: ((sourceNode.x + targetNode.x) / 2) + (normalX * offsetDistance),
            y: ((sourceNode.y + targetNode.y) / 2) + (normalY * offsetDistance)
        };
    }

    class GraphRenderer {
        constructor(options) {
            this.container = document.querySelector(options.graphSelector);
            this.svg = null;
            this.edgeSelection = null;
            this.nodeSelection = null;
            this.messageLayer = null;
            this.width = 640;
            this.height = GRAPH_HEIGHT;
        }

        render(nodes, edges) {
            if (!this.container) {
                return;
            }

            this.clearGraph();

            this.width = Math.max(Math.floor(this.container.getBoundingClientRect().width), 520);
            this.height = GRAPH_HEIGHT;

            this.svg = d3.select(this.container)
                .append("svg")
                .attr("class", "graph-canvas")
                .attr("viewBox", `0 0 ${this.width} ${this.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const baseLayer = this.svg.append("g").attr("class", "graph-base-layer");
            this.messageLayer = this.svg.append("g").attr("class", "graph-message-layer");

            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(edges).id(node => node.id).distance(160).strength(1))
                .force("charge", d3.forceManyBody().strength(-760))
                .force("center", d3.forceCenter(this.width / 2, this.height / 2))
                .force("collision", d3.forceCollide().radius(NODE_RADIUS + 34));

            for (let tick = 0; tick < 260; tick += 1) {
                simulation.tick();
            }
            simulation.stop();

            this.fitNodesToViewport(nodes);

            nodes.forEach(node => {
                node.x = Math.min(Math.max(node.x, HORIZONTAL_PADDING), this.width - HORIZONTAL_PADDING);
                node.y = Math.min(Math.max(node.y, VERTICAL_PADDING), this.height - (VERTICAL_PADDING + 24));
            });

            this.edgeSelection = baseLayer.append("g")
                .attr("class", "edge-layer")
                .selectAll("line")
                .data(edges)
                .join("line")
                .attr("class", "edge");

            this.nodeSelection = baseLayer.append("g")
                .attr("class", "node-layer")
                .selectAll("g")
                .data(nodes, node => node.id)
                .join(enter => {
                    const group = enter.append("g")
                        .attr("class", "node-group")
                        .attr("data-node-id", node => node.id);

                    group.append("circle")
                        .attr("class", "node-self-ring")
                        .attr("r", NODE_RADIUS + 10);

                    group.append("circle")
                        .attr("class", "node")
                        .attr("r", NODE_RADIUS);

                    group.append("text")
                        .attr("class", "node-label")
                        .attr("dy", "0.35em")
                        .text(node => node.id);

                    group.append("text")
                        .attr("class", "node-features")
                        .attr("y", NODE_RADIUS + 24)
                        .text(node => global.GNNCore.formatVector(node.features, 2));

                    group.append("title")
                        .text(node => `${node.id} ${global.GNNCore.formatVector(node.features, 3)}`);

                    return group;
                });

            this.syncPositions();
            this.syncFeatureLabels();
        }

        fitNodesToViewport(nodes) {
            if (!nodes.length) {
                return;
            }

            if (nodes.length === 1) {
                nodes[0].x = this.width / 2;
                nodes[0].y = this.height / 2;
                return;
            }

            const xValues = nodes.map(node => node.x);
            const yValues = nodes.map(node => node.y);
            const minX = Math.min(...xValues);
            const maxX = Math.max(...xValues);
            const minY = Math.min(...yValues);
            const maxY = Math.max(...yValues);
            const spanX = Math.max(maxX - minX, 1);
            const spanY = Math.max(maxY - minY, 1);
            const availableWidth = this.width - (HORIZONTAL_PADDING * 2);
            const availableHeight = this.height - ((VERTICAL_PADDING * 2) + 52);
            const scale = Math.min(availableWidth / spanX, availableHeight / spanY);
            const usedWidth = spanX * scale;
            const usedHeight = spanY * scale;
            const offsetX = HORIZONTAL_PADDING + ((availableWidth - usedWidth) / 2);
            const offsetY = VERTICAL_PADDING + ((availableHeight - usedHeight) / 2);

            nodes.forEach(node => {
                node.x = offsetX + ((node.x - minX) * scale);
                node.y = offsetY + ((node.y - minY) * scale);
            });
        }

        clearGraph() {
            if (this.svg) {
                this.svg.selectAll("*").interrupt();
                this.svg.remove();
            }

            this.svg = null;
            this.edgeSelection = null;
            this.nodeSelection = null;
            this.messageLayer = null;
            this.container.innerHTML = "";
        }

        syncPositions() {
            if (!this.edgeSelection || !this.nodeSelection) {
                return;
            }

            this.edgeSelection
                .attr("x1", edge => edge.source.x)
                .attr("y1", edge => edge.source.y)
                .attr("x2", edge => edge.target.x)
                .attr("y2", edge => edge.target.y);

            this.nodeSelection
                .attr("transform", node => `translate(${node.x}, ${node.y})`);
        }

        syncFeatureLabels() {
            if (!this.nodeSelection) {
                return;
            }

            this.nodeSelection.select(".node-features")
                .text(node => global.GNNCore.formatVector(node.features, 2));

            this.nodeSelection.select("title")
                .text(node => `${node.id} ${global.GNNCore.formatVector(node.features, 3)}`);
        }

        setNodeFeaturePreview(nodeId, features) {
            if (!this.nodeSelection) {
                return;
            }

            this.nodeSelection
                .filter(node => node.id === nodeId)
                .select(".node-features")
                .text(global.GNNCore.formatVector(features, 2));
        }

        resetVisualState() {
            if (this.nodeSelection) {
                this.nodeSelection
                    .classed("node-target", false)
                    .classed("node-source", false)
                    .classed("node-updated", false);
            }

            if (this.edgeSelection) {
                this.edgeSelection.classed("edge-active", false);
            }

            if (this.messageLayer) {
                this.messageLayer.selectAll("*").remove();
            }
        }

        highlightStep(step) {
            if (!this.nodeSelection || !this.edgeSelection) {
                return;
            }

            const sourceIds = new Set(step.contributions.map(contribution => contribution.sourceId));

            this.nodeSelection
                .classed("node-target", node => node.id === step.nodeId)
                .classed("node-source", node => sourceIds.has(node.id) && node.id !== step.nodeId);

            this.edgeSelection
                .classed("edge-active", edge => {
                    return step.contributions.some(contribution => {
                        if (contribution.isSelf) {
                            return false;
                        }

                        return edgeMatches(edge, step.nodeId, contribution.sourceId);
                    });
                });
        }

        animateMessages(step, options = {}) {
            if (!this.messageLayer) {
                return Promise.resolve();
            }

            const duration = options.duration || 700;

            this.resetVisualState();
            this.highlightStep(step);

            const animations = step.contributions.map(contribution => {
                if (contribution.isSelf) {
                    return this.animateSelfContribution(step, contribution, duration);
                }

                return this.animateEdgeContribution(step, contribution, duration);
            });

            return Promise.all(animations).then(() => undefined);
        }

        animateEdgeContribution(step, contribution, duration) {
            const sourceNode = this.getNode(step.nodeId === contribution.sourceId ? step.nodeId : contribution.sourceId);
            const targetNode = this.getNode(step.nodeId);

            if (!sourceNode || !targetNode) {
                return Promise.resolve();
            }

            this.showEdgeContributionLabel(sourceNode, targetNode, contribution, duration);

            const token = this.messageLayer.append("g")
                .attr("class", "message-token-group")
                .attr("transform", `translate(${sourceNode.x}, ${sourceNode.y})`);

            token.append("circle")
                .attr("class", "message-token")
                .attr("r", 15);

            token.append("text")
                .attr("class", "message-token-label")
                .attr("dy", "0.35em")
                .text(contribution.sourceId);

            return new Promise(resolve => {
                token.transition()
                    .duration(duration)
                    .ease(d3.easeCubicInOut)
                    .attr("transform", `translate(${targetNode.x}, ${targetNode.y})`)
                    .on("end", () => {
                        token.remove();
                        resolve();
                    });
            });
        }

        animateSelfContribution(step, contribution, duration) {
            const targetNode = this.getNode(step.nodeId);

            if (!targetNode) {
                return Promise.resolve();
            }

            const pulse = this.messageLayer.append("circle")
                .attr("class", "self-pulse")
                .attr("cx", targetNode.x)
                .attr("cy", targetNode.y)
                .attr("r", NODE_RADIUS)
                .style("opacity", 0.45);

            const badge = this.messageLayer.append("text")
                .attr("class", "coefficient-badge")
                .attr("x", targetNode.x)
                .attr("y", targetNode.y - NODE_RADIUS - 18)
                .text(formatContributionLabel(contribution, { isSelf: true }))
                .style("opacity", 0);

            return new Promise(resolve => {
                pulse.transition()
                    .duration(duration)
                    .ease(d3.easeCubicOut)
                    .attr("r", NODE_RADIUS + 18)
                    .style("opacity", 0)
                    .on("end", () => {
                        pulse.remove();
                        resolve();
                    });

                badge.transition()
                    .duration(duration * 0.4)
                    .style("opacity", 1)
                    .transition()
                    .duration(duration * 0.6)
                    .style("opacity", 0)
                    .on("end", () => badge.remove());
            });
        }

        animateNodeUpdate(step, options = {}) {
            if (!this.messageLayer) {
                return Promise.resolve();
            }

            const duration = options.duration || 520;
            const targetNode = this.getNode(step.nodeId);

            if (!targetNode) {
                return Promise.resolve();
            }

            this.nodeSelection
                .classed("node-updated", node => node.id === step.nodeId);

            const ripple = this.messageLayer.append("circle")
                .attr("class", "node-update-ripple")
                .attr("cx", targetNode.x)
                .attr("cy", targetNode.y)
                .attr("r", NODE_RADIUS + 4)
                .style("opacity", 0.6);

            this.setNodeFeaturePreview(step.nodeId, step.updatedFeatures);

            return new Promise(resolve => {
                ripple.transition()
                    .duration(duration)
                    .ease(d3.easeCubicOut)
                    .attr("r", NODE_RADIUS + 34)
                    .style("opacity", 0)
                    .on("end", () => {
                        ripple.remove();
                        resolve();
                    });
            });
        }

        showEdgeContributionLabel(sourceNode, targetNode, contribution, duration) {
            if (!this.messageLayer) {
                return;
            }

            const position = getEdgeLabelPosition(sourceNode, targetNode);
            const labelGroup = this.messageLayer.append("g")
                .attr("class", "edge-weight-label-group")
                .attr("transform", `translate(${position.x}, ${position.y})`)
                .style("opacity", 0);

            const labelText = labelGroup.append("text")
                .attr("class", "edge-weight-label")
                .attr("dy", "0.35em")
                .text(formatContributionLabel(contribution));

            const bounds = labelText.node().getBBox();

            labelGroup.insert("rect", "text")
                .attr("class", "edge-weight-label-pill")
                .attr("x", bounds.x - 8)
                .attr("y", bounds.y - 4)
                .attr("width", bounds.width + 16)
                .attr("height", bounds.height + 8)
                .attr("rx", (bounds.height / 2) + 4)
                .attr("ry", (bounds.height / 2) + 4);

            labelGroup.transition()
                .duration(duration * 0.22)
                .style("opacity", 1)
                .transition()
                .duration(duration * 0.78)
                .style("opacity", 0)
                .on("end", () => labelGroup.remove());
        }

        getNode(nodeId) {
            if (!this.nodeSelection) {
                return null;
            }

            const match = this.nodeSelection.data().find(node => node.id === nodeId);
            return match || null;
        }
    }

    global.GNNRenderer = {
        GraphRenderer
    };
}(window));
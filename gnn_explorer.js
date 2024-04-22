document.getElementById("messagePassingButton").disabled = true;
document.getElementById("featureAggregationButton").disabled = true;
//document.getElementById("resetButton").disabled = true;

/** * Global Variables * * **/
let svg = null;
const messageDuration = 1000;
const aggregationDuration = 1000;
let timeoutId;
//let aggregationTimeoutID;
let nodes = [];
let edges = [];
let initialNodes = [];

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function arraysHaveSameElements(arr1, arr2) {
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();

    if (sortedArr1.length !== sortedArr2.length) {
        return false;
    }

    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }

    return true;
}

function createGraph() {
    const nodeCount = parseInt(document.getElementById("nodeCount").value);
    let maxNeighborCount = parseInt(document.getElementById("maxNeighborCount").value);
    maxNeighborCount = nodeCount < maxNeighborCount ? nodeCount : maxNeighborCount;
    nodes = [];
    edges = [];

    // Create nodes with random features
    for (let i = 0; i < nodeCount; i++) {
        const node = { id: String.fromCharCode(65 + i), features: [Math.random(), Math.random()] };
        nodes.push(node);
    }

    // Create edges
    for (let i = 0; i < nodeCount; i++) {
        let currentNode = nodes[i];
        let numberOfEdges = randomInteger(nodeCount <= 1 ? 0 : 1, nodeCount <= 1 ? 0 : maxNeighborCount);
        console.log(numberOfEdges);
        let nodesWithoutSource = Array.from(nodes);
        nodesWithoutSource.splice(nodes.indexOf(currentNode), 1);
        let nodesWithoutSourceRandom = nodesWithoutSource.sort(function () { return 0.5 - Math.random() }).slice(0, numberOfEdges);

        for (let j = 0; j < nodesWithoutSourceRandom.length; j++) {
            const edge = { source: currentNode.id, target: nodesWithoutSourceRandom[j].id };
            let exists = edges.some(element => {
                const a = [element.source, element.target];
                const b = [edge.target, edge.source];
                return arraysHaveSameElements(a, b);
            });
            if (!exists) { edges.push(edge); }
        }
    }

    initialNodes = nodes.map(node => ({ id: node.id, features: [...node.features] }));

    // Clear previous graph
    d3.select("#graph").html("");

    // Render the new graph
    renderGraph();
    document.getElementById("graph-buttons").style.display = "block";
}

function renderGraph() {
    const width = 600;
    const height = 400;
    const nodeRadius = 30;

    svg = d3.select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", "#999")
        .style("stroke", "none");

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(edges).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
        .selectAll("line")
        .data(edges)
        .join("line")
        .attr("class", "edge");

    const node = svg.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("id", d => `node-${d.id}`)
        .attr("class", "node")
        .attr("r", nodeRadius)
        .on("click", (event, d) => {
            alert(`Node ${d.id} Features: [${d.features.join(", ")}]`);
        });

    const nodeLabel = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("class", "node-label")
        .text(d => d.id);

    const nodeFeatures = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("id", d => `node-features-${d.id}`)
        .attr("class", "node-features")
        .attr("y", 15)
        .text(d => `[${d.features.map(val => val.toFixed(2)).join(", ")}]`);

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        nodeLabel
            .attr("x", d => d.x)
            .attr("y", d => d.y);

        nodeFeatures
            .attr("x", d => d.x)
            .attr("y", d => d.y + nodeRadius + 15);
    });
}

function startGraph() {
    createGraph();
    //svg.style("visibility", "visible");
    d3.select("#messagePassingButton").attr("disabled", null);
}

function startMessagePassing() {
    let totalDelay = 0;

    nodes.forEach((node, nodeIndex) => {
        const neighbors = edges.filter(edge => edge.source.id === node.id || edge.target.id === node.id)
            .map(edge => edge.source.id === node.id ? nodes.find(n => n.id === edge.target.id) : nodes.find(n => n.id === edge.source.id));

        timeoutId = setTimeout(() => {
            const messages = [];

            neighbors.forEach((neighbor, neighborIndex) => {
                const messageGroup = svg.append("g")
                    .attr("class", "message-group");

                const messageIcon = messageGroup.append("text")
                    .attr("class", "message-icon")
                    .attr("x", neighbor.x)
                    .attr("y", neighbor.y)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .attr("class", "fa")
                    .attr("font-weight", 900)
                    .attr("font-size", "20px")
                    .attr("fill", "#FFC300")
                    .text(function (d) { return '\uf0e0' });

                messages.push(messageIcon);
            });

            messages.forEach(message => {
                message.transition()
                    .duration(messageDuration)
                    .attr("x", node.x)
                    .attr("y", node.y)
                    .on("start", () => {
                        d3.select(`#node-${node.id}`)
                            .style("fill", "orange");
                    })
                    .on("end", () => {
                        message.remove();
                        d3.select(`#node-${node.id}`)
                            .style("fill", "#69b3a2")
                    });
            });
        }, totalDelay);

        totalDelay += messageDuration;
    });

    timeoutId = setTimeout(() => {
        d3.select("#featureAggregationButton").attr("disabled", null);
        d3.select("#messagePassingButton").attr("disabled", true);
    }, totalDelay);
}

// Step 3: Feature Aggregation and Update
// Simple feature aggregation is being used
// Sum of all the neighboring node's features + current node's features
// Finally each feature inside the feature array is divided by the
// length of (neighboring nodes and current nodes).
function startFeatureAggregation() {
    const aggregationPanel = document.getElementById('aggregation-panel');
    const aggregationPanelChild = document.createElement("div");
    aggregationPanelChild.id = "aggregation-panel-child";
    console.log(aggregationPanelChild);
    aggregationPanel.append(aggregationPanelChild);
    const nodes_ = structuredClone(nodes);

    nodes.forEach((node, index) => {
        timeoutId = setTimeout(() => {
            const neighbors = edges.filter(edge => edge.source.id === node.id || edge.target.id === node.id)
                .map(edge => edge.source.id === node.id ? nodes_.find(n => n.id === edge.target.id) : nodes_.find(n => n.id === edge.source.id));

            const neighborFeatures = neighbors.map(neighbor => neighbor.features);

            if (neighborFeatures.length > 0) {
                const currentFeatures = node.features;
                const aggregatedFeatures = neighborFeatures.reduce((acc, features) => {
                    return acc.map((val, i) => val + features[i]);
                }).map((val, i) => val + currentFeatures[i]);

                const updatedFeatures = aggregatedFeatures.map(val => val / (neighborFeatures.length + 1));
                node.features = updatedFeatures;

                const aggregationStep = document.createElement("div");
                aggregationStep.className = "aggregation-step";
                //aggregationPanel.innerHTML = "";
                aggregationPanelChild.prepend(aggregationStep);

                const aggregationStepTitle = document.createElement("h4");
                aggregationStepTitle.className = "title is-4";
                aggregationStepTitle.textContent = `Aggregation for Node ${node.id}`;
                aggregationStep.appendChild(aggregationStepTitle);

                const mathEquation = document.createElement("div");
                mathEquation.className = "math-equation";
                aggregationStep.appendChild(mathEquation);

                const nodeFeatureTex = `\\mathbf{f}_{${node.id}}`;
                const neighborFeaturesTex = neighborFeatures.map((features, i) => `\\mathbf{f}_{${neighbors[i].id}}`).join(' + ');
                const aggregatedFeaturesTex = `(${nodeFeatureTex} + ${neighborFeaturesTex})`;
                const updatedFeatureTex = `\\frac{${aggregatedFeaturesTex}}{${neighborFeatures.length + 1}}`;

                const latexEquation = `\\mathbf{f}_{${node.id}}' = ${updatedFeatureTex}`;

                mathEquation.innerHTML = (`
                    <p>$$${latexEquation}$$</p>
                    <p>$$${nodeFeatureTex} = [${currentFeatures.map(val => val.toFixed(2)).join(', ')}]$$</p>
                    ${neighborFeatures.map((features, i) => `<p>$$\\mathbf{f}_{${neighbors[i].id}} = [${features.map(val => val.toFixed(2)).join(', ')}]$$</p>`).join('')}
                    <p>$$(${nodeFeatureTex} + ${neighborFeaturesTex}) = [${aggregatedFeatures.map(val => val.toFixed(2)).join(', ')}]$$</p>
                    <p>$$${updatedFeatureTex} = [${updatedFeatures.map(val => val.toFixed(2)).join(', ')}]$$</p>
                `);

                setTimeout(() => {
                    aggregationStep.classList.add("visible");
            }, 100);

                MathJax.typeset();
            }

            d3.select(`#node-features-${node.id}`)
                .text(`[${node.features.map(val => val.toFixed(2)).join(", ")}]`);

            d3.select(`#node-${node.id}`)
                .style("fill", "red");
        }, index * aggregationDuration * 2);
    });

    d3.select("#featureAggregationButton").attr("disabled", true);
}

function resetGraph() {
    console.log(timeoutId);
    //console.log(messagePassingTimeoutID);
    clearTimeout(timeoutId);
    //clearTimeout(messagePassingTimeoutID);

    d3.selectAll(".node").style("fill", "#69b3a2");
    svg.style("visibility", "hidden");

    d3.select("#messagePassingButton").attr("disabled", true);
    d3.select("#featureAggregationButton").attr("disabled", true);
    
    const aggregationPanel = document.getElementById('aggregation-panel');
    aggregationPanel.removeChild(document.getElementById("aggregation-panel-child"));
}
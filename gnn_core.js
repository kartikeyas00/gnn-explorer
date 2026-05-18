(function (global) {
    const FEATURE_DIMENSION = 2;
    const DEFAULT_WEIGHT_MATRIX = [
        [0.85, 0.15],
        [0.25, 0.75]
    ];
    const DEFAULT_GAT_WEIGHT_MATRIX = [
        [0.7, 0.3],
        [0.15, 0.95]
    ];
    const DEFAULT_ATTENTION_VECTOR = [0.55, -0.35, 0.75, 0.15];
    const GCN_STAGE_DEFINITIONS = [
        {
            key: "messagePassing",
            label: "Message Passing",
            description: "Collect normalized neighborhood messages before the node state is updated."
        },
        {
            key: "update",
            label: "Update",
            description: "Apply the shared transformation and write the new embedding back onto the graph."
        }
    ];
    const GAT_STAGE_DEFINITIONS = [
        {
            key: "messagePassing",
            label: "Message Passing",
            description: "Project the neighborhood, score each neighbor with attention, and build weighted messages."
        },
        {
            key: "update",
            label: "Update",
            description: "Sum the attention-weighted messages and write the new embedding back onto the graph."
        }
    ];

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function cloneVector(vector) {
        return vector.slice();
    }

    function cloneMatrix(matrix) {
        return matrix.map(row => row.slice());
    }

    function zeroVector(length) {
        return Array.from({ length }, () => 0);
    }

    function addVectors(left, right) {
        return left.map((value, index) => value + right[index]);
    }

    function scaleVector(vector, scalar) {
        return vector.map(value => value * scalar);
    }

    function multiplyVectorMatrix(vector, matrix) {
        return matrix[0].map((_, columnIndex) => {
            return vector.reduce((sum, value, rowIndex) => sum + (value * matrix[rowIndex][columnIndex]), 0);
        });
    }

    function dotProduct(left, right) {
        return left.reduce((sum, value, index) => sum + (value * right[index]), 0);
    }

    function concatenateVectors(left, right) {
        return left.concat(right);
    }

    function leakyReLU(value, slope = 0.2) {
        return value >= 0 ? value : value * slope;
    }

    function softmax(values) {
        const largestValue = Math.max(...values);
        const exponentials = values.map(value => Math.exp(value - largestValue));
        const total = exponentials.reduce((sum, value) => sum + value, 0);

        return exponentials.map(value => value / total);
    }

    function formatNumber(value, digits = 3) {
        return Number(value).toFixed(digits);
    }

    function formatVector(vector, digits = 2) {
        return `[${vector.map(value => formatNumber(value, digits)).join(", ")}]`;
    }

    function toTeXVector(vector, digits = 3) {
        return `\\begin{bmatrix}${vector.map(value => formatNumber(value, digits)).join(' \\\\ ')}\\end{bmatrix}`;
    }

    function toTeXMatrix(matrix, digits = 2) {
        return `\\begin{bmatrix}${matrix.map(row => row.map(value => formatNumber(value, digits)).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
    }

    function randomFeatureValue() {
        return Number((0.15 + (Math.random() * 0.8)).toFixed(2));
    }

    function createNodeLabel(index) {
        return String.fromCharCode(65 + index);
    }

    function edgeKey(leftId, rightId) {
        return [leftId, rightId].sort().join("::");
    }

    function shuffled(list) {
        const copy = list.slice();

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const temporary = copy[index];
            copy[index] = copy[swapIndex];
            copy[swapIndex] = temporary;
        }

        return copy;
    }

    function createRandomGraph(nodeCount, maxNeighborCount) {
        const safeNodeCount = clamp(Number.isFinite(nodeCount) ? nodeCount : 4, 1, 10);
        const maxPossibleNeighbors = Math.max(safeNodeCount - 1, 0);
        const safeMaxNeighborCount = maxPossibleNeighbors === 0
            ? 0
            : clamp(Number.isFinite(maxNeighborCount) ? maxNeighborCount : 3, 1, maxPossibleNeighbors);

        const nodes = Array.from({ length: safeNodeCount }, (_, index) => ({
            id: createNodeLabel(index),
            features: Array.from({ length: FEATURE_DIMENSION }, () => randomFeatureValue())
        }));

        const edges = [];
        const existingEdges = new Set();
        const degreeById = new Map(nodes.map(node => [node.id, 0]));

        function canConnect(leftId, rightId) {
            if (leftId === rightId) {
                return false;
            }

            if (existingEdges.has(edgeKey(leftId, rightId))) {
                return false;
            }

            return degreeById.get(leftId) < safeMaxNeighborCount && degreeById.get(rightId) < safeMaxNeighborCount;
        }

        function addEdge(leftId, rightId) {
            if (!canConnect(leftId, rightId)) {
                return false;
            }

            edges.push({ source: leftId, target: rightId });
            existingEdges.add(edgeKey(leftId, rightId));
            degreeById.set(leftId, degreeById.get(leftId) + 1);
            degreeById.set(rightId, degreeById.get(rightId) + 1);
            return true;
        }

        if (safeNodeCount === 2) {
            addEdge(nodes[0].id, nodes[1].id);
        } else if (safeNodeCount > 2 && safeMaxNeighborCount >= 2) {
            for (let index = 1; index < nodes.length; index += 1) {
                const currentNode = nodes[index];
                const candidateParents = shuffled(nodes.slice(0, index).filter(node => degreeById.get(node.id) < safeMaxNeighborCount));

                for (const candidateParent of candidateParents) {
                    if (addEdge(currentNode.id, candidateParent.id)) {
                        break;
                    }
                }
            }
        } else if (safeNodeCount > 1 && safeMaxNeighborCount === 1) {
            for (let index = 1; index < nodes.length; index += 2) {
                addEdge(nodes[index - 1].id, nodes[index].id);
            }
        }

        const candidateEdges = [];
        for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
                candidateEdges.push([nodes[leftIndex].id, nodes[rightIndex].id]);
            }
        }

        shuffled(candidateEdges).forEach(([leftId, rightId]) => {
            if (Math.random() < 0.55) {
                addEdge(leftId, rightId);
            }
        });

        return {
            nodes,
            edges,
            maxNeighborCount: safeMaxNeighborCount
        };
    }

    class GraphStore {
        constructor() {
            this.nodes = [];
            this.edges = [];
            this.initialFeaturesById = new Map();
            this.layerIndex = 0;
        }

        createRandomGraph(nodeCount, maxNeighborCount) {
            const graph = createRandomGraph(nodeCount, maxNeighborCount);

            this.nodes = graph.nodes;
            this.edges = graph.edges;
            this.initialFeaturesById = new Map(this.nodes.map(node => [node.id, cloneVector(node.features)]));
            this.layerIndex = 0;

            return graph;
        }

        getNodes() {
            return this.nodes;
        }

        getEdges() {
            return this.edges;
        }

        getRenderableEdges() {
            return this.edges.map(edge => ({ source: edge.source, target: edge.target }));
        }

        getNodeById(nodeId) {
            return this.nodes.find(node => node.id === nodeId);
        }

        getNeighbors(nodeId) {
            const neighborIds = this.edges.reduce((list, edge) => {
                if (edge.source === nodeId) {
                    list.push(edge.target);
                } else if (edge.target === nodeId) {
                    list.push(edge.source);
                }

                return list;
            }, []);

            return neighborIds
                .map(neighborId => this.getNodeById(neighborId))
                .sort((leftNode, rightNode) => leftNode.id.localeCompare(rightNode.id));
        }

        getNeighborhoodWithSelf(nodeId) {
            const node = this.getNodeById(nodeId);
            return [node].concat(this.getNeighbors(nodeId));
        }

        getDegreeWithSelf(nodeId) {
            return this.getNeighborhoodWithSelf(nodeId).length;
        }

        applyLayerResult(layerResult) {
            layerResult.outputNodes.forEach(outputNode => {
                const node = this.getNodeById(outputNode.id);
                node.features = cloneVector(outputNode.features);
            });
            this.layerIndex += 1;
        }

        restoreInitialFeatures() {
            this.nodes.forEach(node => {
                node.features = cloneVector(this.initialFeaturesById.get(node.id) || node.features);
            });
            this.layerIndex = 0;
        }
    }

    class GCNLayer {
        constructor(options = {}) {
            this.key = "gcn";
            this.label = "Graph Convolutional Network";
            this.shortDescription = "Symmetric degree-normalized aggregation with self-loops and a shared weight matrix.";
            this.stageDefinitions = GCN_STAGE_DEFINITIONS.map(stage => ({ ...stage }));
            this.weightMatrix = cloneMatrix(options.weightMatrix || DEFAULT_WEIGHT_MATRIX);
            this.formulaTeX = "\\mathbf{H}^{(l+1)} = \\hat{D}^{-1/2}\\hat{A}\\hat{D}^{-1/2}\\mathbf{H}^{(l)}\\mathbf{W}";
            this.nodeFormulaTeX = "\\mathbf{h}_i^{(l+1)} = \\left(\\sum_{j \\in \\mathcal{N}(i) \\cup \\{i\\}} \\frac{1}{\\sqrt{\\hat{d}_i \\hat{d}_j}} \\mathbf{h}_j^{(l)}\\right) \\mathbf{W}";
            this.parameterTeXBlocks = [
                `\\mathbf{W} = ${toTeXMatrix(this.weightMatrix, 2)}`
            ];
        }

        compute(graphStore) {
            const inputFeaturesById = new Map(graphStore.getNodes().map(node => [node.id, cloneVector(node.features)]));
            const layerNumber = graphStore.layerIndex + 1;
            const steps = graphStore.getNodes().map(node => this.computeNodeStep(node, graphStore, inputFeaturesById, layerNumber));

            return {
                modelKey: this.key,
                modelLabel: this.label,
                layerNumber,
                weightMatrix: cloneMatrix(this.weightMatrix),
                formulaTeX: this.formulaTeX,
                nodeFormulaTeX: this.nodeFormulaTeX,
                steps,
                outputNodes: steps.map(step => ({
                    id: step.nodeId,
                    features: cloneVector(step.updatedFeatures)
                }))
            };
        }

        computeNodeStep(node, graphStore, inputFeaturesById, layerNumber) {
            const sources = graphStore.getNeighborhoodWithSelf(node.id);
            const targetDegree = sources.length;
            const inputLayerNumber = layerNumber - 1;

            const contributions = sources.map(sourceNode => {
                const sourceDegree = graphStore.getDegreeWithSelf(sourceNode.id);
                const coefficient = 1 / Math.sqrt(targetDegree * sourceDegree);
                const sourceFeatures = cloneVector(inputFeaturesById.get(sourceNode.id));
                const normalizedFeatures = scaleVector(sourceFeatures, coefficient);

                return {
                    sourceId: sourceNode.id,
                    isSelf: sourceNode.id === node.id,
                    sourceDegree,
                    coefficient,
                    sourceFeatures,
                    normalizedFeatures,
                    summaryLabel: sourceNode.id === node.id ? `${sourceNode.id} → ${node.id} (self-loop)` : `${sourceNode.id} → ${node.id}`,
                    detailTeX: `\\frac{1}{\\sqrt{${targetDegree} \\cdot ${sourceDegree}}} = ${formatNumber(coefficient, 3)}`,
                    vectorRows: [
                        {
                            label: "Source",
                            vector: sourceFeatures
                        },
                        {
                            label: "Normalized",
                            vector: normalizedFeatures
                        }
                    ]
                };
            });

            const aggregatedFeatures = contributions.reduce((sum, contribution) => {
                return addVectors(sum, contribution.normalizedFeatures);
            }, zeroVector(FEATURE_DIMENSION));
            const updatedFeatures = multiplyVectorMatrix(aggregatedFeatures, this.weightMatrix);
            const neighborhoodIds = contributions.map(contribution => contribution.sourceId).join(', ');
            const messageTerms = contributions.map(contribution => {
                return `\\frac{1}{\\sqrt{${targetDegree} \\cdot ${contribution.sourceDegree}}}\\,\\mathbf{h}_{${contribution.sourceId}}^{(${inputLayerNumber})}`;
            });
            const aggregateSymbol = `\\mathbf{s}_{${node.id}}`;

            return {
                nodeId: node.id,
                targetDegree,
                contributions,
                aggregatedFeatures,
                updatedFeatures,
                weightMatrix: cloneMatrix(this.weightMatrix),
                messageTitle: `Node ${node.id} Message Passing`,
                messageDescription: `This node is collecting symmetric degree-normalized messages from every one-hop neighbor plus its self-loop before the shared transform is applied.`,
                messagePills: [
                    {
                        text: `Neighborhood with self-loop: ${neighborhoodIds}`
                    },
                    {
                        tex: `\\hat{d}_{${node.id}} = ${targetDegree}`
                    }
                ],
                messageTeXBlocks: [
                    `${aggregateSymbol} = ${messageTerms.join(' + ')}`,
                    `${aggregateSymbol} = ${toTeXVector(aggregatedFeatures, 3)}`
                ],
                messageSummaryVector: cloneVector(aggregatedFeatures),
                updateTitle: `Node ${node.id} Update`,
                updateDescription: `Update multiplies the stored neighborhood summary by the shared GCN weight matrix and writes the new embedding back onto the graph.`,
                updateTeXBlocks: [
                    `\\mathbf{W} = ${toTeXMatrix(this.weightMatrix, 2)}`,
                    `\\mathbf{h}_{${node.id}}^{(${layerNumber})} = ${aggregateSymbol}\\mathbf{W} = ${toTeXVector(updatedFeatures, 3)}`
                ],
                updateSummaryVector: cloneVector(updatedFeatures)
            };
        }
    }

    class GATLayer {
        constructor(options = {}) {
            this.key = "gat";
            this.label = "Graph Attention Network";
            this.shortDescription = "Single-head attention over each one-hop neighborhood using a shared projection and learned attention scores.";
            this.stageDefinitions = GAT_STAGE_DEFINITIONS.map(stage => ({ ...stage }));
            this.weightMatrix = cloneMatrix(options.weightMatrix || DEFAULT_GAT_WEIGHT_MATRIX);
            this.attentionVector = cloneVector(options.attentionVector || DEFAULT_ATTENTION_VECTOR);
            this.formulaTeX = "\\mathbf{h}_i^{(l+1)} = \\sum_{j \\in \\mathcal{N}(i) \\cup \\{i\\}} \\alpha_{ij}\\,\\mathbf{z}_j, \\quad \\mathbf{z}_j = \\mathbf{h}_j^{(l)}\\mathbf{W}";
            this.nodeFormulaTeX = "\\alpha_{ij} = \\operatorname{softmax}_j\\!\\left(\\operatorname{LeakyReLU}(\\mathbf{a}^{\\top}[\\mathbf{z}_i \\| \\mathbf{z}_j])\\right), \\quad \\mathbf{h}_i^{(l+1)} = \\sum_j \\alpha_{ij}\\mathbf{z}_j";
            this.parameterTeXBlocks = [
                `\\mathbf{W} = ${toTeXMatrix(this.weightMatrix, 2)}`,
                `\\mathbf{a} = ${toTeXVector(this.attentionVector, 2)}`
            ];
        }

        compute(graphStore) {
            const inputFeaturesById = new Map(graphStore.getNodes().map(node => [node.id, cloneVector(node.features)]));
            const projectedFeaturesById = new Map(graphStore.getNodes().map(node => {
                return [node.id, multiplyVectorMatrix(inputFeaturesById.get(node.id), this.weightMatrix)];
            }));
            const layerNumber = graphStore.layerIndex + 1;
            const steps = graphStore.getNodes().map(node => {
                return this.computeNodeStep(node, graphStore, inputFeaturesById, projectedFeaturesById, layerNumber);
            });

            return {
                modelKey: this.key,
                modelLabel: this.label,
                layerNumber,
                weightMatrix: cloneMatrix(this.weightMatrix),
                formulaTeX: this.formulaTeX,
                nodeFormulaTeX: this.nodeFormulaTeX,
                steps,
                outputNodes: steps.map(step => ({
                    id: step.nodeId,
                    features: cloneVector(step.updatedFeatures)
                }))
            };
        }

        computeNodeStep(node, graphStore, inputFeaturesById, projectedFeaturesById, layerNumber) {
            const sources = graphStore.getNeighborhoodWithSelf(node.id);
            const projectedTargetFeatures = cloneVector(projectedFeaturesById.get(node.id));
            const attentionScores = sources.map(sourceNode => {
                const projectedSourceFeatures = cloneVector(projectedFeaturesById.get(sourceNode.id));
                const rawScore = dotProduct(this.attentionVector, concatenateVectors(projectedTargetFeatures, projectedSourceFeatures));
                const attentionLogit = leakyReLU(rawScore);

                return {
                    sourceNode,
                    rawScore,
                    attentionLogit,
                    sourceFeatures: cloneVector(inputFeaturesById.get(sourceNode.id)),
                    projectedSourceFeatures
                };
            });

            const attentionCoefficients = softmax(attentionScores.map(score => score.attentionLogit));
            const aggregatedFeatures = zeroVector(FEATURE_DIMENSION);
            const neighborhoodIds = attentionScores.map(score => score.sourceNode.id).join(', ');
            const attentionLogitVector = attentionScores.map(score => score.attentionLogit);

            const contributions = attentionScores.map((score, index) => {
                const coefficient = attentionCoefficients[index];
                const weightedMessage = scaleVector(score.projectedSourceFeatures, coefficient);
                const targetLabel = node.id;
                const sourceLabel = score.sourceNode.id;

                for (let featureIndex = 0; featureIndex < aggregatedFeatures.length; featureIndex += 1) {
                    aggregatedFeatures[featureIndex] += weightedMessage[featureIndex];
                }

                return {
                    sourceId: sourceLabel,
                    isSelf: sourceLabel === targetLabel,
                    coefficient,
                    rawScore: score.rawScore,
                    attentionLogit: score.attentionLogit,
                    sourceFeatures: score.sourceFeatures,
                    projectedFeatures: score.projectedSourceFeatures,
                    weightedMessage,
                    summaryLabel: sourceLabel === targetLabel ? `${sourceLabel} → ${targetLabel} (self-loop)` : `${sourceLabel} → ${targetLabel}`,
                    detailTeX: `e_{${targetLabel},${sourceLabel}} = ${formatNumber(score.attentionLogit, 3)},\\;\\alpha_{${targetLabel},${sourceLabel}} = ${formatNumber(coefficient, 3)}`,
                    vectorRows: [
                        {
                            label: "Source",
                            vector: score.sourceFeatures
                        },
                        {
                            label: "Projected",
                            vector: score.projectedSourceFeatures
                        },
                        {
                            label: "Weighted",
                            vector: weightedMessage
                        }
                    ]
                };
            });

            const updatedFeatures = cloneVector(aggregatedFeatures);
            const aggregateSymbol = `\\mathbf{m}_{${node.id}}`;

            return {
                nodeId: node.id,
                contributions,
                aggregatedFeatures,
                updatedFeatures,
                weightMatrix: cloneMatrix(this.weightMatrix),
                attentionVector: cloneVector(this.attentionVector),
                messageTitle: `Node ${node.id} Message Passing`,
                messageDescription: `This node projects each neighbor with the shared matrix, scores every projected message with attention, and normalizes those scores with a softmax over the neighborhood.`,
                messagePills: [
                    {
                        text: `Neighborhood with self-loop: ${neighborhoodIds}`
                    },
                    {
                        tex: `\\sum_j \\alpha_{${node.id},j} = 1`
                    }
                ],
                messageTeXBlocks: [
                    `\\mathbf{z}_j = \\mathbf{h}_j^{(${layerNumber - 1})}\\mathbf{W}`,
                    `e_{${node.id},j} = \\operatorname{LeakyReLU}(\\mathbf{a}^{\\top}[\\mathbf{z}_{${node.id}} \\| \\mathbf{z}_j])`,
                    `\\boldsymbol{\\alpha}_{${node.id}} = \\operatorname{softmax}\\left(${toTeXVector(attentionLogitVector, 3)}\\right) = ${toTeXVector(attentionCoefficients, 3)}`,
                    `${aggregateSymbol} = \\sum_j \\alpha_{${node.id},j}\\mathbf{z}_j = ${toTeXVector(aggregatedFeatures, 3)}`
                ],
                messageSummaryVector: cloneVector(aggregatedFeatures),
                updateTitle: `Node ${node.id} Update`,
                updateDescription: `Update writes the attention-weighted neighborhood summary back as the node's next-layer embedding.`,
                updateTeXBlocks: [
                    `\\mathbf{h}_{${node.id}}^{(${layerNumber})} = ${aggregateSymbol} = ${toTeXVector(updatedFeatures, 3)}`
                ],
                updateSummaryVector: cloneVector(updatedFeatures)
            };
        }
    }

    const modelRegistry = {
        list() {
            return [
                {
                    key: "gcn",
                    label: "Graph Convolutional Network",
                    description: "Symmetric degree-normalized aggregation with self-loops and a shared weight matrix.",
                    stageDefinitions: GCN_STAGE_DEFINITIONS.map(stage => ({ ...stage }))
                },
                {
                    key: "gat",
                    label: "Graph Attention Network",
                    description: "Single-head attention over each one-hop neighborhood using a shared projection and learned attention scores.",
                    stageDefinitions: GAT_STAGE_DEFINITIONS.map(stage => ({ ...stage }))
                }
            ];
        },
        create(modelKey, options) {
            if (modelKey === "gcn") {
                return new GCNLayer(options);
            }

            if (modelKey === "gat") {
                return new GATLayer(options);
            }

            throw new Error(`Unsupported model: ${modelKey}`);
        }
    };

    global.GNNCore = {
        GraphStore,
        GCNLayer,
        GATLayer,
        FEATURE_DIMENSION,
        DEFAULT_WEIGHT_MATRIX: cloneMatrix(DEFAULT_WEIGHT_MATRIX),
        DEFAULT_GAT_WEIGHT_MATRIX: cloneMatrix(DEFAULT_GAT_WEIGHT_MATRIX),
        DEFAULT_ATTENTION_VECTOR: cloneVector(DEFAULT_ATTENTION_VECTOR),
        createRandomGraph,
        modelRegistry,
        cloneVector,
        cloneMatrix,
        formatNumber,
        formatVector,
        toTeXVector,
        toTeXMatrix
    };
}(window));
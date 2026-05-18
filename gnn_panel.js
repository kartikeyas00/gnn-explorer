(function (global) {
    function toVectorLiteral(vector, digits = 3) {
        if (!Array.isArray(vector)) {
            return "";
        }

        return `[${vector.map(value => global.GNNCore.formatNumber(value, digits)).join(', ')}]`;
    }

    function inlineTeX(expression) {
        return `\\(${expression}\\)`;
    }

    class ExplorerPanel {
        constructor(options) {
            this.container = document.querySelector(options.panelSelector);
        }

        renderWelcome(model) {
            this.setContent(`
                <div class="panel-shell">
                    ${this.buildOverviewCard(model, 0)}
                    <section class="panel-card panel-card-accent">
                        <p class="panel-eyebrow">Getting Started</p>
                        <h3 class="panel-title">Build a graph to start the walkthrough</h3>
                        <p class="panel-copy">Choose a GNN architecture under the graph, create the graph, and then step through that architecture's stages one step at a time.</p>
                        <div class="panel-note">Completed layers stay archived on the right so users can reopen the math later instead of losing it as the animation progresses.</div>
                    </section>
                </div>
            `);
        }

        renderGraphReady(model, graphStore, layerHistory = []) {
            this.setContent(`
                <div class="panel-shell">
                    ${this.buildOverviewCard(model, graphStore.layerIndex)}
                    ${this.buildSummaryCard(graphStore, 'Graph Ready', `The graph is ready for ${model.label}. Start with ${this.getStageLabel(model, 'messagePassing')} to inspect how the selected architecture collects information.`)}
                    ${this.buildLayerHistoryCollection(layerHistory)}
                    <section class="panel-card">
                        <p class="panel-eyebrow">Walkthrough</p>
                        <h3 class="panel-title">What this layer will do</h3>
                        ${this.renderTeXBlocks([model.nodeFormulaTeX])}
                        <p class="panel-copy">Each node reads from its one-hop neighborhood plus itself. The selected architecture decides how those messages are weighted before the new embedding is written back onto the graph.</p>
                    </section>
                </div>
            `);
        }

        renderMessageStep(model, graphStore, layerResult, step, historySteps = [], layerHistory = []) {
            const stageLabel = this.getStageLabel(model, 'messagePassing');
            const currentLayer = this.buildLayerSnapshot(layerResult, {
                statusLabel: `${stageLabel} · ${historySteps.length}/${layerResult.steps.length} complete`,
                messageSteps: historySteps,
                updateSteps: [],
                stageDefinitions: model.stageDefinitions,
                open: true
            });

            this.setContent(`
                <div class="panel-shell">
                    ${this.buildMessageLiveCard(step)}
                    ${this.buildLayerHistoryCollection(layerHistory.concat(currentLayer))}
                    ${this.buildSummaryCard(graphStore, `Layer ${layerResult.layerNumber} · ${stageLabel}`, `Node ${step.nodeId} is currently running ${model.label} ${stageLabel.toLowerCase()}.`)}
                    ${this.buildOverviewCard(model, graphStore.layerIndex, { compact: true })}
                </div>
            `, { scrollToTop: true });
        }

        renderApplyStep(model, graphStore, layerResult, step, updateHistorySteps = [], layerHistory = []) {
            const stageLabel = this.getStageLabel(model, 'update');
            const currentLayer = this.buildLayerSnapshot(layerResult, {
                statusLabel: `${stageLabel} · ${updateHistorySteps.length}/${layerResult.steps.length} complete`,
                messageSteps: layerResult.steps,
                updateSteps: updateHistorySteps,
                stageDefinitions: model.stageDefinitions,
                open: true
            });

            this.setContent(`
                <div class="panel-shell">
                    ${this.buildUpdateLiveCard(step)}
                    ${this.buildLayerHistoryCollection(layerHistory.concat(currentLayer))}
                    ${this.buildSummaryCard(graphStore, `Layer ${layerResult.layerNumber} · ${stageLabel}`, `Node ${step.nodeId} is now applying ${model.label}'s update rule to write the next embedding back onto the graph.`)}
                    ${this.buildOverviewCard(model, graphStore.layerIndex, { compact: true })}
                </div>
            `, { scrollToTop: true });
        }

        renderMessagePhaseComplete(model, graphStore, layerResult, layerHistory = []) {
            const messageLabel = this.getStageLabel(model, 'messagePassing');
            const updateLabel = this.getStageLabel(model, 'update');
            const currentLayer = this.buildLayerSnapshot(layerResult, {
                statusLabel: `${messageLabel} complete`,
                messageSteps: layerResult.steps,
                updateSteps: [],
                stageDefinitions: model.stageDefinitions,
                open: true
            });

            this.setContent(`
                <div class="panel-shell">
                    <section class="panel-card panel-card-accent">
                        <p class="panel-eyebrow">Ready For ${updateLabel}</p>
                        <h3 class="panel-title">${updateLabel} can start now</h3>
                        <p class="panel-copy">${messageLabel} is complete for this layer. ${updateLabel} will now turn the stored neighborhood summaries into new node embeddings using ${model.label}'s update rule.</p>
                    </section>
                    ${this.buildLayerHistoryCollection(layerHistory.concat(currentLayer))}
                    ${this.buildSummaryCard(graphStore, `Layer ${layerResult.layerNumber} · ${messageLabel} Ready`, `All ${messageLabel.toLowerCase()} steps for this layer are archived below. Proceed to ${updateLabel} when you are ready.`)}
                    ${this.buildOverviewCard(model, graphStore.layerIndex, { compact: true })}
                </div>
            `);
        }

        renderLayerComplete(model, graphStore, layerHistory = []) {
            const latestLayer = layerHistory[layerHistory.length - 1];
            const messageLabel = this.getStageLabel(model, 'messagePassing');

            this.setContent(`
                <div class="panel-shell">
                    <section class="panel-card panel-card-accent">
                        <p class="panel-eyebrow">Next Step</p>
                        <h3 class="panel-title">Start the next layer or inspect the history</h3>
                        <p class="panel-copy">Layer ${latestLayer ? latestLayer.layerNumber : graphStore.layerIndex} is complete. You can collapse or reopen any archived layer below, then run ${messageLabel} again to continue building depth on the graph.</p>
                    </section>
                    ${this.buildLayerHistoryCollection(layerHistory)}
                    ${this.buildSummaryCard(graphStore, `Layer ${latestLayer ? latestLayer.layerNumber : graphStore.layerIndex} Complete`, 'The graph now shows the updated node embeddings after one full layer of the selected architecture.')}
                    ${this.buildOverviewCard(model, graphStore.layerIndex, { compact: true })}
                </div>
            `);
        }

        getStageLabel(modelOrDefinitions, stageKey) {
            const stageDefinitions = Array.isArray(modelOrDefinitions)
                ? modelOrDefinitions
                : (modelOrDefinitions && Array.isArray(modelOrDefinitions.stageDefinitions) ? modelOrDefinitions.stageDefinitions : []);
            const matchingStage = stageDefinitions.find(stage => stage.key === stageKey);

            return matchingStage ? matchingStage.label : stageKey;
        }

        buildLayerSnapshot(layerResult, options = {}) {
            return {
                layerNumber: layerResult.layerNumber,
                modelLabel: layerResult.modelLabel,
                stageDefinitions: (options.stageDefinitions || []).map(stage => ({ ...stage })),
                messageSteps: options.messageSteps || [],
                updateSteps: options.updateSteps || [],
                statusLabel: options.statusLabel || '',
                open: options.open !== undefined ? options.open : true
            };
        }

        buildMessageLiveCard(step) {
            return this.buildStageLiveCard({
                title: step.messageTitle || `Node ${step.nodeId} Message Passing`,
                description: step.messageDescription || 'This node is collecting messages from its neighborhood.',
                pills: step.messagePills || [],
                texBlocks: step.messageTeXBlocks || [],
                contributions: step.contributions || []
            });
        }

        buildUpdateLiveCard(step) {
            return this.buildStageLiveCard({
                title: step.updateTitle || `Node ${step.nodeId} Update`,
                description: step.updateDescription || 'This node is writing its next embedding back onto the graph.',
                pills: step.updatePills || [],
                texBlocks: step.updateTeXBlocks || [],
                contributions: step.updateContributions || []
            });
        }

        buildStageLiveCard(stage) {
            return `
                <section class="panel-card panel-card-live">
                    <p class="panel-eyebrow">Live Calculation</p>
                    <h3 class="panel-title">${stage.title}</h3>
                    <p class="panel-copy">${stage.description}</p>
                    ${this.renderPills(stage.pills)}
                    ${this.renderTeXBlocks(stage.texBlocks)}
                    ${stage.contributions.length ? `<div class="contribution-list">${stage.contributions.map(contribution => this.buildContributionRow(contribution)).join('')}</div>` : ''}
                </section>
            `;
        }

        buildLayerHistoryCollection(layerHistory = []) {
            if (!layerHistory.length) {
                return '';
            }

            return `
                <section class="panel-card history-section history-section-layers">
                    <p class="panel-eyebrow">Layer History</p>
                    <h3 class="panel-title">Layer by layer math</h3>
                    <p class="panel-copy">Each layer below is collapsible, and every layer preserves Message Passing before Update so users can revisit the full derivation later.</p>
                    <div class="layer-history-stack">
                        ${layerHistory.map((layerData, index) => {
                            const shouldOpen = layerData.open !== undefined ? layerData.open : index === layerHistory.length - 1;
                            return this.buildLayerHistoryDetails(layerData, { open: shouldOpen });
                        }).join('')}
                    </div>
                </section>
            `;
        }

        buildLayerHistoryDetails(layerData, options = {}) {
            const openAttribute = options.open ? ' open' : '';
            const messageLabel = this.getStageLabel(layerData.stageDefinitions, 'messagePassing') || 'Message Passing';
            const updateLabel = this.getStageLabel(layerData.stageDefinitions, 'update') || 'Update';
            const messageEntriesMarkup = layerData.messageSteps.length > 0
                ? layerData.messageSteps.map((step, index) => this.buildMessageArchiveEntry(step, { open: index === 0 })).join('')
                : `<div class="layer-section-empty">No ${messageLabel} steps are archived yet for this layer.</div>`;
            const updateEntriesMarkup = layerData.updateSteps.length > 0
                ? layerData.updateSteps.map((step, index) => this.buildUpdateArchiveEntry(step, { open: index === 0 })).join('')
                : `<div class="layer-section-empty">No ${updateLabel} steps are archived yet for this layer.</div>`;

            return `
                <details class="layer-history-details"${openAttribute}>
                    <summary class="layer-history-summary">
                        <div class="layer-history-summary-copy">
                            <span class="layer-history-summary-title">Layer ${layerData.layerNumber}</span>
                            <span class="layer-history-summary-subtitle">${layerData.modelLabel}</span>
                        </div>
                        <div class="layer-history-summary-meta">
                            ${layerData.statusLabel ? `<span class="summary-pill summary-pill-compact">${layerData.statusLabel}</span>` : ''}
                        </div>
                    </summary>
                    <div class="layer-history-body">
                        ${this.buildLayerSection({
                            title: messageLabel,
                            copy: `Archived ${messageLabel.toLowerCase()} steps for this layer.`,
                            entriesMarkup: messageEntriesMarkup
                        })}
                        ${this.buildLayerSection({
                            title: updateLabel,
                            copy: `Archived ${updateLabel.toLowerCase()} steps for this layer.`,
                            entriesMarkup: updateEntriesMarkup
                        })}
                    </div>
                </details>
            `;
        }

        buildLayerSection(section) {
            return `
                <section class="layer-section">
                    <div class="layer-section-header">
                        <h4 class="layer-section-title">${section.title}</h4>
                        <p class="layer-section-copy">${section.copy}</p>
                    </div>
                    <div class="history-stack">
                        ${section.entriesMarkup}
                    </div>
                </section>
            `;
        }

        buildMessageArchiveEntry(step, options = {}) {
            return this.buildStageArchiveEntry({
                title: step.messageTitle || `Node ${step.nodeId} Message Passing`,
                subtitle: 'Stored neighborhood summary',
                summaryVector: step.messageSummaryVector || step.aggregatedFeatures,
                texBlocks: step.messageTeXBlocks || [],
                contributions: step.contributions || [],
                open: options.open
            });
        }

        buildUpdateArchiveEntry(step, options = {}) {
            return this.buildStageArchiveEntry({
                title: step.updateTitle || `Node ${step.nodeId} Update`,
                subtitle: 'Node embedding update',
                summaryVector: step.updateSummaryVector || step.updatedFeatures,
                texBlocks: step.updateTeXBlocks || [],
                contributions: step.updateContributions || [],
                open: options.open
            });
        }

        buildStageArchiveEntry(entry) {
            const openAttribute = entry.open ? ' open' : '';

            return `
                <details class="history-details"${openAttribute}>
                    <summary class="history-summary">
                        <div class="history-summary-copy">
                            <span class="history-summary-title">${entry.title}</span>
                            <span class="history-summary-subtitle">${entry.subtitle}</span>
                        </div>
                        <span class="history-summary-vector">${toVectorLiteral(entry.summaryVector)}</span>
                    </summary>
                    <div class="history-body">
                        ${this.renderTeXBlocks(entry.texBlocks)}
                        ${entry.contributions.length ? `<div class="contribution-list contribution-list-compact">${entry.contributions.map(contribution => this.buildContributionRow(contribution)).join('')}</div>` : ''}
                    </div>
                </details>
            `;
        }

        buildOverviewCard(model, currentLayerIndex, options = {}) {
            const compact = Boolean(options.compact);
            const parameterTeXBlocks = model.parameterTeXBlocks && model.parameterTeXBlocks.length
                ? model.parameterTeXBlocks
                : (model.weightMatrix ? [`\\mathbf{W} = ${global.GNNCore.toTeXMatrix(model.weightMatrix, 2)}`] : []);

            return `
                <section class="panel-card formula-card${compact ? ' panel-card-compact' : ''}">
                    <p class="panel-eyebrow">${compact ? 'Model Reference' : 'Current Model'}</p>
                    <h3 class="panel-title">${model.label}</h3>
                    <p class="panel-copy">${model.shortDescription}</p>
                    <div class="panel-meta-row">
                        <span class="summary-pill">Layer depth on graph: ${currentLayerIndex}</span>
                        <span class="summary-pill">Feature size: ${global.GNNCore.FEATURE_DIMENSION}</span>
                    </div>
                    ${this.renderTeXBlocks([model.formulaTeX].concat(parameterTeXBlocks))}
                </section>
            `;
        }

        buildSummaryCard(graphStore, statusLabel, statusCopy) {
            return `
                <section class="panel-card">
                    <p class="panel-eyebrow">Status</p>
                    <h3 class="panel-title">${statusLabel}</h3>
                    <p class="panel-copy">${statusCopy}</p>
                    <div class="panel-meta-row">
                        <span class="summary-pill">Nodes: ${graphStore.getNodes().length}</span>
                        <span class="summary-pill">Edges: ${graphStore.getEdges().length}</span>
                        <span class="summary-pill">Active input layer: ${graphStore.layerIndex}</span>
                    </div>
                </section>
            `;
        }

        buildContributionRow(contribution) {
            const vectorRows = contribution.vectorRows || [];

            return `
                <div class="contribution-row">
                    <div>
                        <div class="contribution-title">${contribution.summaryLabel || contribution.sourceId || 'Contribution'}</div>
                        ${contribution.detailTeX ? `<div class="contribution-copy">${inlineTeX(contribution.detailTeX)}</div>` : ''}
                    </div>
                    <div class="contribution-values">
                        ${vectorRows.map(vectorRow => `<span>${vectorRow.label} ${toVectorLiteral(vectorRow.vector)}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        renderPills(pills = []) {
            const pillMarkup = pills.map(pill => {
                if (!pill) {
                    return '';
                }

                if (typeof pill === 'string') {
                    return `<span class="summary-pill">${pill}</span>`;
                }

                if (pill.tex) {
                    return `<span class="summary-pill">${inlineTeX(pill.tex)}</span>`;
                }

                if (pill.text) {
                    return `<span class="summary-pill">${pill.text}</span>`;
                }

                return '';
            }).join('');

            return pillMarkup ? `<div class="panel-meta-row">${pillMarkup}</div>` : '';
        }

        renderTeXBlocks(texBlocks = []) {
            return texBlocks
                .filter(Boolean)
                .map(texBlock => `<div class="math-block">$$${texBlock}$$</div>`)
                .join('');
        }

        setContent(markup, options = {}) {
            if (!this.container) {
                return;
            }

            this.container.innerHTML = markup;

            if (options.scrollToTop) {
                const shell = this.container.querySelector('.panel-shell');
                if (shell) {
                    shell.scrollTop = 0;
                }
            }

            this.typeset();
        }

        typeset() {
            if (!global.MathJax || !global.MathJax.typesetPromise || !this.container) {
                return;
            }

            global.MathJax.typesetClear([this.container]);
            global.MathJax.typesetPromise([this.container]);
        }
    }

    global.GNNPanel = {
        ExplorerPanel
    };
}(window));
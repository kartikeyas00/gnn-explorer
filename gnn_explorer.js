const MESSAGE_DURATION = 720;
const UPDATE_DURATION = 520;
const STEP_PAUSE = 180;

const appState = {
    graphStore: new window.GNNCore.GraphStore(),
    model: null,
    renderer: null,
    panel: null,
    activeLayerResult: null,
    isAnimating: false,
    runToken: 0,
    layerHistory: []
};

const controls = {
    startButton: document.getElementById("startButton"),
    resetButton: document.getElementById("resetButton"),
    graphButtons: document.getElementById("graph-buttons"),
    graphCaption: document.getElementById("graph-caption"),
    nodeCount: document.getElementById("nodeCount"),
    maxNeighborCount: document.getElementById("maxNeighborCount"),
    modelSelect: document.getElementById("modelSelect"),
    modelLabel: document.getElementById("modelLabel"),
    modelDescription: document.getElementById("modelDescription"),
    modelStages: document.getElementById("modelStages")
};

const STAGE_ACTIONS = {
    messagePassing: startMessagePassing,
    update: startUpdate
};

function getAvailableModels() {
    return window.GNNCore.modelRegistry.list();
}

function getSelectedModelDefinition() {
    return getAvailableModels().find(model => model.key === controls.modelSelect.value) || getAvailableModels()[0];
}

function getStageButtonId(stageKey) {
    if (stageKey === "messagePassing") {
        return "messagePassingButton";
    }

    if (stageKey === "update") {
        return "featureAggregationButton";
    }

    return `stageButton-${stageKey}`;
}

function getStageButton(stageKey) {
    return document.getElementById(getStageButtonId(stageKey));
}

function getStageLabel(model, stageKey) {
    const stage = model.stageDefinitions.find(candidate => candidate.key === stageKey);
    return stage ? stage.label : stageKey;
}

function applyControlState(options) {
    const disabledByKey = options.stageDisabledByKey || {};
    const defaultStageDisabled = options.defaultStageDisabled !== undefined ? options.defaultStageDisabled : true;

    controls.graphButtons.style.display = options.showGraphButtons ? "flex" : "none";
    controls.startButton.disabled = Boolean(options.startDisabled);
    controls.modelSelect.disabled = Boolean(options.modelSelectDisabled);

    if (appState.model) {
        appState.model.stageDefinitions.forEach(stage => {
            const button = getStageButton(stage.key);
            const handler = STAGE_ACTIONS[stage.key];

            if (!button) {
                return;
            }

            button.disabled = !handler || (Object.prototype.hasOwnProperty.call(disabledByKey, stage.key)
                ? Boolean(disabledByKey[stage.key])
                : defaultStageDisabled);
        });
    }
}

function setCaption(text) {
    controls.graphCaption.textContent = text;
}

function wait(duration) {
    return new Promise(resolve => {
        window.setTimeout(resolve, duration);
    });
}

function beginRun() {
    appState.runToken += 1;
    appState.isAnimating = true;
    return appState.runToken;
}

function cancelActiveRun() {
    appState.runToken += 1;
    appState.isAnimating = false;
}

function isRunActive(runToken) {
    return appState.runToken === runToken;
}

function hasGraph() {
    return appState.graphStore.getNodes().length > 0;
}

function populateModelSelect() {
    controls.modelSelect.innerHTML = getAvailableModels().map(model => {
        return `<option value="${model.key}">${model.label}</option>`;
    }).join("");
}

function updateModelSummary() {
    const definition = getSelectedModelDefinition();

    controls.modelLabel.textContent = definition.label;
    controls.modelDescription.textContent = definition.description;
    controls.modelStages.innerHTML = definition.stageDefinitions.map(stage => {
        return `<span class="model-stage-chip">${stage.label}</span>`;
    }).join("");
}

function renderStageButtons() {
    controls.graphButtons.innerHTML = "";

    appState.model.stageDefinitions.forEach((stage, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button is-primary architecture-stage-button";
        button.id = getStageButtonId(stage.key);
        button.dataset.stageKey = stage.key;
        button.textContent = stage.label;

        const handler = STAGE_ACTIONS[stage.key];
        if (handler) {
            button.addEventListener("click", handler);
        }

        controls.graphButtons.appendChild(button);

        if (index < appState.model.stageDefinitions.length - 1) {
            const separator = document.createElement("span");
            separator.className = "stage-separator";
            separator.setAttribute("aria-hidden", "true");
            separator.textContent = "→";
            controls.graphButtons.appendChild(separator);
        }
    });
}

function createCompletedLayerHistoryEntry(layerResult, model) {
    return {
        layerNumber: layerResult.layerNumber,
        modelLabel: layerResult.modelLabel,
        stageDefinitions: model.stageDefinitions.map(stage => ({ ...stage })),
        weightMatrix: window.GNNCore.cloneMatrix(layerResult.weightMatrix),
        messageSteps: layerResult.steps.slice(),
        updateSteps: layerResult.steps.slice(),
        statusLabel: "Complete"
    };
}

function setModel(modelKey) {
    appState.model = window.GNNCore.modelRegistry.create(modelKey);
    updateModelSummary();
    renderStageButtons();

    if (!hasGraph()) {
        appState.panel.renderWelcome(appState.model);
        setCaption(`${appState.model.label} walkthrough with architecture-specific stages.`);
        applyControlState({
            showGraphButtons: false,
            startDisabled: false,
            modelSelectDisabled: false,
            defaultStageDisabled: true
        });
        return;
    }

    appState.activeLayerResult = null;
    appState.renderer.resetVisualState();
    appState.panel.renderGraphReady(appState.model, appState.graphStore, appState.layerHistory);
    setCaption(`${appState.model.label} selected. Run Message Passing to begin the next layer on the current graph.`);
    applyControlState({
        showGraphButtons: true,
        startDisabled: false,
        modelSelectDisabled: false,
        defaultStageDisabled: true,
        stageDisabledByKey: {
            messagePassing: false,
            update: true
        }
    });
}

function initializeExplorer() {
    appState.renderer = new window.GNNRenderer.GraphRenderer({ graphSelector: "#graph" });
    appState.panel = new window.GNNPanel.ExplorerPanel({ panelSelector: "#aggregation-panel" });

    populateModelSelect();
    controls.modelSelect.addEventListener("change", event => {
        if (appState.isAnimating || appState.activeLayerResult) {
            controls.modelSelect.value = appState.model.key;
            return;
        }

        setModel(event.target.value);
    });

    setModel(controls.modelSelect.value || "gcn");
}

function startGraph() {
    if (appState.isAnimating) {
        return;
    }

    const nodeCount = parseInt(controls.nodeCount.value, 10);
    const maxNeighborCount = parseInt(controls.maxNeighborCount.value, 10);

    cancelActiveRun();
    appState.activeLayerResult = null;
    appState.layerHistory = [];
    appState.graphStore.createRandomGraph(nodeCount, maxNeighborCount);
    appState.renderer.render(appState.graphStore.getNodes(), appState.graphStore.getRenderableEdges());
    appState.renderer.resetVisualState();
    appState.panel.renderGraphReady(appState.model, appState.graphStore, appState.layerHistory);
    setCaption(`${appState.model.label} is ready. Start with Message Passing to inspect how each node collects information from its neighborhood.`);
    applyControlState({
        showGraphButtons: true,
        startDisabled: false,
        modelSelectDisabled: false,
        defaultStageDisabled: true,
        stageDisabledByKey: {
            messagePassing: false,
            update: true
        }
    });
}

async function startMessagePassing() {
    if (appState.isAnimating || !hasGraph()) {
        return;
    }

    const runToken = beginRun();
    const layerResult = appState.model.compute(appState.graphStore);
    appState.activeLayerResult = layerResult;

    applyControlState({
        showGraphButtons: true,
        startDisabled: true,
        modelSelectDisabled: true,
        defaultStageDisabled: true
    });
    setCaption(`Layer ${layerResult.layerNumber}: ${getStageLabel(appState.model, "messagePassing")} is showing how ${appState.model.label} moves information across the neighborhood.`);

    try {
        for (let index = 0; index < layerResult.steps.length; index += 1) {
            const step = layerResult.steps[index];

            if (!isRunActive(runToken)) {
                return;
            }

            appState.panel.renderMessageStep(
                appState.model,
                appState.graphStore,
                layerResult,
                step,
                layerResult.steps.slice(0, index),
                appState.layerHistory
            );
            await appState.renderer.animateMessages(step, { duration: MESSAGE_DURATION });

            if (!isRunActive(runToken)) {
                return;
            }

            await wait(STEP_PAUSE);
        }

        if (!isRunActive(runToken)) {
            return;
        }

        appState.renderer.resetVisualState();
        appState.panel.renderMessagePhaseComplete(appState.model, appState.graphStore, layerResult, appState.layerHistory);
        setCaption(`Layer ${layerResult.layerNumber}: Message Passing is complete. Update is ready.`);
        applyControlState({
            showGraphButtons: true,
            startDisabled: false,
            modelSelectDisabled: true,
            defaultStageDisabled: true,
            stageDisabledByKey: {
                messagePassing: true,
                update: false
            }
        });
    } finally {
        if (isRunActive(runToken)) {
            appState.isAnimating = false;
        }
    }
}

async function startUpdate() {
    if (appState.isAnimating || !appState.activeLayerResult) {
        return;
    }

    const layerResult = appState.activeLayerResult;
    const runToken = beginRun();

    applyControlState({
        showGraphButtons: true,
        startDisabled: true,
        modelSelectDisabled: true,
        defaultStageDisabled: true
    });
    setCaption(`Layer ${layerResult.layerNumber}: ${getStageLabel(appState.model, "update")} is applying ${appState.model.label}'s update rule to every stored neighborhood summary.`);

    try {
        for (let index = 0; index < layerResult.steps.length; index += 1) {
            const step = layerResult.steps[index];

            if (!isRunActive(runToken)) {
                return;
            }

            appState.panel.renderApplyStep(
                appState.model,
                appState.graphStore,
                layerResult,
                step,
                layerResult.steps.slice(0, index),
                appState.layerHistory
            );
            await appState.renderer.animateNodeUpdate(step, { duration: UPDATE_DURATION });

            if (!isRunActive(runToken)) {
                return;
            }

            await wait(STEP_PAUSE);
        }

        if (!isRunActive(runToken)) {
            return;
        }

        appState.graphStore.applyLayerResult(layerResult);
        appState.renderer.syncFeatureLabels();
        appState.renderer.resetVisualState();
        appState.layerHistory = appState.layerHistory.concat(createCompletedLayerHistoryEntry(layerResult, appState.model));
        appState.activeLayerResult = null;
        appState.panel.renderLayerComplete(appState.model, appState.graphStore, appState.layerHistory);
        setCaption(`Layer ${appState.graphStore.layerIndex} is complete. Message Passing is ready for the next ${appState.model.label} layer.`);
        applyControlState({
            showGraphButtons: true,
            startDisabled: false,
            modelSelectDisabled: false,
            defaultStageDisabled: true,
            stageDisabledByKey: {
                messagePassing: false,
                update: true
            }
        });
    } finally {
        if (isRunActive(runToken)) {
            appState.isAnimating = false;
        }
    }
}

function resetGraph() {
    cancelActiveRun();
    appState.activeLayerResult = null;
    appState.layerHistory = [];
    appState.graphStore = new window.GNNCore.GraphStore();
    appState.renderer.clearGraph();
    appState.panel.renderWelcome(appState.model);
    setCaption(`${appState.model.label} walkthrough with architecture-specific stages.`);
    applyControlState({
        showGraphButtons: false,
        startDisabled: false,
        modelSelectDisabled: false,
        defaultStageDisabled: true
    });
}

initializeExplorer();

window.startGraph = startGraph;
window.startMessagePassing = startMessagePassing;
window.startFeatureAggregation = startUpdate;
window.startUpdate = startUpdate;
window.resetGraph = resetGraph;
# Graph Neural Network Explorer

Graph Neural Network Explorer is a small static browser demo for stepping through graph neural network layers visually and mathematically. It renders a random graph with D3, lets the user choose a GNN architecture, and then walks through Message Passing and Update one node at a time while keeping the full math history in a scrollable side panel.

The current version supports both Graph Convolutional Networks (GCN) and Graph Attention Networks (GAT), with architecture-specific formulas, live calculation panels, per-layer archives, and animated edge labels that surface coefficients directly on the graph.

You can access the project [here](https://kartikeyas00.github.io/gnn-explorer/)

## Features

- Architecture selector with model-specific summaries and stage labels
- Interactive random graph generation with configurable node count and neighbor limit
- Step-by-step Message Passing and Update animations
- GCN walkthrough with symmetric degree-normalized aggregation and self-loops
- GAT walkthrough with shared projection, learned attention scores, softmax-normalized attention weights, and edge attention labels on the graph
- Live math panel powered by MathJax with archived layer history
- Collapsible layer history so users can revisit previous Message Passing and Update steps
- Static browser-friendly implementation with no bundler, no package manager, and no build step

## Supported Models

### Graph Convolutional Network

The GCN flow uses self-loops and symmetric normalization:

$$
\mathbf{H}^{(l+1)} = \hat{D}^{-1/2}\hat{A}\hat{D}^{-1/2}\mathbf{H}^{(l)}\mathbf{W}
$$

Users can inspect each normalized neighbor contribution, the neighborhood summary vector for a node, and the final transformed embedding after the shared weight matrix is applied.

### Graph Attention Network

The GAT flow uses a shared linear projection and attention weights over the one-hop neighborhood:

$$
\alpha_{ij} = \operatorname{softmax}_j\left(\operatorname{LeakyReLU}(\mathbf{a}^{\top}[\mathbf{z}_i \| \mathbf{z}_j])\right), \quad
\mathbf{h}_i^{(l+1)} = \sum_j \alpha_{ij}\mathbf{z}_j
$$

The UI shows projected neighbor features, attention logits, normalized attention weights, weighted messages, and live edge labels such as $\alpha = 0.31$ during message animation.

## Project Structure

- `index.html`: app shell, CDN dependencies, and main layout
- `gnn_core.js`: graph data model, helper math, and architecture registry
- `graph_renderer.js`: D3 graph rendering and animation logic
- `gnn_panel.js`: right-side math panel, layer history, and MathJax rendering
- `gnn_explorer.js`: controller for graph creation, model selection, stages, and app state
- `gnn_explorer.css`: custom styling for the graph, controls, and math panel

## Running Locally

This project runs directly in a modern browser.

1. Start a lightweight static server from the repository root:

```bash
python3 -m http.server 8000
```

2. Open the app in a browser:

```text
http://127.0.0.1:8000/
```

You can also open `index.html` directly, but a local server is the more reliable path when verifying browser behavior.

## How To Use

1. Choose the graph size and maximum neighbor count.
2. Select a GNN architecture under the graph.
3. Click `Create Graph`.
4. Run `Message Passing` to inspect how each node collects information.
5. Run `Update` to write the next-layer embedding back onto the graph.
6. Expand or collapse prior layers in the right panel to review earlier math.
7. Reset and repeat with another architecture or graph shape.


## Notes

- The app is intentionally simple and static; avoid adding a build pipeline unless the project direction changes.
- Local JS and CSS may be cached aggressively by the browser during iteration, so cache-busting query strings on local assets may be useful during development.
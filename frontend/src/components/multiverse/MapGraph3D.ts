/**
 * MapGraph3D — WebGL 3D force-directed graph using `3d-force-graph` + Three.js.
 *
 * Space aesthetic with particle starfield, glowing node spheres, bloom post-processing.
 * Lazy-loaded via dynamic import() in CartographerMap — Vite code-splits automatically.
 *
 * Template nodes: larger glowing orbs with orbital rings + banner textures.
 * Instance nodes: smaller spheres with phase-colored torus rings.
 * Camera orbit controls with click-to-fly-to animation.
 *
 * Features: tooltip, search filter, edge click, flatten toggle (3D↔2D morph),
 * node microanimations (ring rotation, glow pulse, torus spin).
 */

import { msg } from '@lit/localize';
import type { ForceGraph3DInstance } from '3d-force-graph';
import ForceGraph3D from '3d-force-graph';
import { css, html, LitElement, render } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type Group, Vector2 } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { LinkObject, NodeObject } from 'three-forcegraph';
import { SCORE_DIMENSION_COLORS } from './map-data.js';
import {
  animateNodes,
  createNodeObject,
  createStarfield,
  getLinkColor,
  getLinkWidth,
  PHASE_COLORS_3D,
} from './map-three-render.js';
import type { MapEdgeData, MapEmbassyEdge, MapNodeData } from './map-types.js';

// ── Internal types ─────────────────────────────────────────────────────────

/** Extended node — MapNodeData fields + d3-force-3d position fields */
interface GraphNode3D extends MapNodeData {
  id: string;
  z?: number;
  vz?: number;
  fz?: number;
}

interface InternalLink3D {
  id: string;
  source: string | GraphNode3D;
  target: string | GraphNode3D;
  connectionType: string;
  operativeHeat?: number;
  operativeTypes?: string[];
  strength: number;
  isEmbassy?: boolean;
}

// 3d-force-graph doesn't propagate generic type params through its factory constructor.
// We use the base instance type and cast node/link in callbacks.
type Graph3DInstance = ForceGraph3DInstance;

// d3-force-3d force instances exposed by `graph.d3Force(name)` carry a
// `[key: string]: any` index signature (see three-forcegraph's `ForceFn`),
// which erases the specific setter signatures for `.strength()` and
// `.distance()`. These narrow-interface guards restore type safety at the
// call site without touching the vendor `.d.ts`.

interface StrengthSetter {
  strength(fn: (node: NodeObject) => number): unknown;
}
interface DistanceSetter {
  distance(fn: (link: LinkObject) => number): unknown;
}

function hasStrengthSetter(force: unknown): force is StrengthSetter {
  return (
    force != null &&
    typeof force === 'object' &&
    typeof (force as { strength?: unknown }).strength === 'function'
  );
}

function hasDistanceSetter(force: unknown): force is DistanceSetter {
  return (
    force != null &&
    typeof force === 'object' &&
    typeof (force as { distance?: unknown }).distance === 'function'
  );
}

@customElement('velg-map-graph-3d')
export class VelgMapGraph3D extends LitElement {
  static styles = css`
		:host {
			display: block;
			position: relative;
			width: 100%;
			height: 100%;
			overflow: hidden;
		}

		.graph-container {
			width: 100%;
			height: 100%;
		}

		/* Hide 3d-force-graph nav info text (injected despite showNavInfo(false) in some builds) */
		.graph-container .scene-nav-info {
			display: none !important;
		}

		.map3d-toolbar {
			position: absolute;
			top: var(--space-3, 12px);
			right: var(--space-3, 12px);
			display: flex;
			gap: var(--space-2, 8px);
			z-index: var(--z-raised);
		}

		.map3d-btn {
			background: var(--color-surface-raised);
			border: 1px solid var(--color-border);
			color: var(--color-text-primary);
			font-family: var(--font-brutalist, monospace);
			font-size: 10px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			padding: 6px 12px;
			cursor: pointer;
		}

		.map3d-btn:hover {
			background: var(--color-surface-hover);
		}

		.map3d-btn--active {
			background: var(--color-surface-hover);
			border-color: var(--color-text-secondary);
			color: var(--color-text-primary);
		}

		/* ── Tooltip ── */
		.map3d-tooltip {
			position: absolute;
			pointer-events: none;
			z-index: var(--z-raised);
			display: none;
			background: rgba(10, 10, 10, 0.92);
			border: 1px solid rgba(255, 255, 255, 0.12);
			padding: 10px 14px;
			font-family: var(--font-mono, monospace);
			font-size: 11px;
			color: var(--color-text-primary);
			max-width: 240px;
			backdrop-filter: blur(6px);
		}

		.map3d-tooltip--visible {
			display: block;
		}

		.tooltip__name {
			font-weight: 900;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			margin-bottom: 6px;
		}

		.tooltip__stat {
			color: var(--color-text-muted);
			font-size: 10px;
			margin: 2px 0;
		}

		.tooltip__phase {
			font-weight: 700;
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			margin-top: 6px;
		}

		.tooltip__dim-bar {
			display: flex;
			align-items: center;
			gap: 6px;
			margin: 2px 0;
			font-size: 9px;
		}

		.tooltip__dim-label {
			width: 56px;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--color-text-muted);
		}

		.tooltip__dim-track {
			flex: 1;
			height: 3px;
			background: rgba(255, 255, 255, 0.08);
		}

		.tooltip__dim-fill {
			height: 100%;
		}
	`;

  @property({ type: Array }) nodes: MapNodeData[] = [];
  @property({ type: Array }) edges: MapEdgeData[] = [];
  @property({ type: Array }) embassyEdges: MapEmbassyEdge[] = [];
  @property({ type: String }) searchQuery = '';

  private _graph: Graph3DInstance | null = null;
  private _containerEl: HTMLDivElement | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _prevNodeCount = 0;
  private _prevEdgeCount = 0;
  @state() private _isFlattened = false;
  private _animFrame = 0;
  /** Map of node ID → Three.js object group for animation */
  private _nodeObjects = new Map<string, Group>();

  protected render() {
    return html`
			<div class="graph-container"></div>
			<div class="map3d-toolbar">
				<button class="map3d-btn flatten-btn ${this._isFlattened ? 'map3d-btn--active' : ''}" @click=${this._toggleFlatten}>
					${this._isFlattened ? msg('3D View') : msg('Flatten')}
				</button>
				<button class="map3d-btn" @click=${this._resetView}>
					${msg('Reset View')}
				</button>
			</div>
			<div class="map3d-tooltip"></div>
		`;
  }

  protected firstUpdated(): void {
    this._containerEl = this.renderRoot.querySelector<HTMLDivElement>('.graph-container');
    if (!this._containerEl) return;

    this._initGraph();

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (this._graph && width > 0 && height > 0) {
          this._graph.width(width).height(height);
        }
      }
    });
    this._resizeObserver.observe(this._containerEl);
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (!this._graph) return;

    const structuralChange =
      this.nodes.length !== this._prevNodeCount || this.edges.length !== this._prevEdgeCount;

    if (
      (changed.has('nodes') || changed.has('edges') || changed.has('embassyEdges')) &&
      structuralChange
    ) {
      this._prevNodeCount = this.nodes.length;
      this._prevEdgeCount = this.edges.length;
      this._updateGraphData();
    }

    // Search filter: scale non-matching nodes down
    if (changed.has('searchQuery')) {
      this._applySearchFilter();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = 0;
    }
    if (this._graph) {
      this._graph.pauseAnimation();
      this._graph._destructor();
      this._graph = null;
    }
  }

  private _initGraph(): void {
    if (!this._containerEl) return;

    const rect = this._containerEl.getBoundingClientRect();

    // eslint-disable-next-line new-cap
    const graph = new ForceGraph3D(this._containerEl)
      .width(rect.width || 800)
      .height(rect.height || 600)
      .backgroundColor('#000005')
      .showNavInfo(false)
      // Node rendering — callbacks receive NodeObject, cast to GraphNode3D
      .nodeThreeObject((node: NodeObject) => {
        const obj = createNodeObject(node as GraphNode3D);
        this._nodeObjects.set((node as GraphNode3D).id, obj);
        return obj;
      })
      .nodeThreeObjectExtend(false)
      .nodeVal((node: NodeObject) =>
        (node as GraphNode3D).simulationType === 'game_instance' ? 2 : 8,
      )
      .nodeLabel('')
      // Link rendering — callbacks receive LinkObject, cast to InternalLink3D
      .linkColor((link: LinkObject) => getLinkColor(link as InternalLink3D))
      .linkWidth((link: LinkObject) => getLinkWidth(link as InternalLink3D))
      .linkOpacity(0.5)
      .linkDirectionalParticles((link: LinkObject) => {
        const l = link as InternalLink3D;
        if (l.isEmbassy) return 2;
        if (l.connectionType === 'template_link') return 0;
        return l.operativeHeat ? Math.min(l.operativeHeat, 4) : 1;
      })
      .linkDirectionalParticleSpeed(0.004)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleColor((link: LinkObject) => getLinkColor(link as InternalLink3D))
      // Force configuration
      .d3VelocityDecay(0.3)
      .d3AlphaDecay(0.02)
      .warmupTicks(60)
      .cooldownTicks(150)
      // Interaction
      .onNodeClick((node: NodeObject) => {
        this._handleNodeClick(node as GraphNode3D);
      })
      .onNodeHover((node: NodeObject | null) => {
        this._handleNodeHover(node as GraphNode3D | null);
      })
      .onLinkClick((link: LinkObject) => {
        this._handleLinkClick(link as InternalLink3D);
      })
      .enableNodeDrag(false);

    this._graph = graph;

    // Add bloom post-processing for glow effect
    try {
      const bloomPass = new UnrealBloomPass(
        new Vector2(rect.width || 800, rect.height || 600),
        1.2, // strength
        0.6, // radius
        0.7, // threshold
      );
      const composer = graph.postProcessingComposer();
      composer.addPass(bloomPass);
    } catch (_e) {
      // Bloom may fail on some WebGL contexts — proceed without it
    }

    // Add starfield to scene
    try {
      const starfield = createStarfield();
      graph.scene().add(starfield);
    } catch (_e) {
      // Non-critical
    }

    // Configure forces
    this._configureForces();

    // Hide nav info text injected by 3d-force-graph (not always hidden by showNavInfo(false))
    if (this._containerEl) {
      const navInfo = this._containerEl.querySelector('.scene-nav-info');
      if (navInfo) (navInfo as HTMLElement).style.display = 'none';
    }

    // Start animation loop for node microanimations
    this._startAnimationLoop();

    // Load data
    if (this.nodes.length > 0) {
      this._updateGraphData();
    }
  }

  private _configureForces(): void {
    if (!this._graph) return;

    const charge = this._graph.d3Force('charge');
    if (hasStrengthSetter(charge)) {
      charge.strength((node: NodeObject) =>
        (node as GraphNode3D).simulationType === 'game_instance' ? -80 : -300,
      );
    }

    const link = this._graph.d3Force('link');
    if (hasDistanceSetter(link)) {
      link.distance((l: LinkObject) => {
        const ll = l as InternalLink3D;
        if (ll.connectionType === 'template_link') return 100;
        if (ll.isEmbassy) return 200;
        return 180;
      });
    }
  }

  private _updateGraphData(): void {
    if (!this._graph) return;

    // Clear cached node objects — they'll be recreated by nodeThreeObject callback
    this._nodeObjects.clear();

    const links: InternalLink3D[] = [];

    for (const edge of this.edges) {
      links.push({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        connectionType: edge.connectionType,
        operativeHeat: edge.operativeHeat,
        operativeTypes: edge.operativeTypes,
        strength: edge.strength,
        isEmbassy: false,
      });
    }

    for (const emb of this.embassyEdges) {
      links.push({
        id: emb.id,
        source: emb.sourceSimId,
        target: emb.targetSimId,
        connectionType: 'embassy',
        strength: 0.5,
        isEmbassy: true,
      });
    }

    const graphNodes: GraphNode3D[] = this.nodes.map((n) => ({ ...n }));

    this._graph.graphData({ nodes: graphNodes, links });

    // Center camera after layout
    setTimeout(() => {
      this._graph?.zoomToFit(800, 40);
    }, 1200);
  }

  // ── Interaction handlers ──────────────────────────────────────────────

  private _handleNodeClick(node: GraphNode3D): void {
    // Fly camera to node
    if (this._graph) {
      const distance = 120;
      const distRatio = 1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      this._graph.cameraPosition(
        {
          x: (node.x ?? 0) * distRatio,
          y: (node.y ?? 0) * distRatio,
          z: (node.z ?? 0) * distRatio,
        },
        { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
        1200,
      );
    }

    // Dispatch click event for parent handling
    this.dispatchEvent(
      new CustomEvent<MapNodeData>('node-click', {
        detail: node,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleNodeHover(node: GraphNode3D | null): void {
    const tooltip = this.renderRoot.querySelector<HTMLDivElement>('.map3d-tooltip');
    if (!tooltip || !this._graph) return;

    if (!node) {
      tooltip.classList.remove('map3d-tooltip--visible');
      return;
    }

    // Position tooltip via screen coordinates
    const coords = this._graph.graph2ScreenCoords(node.x ?? 0, node.y ?? 0, node.z ?? 0);

    tooltip.style.left = `${coords.x + 16}px`;
    tooltip.style.top = `${coords.y - 12}px`;

    // Build tooltip content using Lit render() for safe DOM construction
    const phaseColor =
      node.simulationType === 'game_instance' && node.epochStatus
        ? (PHASE_COLORS_3D[node.epochStatus] ?? 'var(--color-text-muted)')
        : null;

    const dims = ['stability', 'influence', 'sovereignty', 'diplomatic', 'military'] as const;

    render(
      html`
        <div class="tooltip__name" style="color:${node.color}">${node.name}</div>
        <div class="tooltip__stat">${node.agentCount} Agents / ${node.buildingCount} Buildings / ${node.eventCount} Events</div>
        ${
          phaseColor
            ? html`<div class="tooltip__phase" style="color:${phaseColor}">${node.epochStatus}</div>`
            : ''
        }
        ${
          node.scoreDimensions
            ? dims.map((dim) => {
                const value = Math.max(0, Math.min(100, node.scoreDimensions?.[dim] ?? 0));
                const color = SCORE_DIMENSION_COLORS[dim] ?? 'var(--color-text-muted)';
                return html`
                <div class="tooltip__dim-bar">
                  <span class="tooltip__dim-label">${dim.slice(0, 4)}</span>
                  <div class="tooltip__dim-track">
                    <div class="tooltip__dim-fill" style="width:${value}%;background:${color}"></div>
                  </div>
                </div>`;
              })
            : ''
        }
      `,
      tooltip,
    );
    tooltip.classList.add('map3d-tooltip--visible');
  }

  private _handleLinkClick(link: InternalLink3D): void {
    // Find original edge data by matching source/target IDs
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    const edge = this.edges.find(
      (e) =>
        (e.sourceId === sourceId && e.targetId === targetId) ||
        (e.sourceId === targetId && e.targetId === sourceId),
    );

    if (edge) {
      this.dispatchEvent(
        new CustomEvent<MapEdgeData>('edge-click', {
          detail: edge,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  // ── Search filter ─────────────────────────────────────────────────────

  private _applySearchFilter(): void {
    if (!this._graph) return;

    const data = this._graph.graphData();
    for (const node of data.nodes as NodeObject[]) {
      const n = node as GraphNode3D;
      const matches = !this.searchQuery || n.name.toLowerCase().includes(this.searchQuery);
      const obj = this._nodeObjects.get(n.id);
      if (obj) {
        obj.scale.setScalar(matches ? 1.0 : 0.3);
      }
    }
  }

  // ── Flatten toggle ────────────────────────────────────────────────────

  private _toggleFlatten(): void {
    this._isFlattened = !this._isFlattened;
    if (!this._graph) return;

    if (this._isFlattened) {
      // Collapse to 2D plane
      this._graph.numDimensions(2);
      this._graph.d3ReheatSimulation();

      // Animate camera to top-down view after simulation settles
      setTimeout(() => {
        if (!this._graph) return;
        const data = this._graph.graphData();
        let cx = 0;
        let cy = 0;
        const nodes = data.nodes as GraphNode3D[];
        for (const n of nodes) {
          cx += n.x ?? 0;
          cy += n.y ?? 0;
        }
        cx /= nodes.length || 1;
        cy /= nodes.length || 1;
        this._graph.cameraPosition({ x: cx, y: cy, z: 400 }, { x: cx, y: cy, z: 0 }, 1200);
      }, 800);
    } else {
      // Restore 3D layout
      this._graph.numDimensions(3);
      this._graph.d3ReheatSimulation();

      setTimeout(() => {
        this._graph?.zoomToFit(800, 40);
      }, 1500);
    }
  }

  // ── Microanimation loop ───────────────────────────────────────────────

  private _startAnimationLoop(): void {
    const animate = () => {
      const time = performance.now() / 1000;
      animateNodes(this._nodeObjects, time);
      this._animFrame = requestAnimationFrame(animate);
    };
    this._animFrame = requestAnimationFrame(animate);
  }

  // ── Toolbar actions ───────────────────────────────────────────────────

  private _resetView(): void {
    this._graph?.zoomToFit(600, 40);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-map-graph-3d': VelgMapGraph3D;
  }
}

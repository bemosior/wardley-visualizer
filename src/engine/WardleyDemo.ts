import type { DemoConfig, DemoConnection, DemoNode } from "./types";
import {
  createConnectionLine,
  createFireworkShells,
  createFlowParticles,
  createLayer,
  createMapBackdrop,
  createMapCaption,
  createNodeGroup,
  createSvgRoot,
  createTargetMarker,
  fitNodeLabel,
  genesisCenterX,
  NODE_RADIUS,
  stageLabelAt,
} from "./render";
import { injectStylesOnce } from "./styles";
import { attachAxisDrag, attachDrag, setNodePosition, type ConnectedLine, type RevealTarget } from "./drag";
import { animateTo } from "./animate";

export interface MountOptions {
  /** an external element (e.g. a toolbox slot) that the draggable node must be picked up from */
  dragHandle?: HTMLElement;
}

export interface EvolutionDragStepOptions {
  /** fires with the current stage label ("Genesis"/"Custom-Built"/"Product"/"Commodity") on every pointer move */
  onPositionChange?: (stageLabel: string) => void;
  /** fires once, the first time the node is dropped — the signal a caller uses to reveal a confirm control */
  onReadyToConfirm?: () => void;
}

export interface EvolutionDragHandle {
  /** locks in the node's current position, fires its "placement confirmed" feedback, and stops further dragging */
  confirm: () => void;
}

export interface DragStepOptions {
  snapThreshold: number;
  /** an external element (e.g. a toolbox slot) that the node must be picked up from */
  dragHandle?: HTMLElement;
  /** id of the node whose "charged" glow and lead flow-particle delay should sync with this step's snap */
  rootNodeId?: string;
  onComplete?: () => void;
}

const FLOW_PARTICLE_COUNT = 3;
const FLOW_PARTICLE_CYCLE = 1.8;
/** seconds between each particle's start within one line's travel cycle, for an evenly spaced trailing chain */
const FLOW_PARTICLE_STAGGER = FLOW_PARTICLE_CYCLE / FLOW_PARTICLE_COUNT;

/** negative delay so the User<-Need segment stays permanently phase-shifted behind the lead (Dependency<-Need) segments */
const FLOW_STAGGER_DELAY = -0.47;

/** delay so the root node's idle "charged" glow stays permanently phase-shifted behind the draggable node's */
const CHARGED_STAGGER_DELAY = "0.4s";

/** firework shell animation is 1.1s plus up to ~0.36s shell stagger; pad before cleanup */
const FIREWORK_CLEANUP_MS = 1700;
const FIREWORK_BURST_STAGGER_MS = 250;

/** how long the map caption (e.g. "Let's turn it into a Wardley Map!") stays fully visible before fading out */
const MAP_CAPTION_VISIBLE_MS = 5200;
/**
 * matches .wd-map-caption's opacity transition duration, so cleanup removes the element only
 * after it's invisible. Exported so callers (e.g. `runValueChainScenario`) can stagger other
 * fade-ins to start only once the caption has finished appearing.
 */
export const MAP_CAPTION_FADE_MS = 600;

export class WardleyDemo {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private viewBox: { width: number; height: number };

  /** fixed z-order, bottom to top: map backdrop, target markers, connection lines, flow particles, node groups, map caption */
  private backdropLayer: SVGGElement;
  private markerLayer: SVGGElement;
  private lineLayer: SVGGElement;
  private particleLayer: SVGGElement;
  private nodeLayer: SVGGElement;
  private captionLayer: SVGGElement;

  private nodesById = new Map<string, DemoNode>();
  private nodeGroups = new Map<string, SVGGElement>();
  private lines: { conn: DemoConnection; el: SVGLineElement }[] = [];

  /** the in-flight drag step, if any — lets `skipDrag()` complete it without a real pointer gesture */
  private pendingDrag?: {
    node: DemoNode;
    nodeGroup: SVGGElement;
    connectedLines: ConnectedLine[];
    targetMarker: SVGGElement;
    options: DragStepOptions;
  };

  static mount(container: HTMLElement, config: DemoConfig, options?: MountOptions): WardleyDemo {
    return new WardleyDemo(container, config, options);
  }

  private constructor(container: HTMLElement, config: DemoConfig, options?: MountOptions) {
    injectStylesOnce();

    this.container = container;
    this.container.classList.add("wardley-demo-root");
    this.viewBox = config.viewBox;

    this.svg = createSvgRoot(config.viewBox);
    this.container.appendChild(this.svg);

    this.backdropLayer = createLayer();
    this.markerLayer = createLayer();
    this.lineLayer = createLayer();
    this.particleLayer = createLayer();
    this.nodeLayer = createLayer();
    this.captionLayer = createLayer();
    this.svg.append(
      this.backdropLayer,
      this.markerLayer,
      this.lineLayer,
      this.particleLayer,
      this.nodeLayer,
      this.captionLayer,
    );

    for (const node of config.nodes) {
      this.addNode(node);
    }
    for (const conn of config.connections) {
      this.addConnection(conn);
    }

    const draggableNode = config.nodes.find((n) => n.draggable);
    if (draggableNode) {
      this.runDragStep(draggableNode, {
        snapThreshold: config.snapThreshold,
        dragHandle: options?.dragHandle,
        rootNodeId: config.connections[0]?.from,
        onComplete: config.onComplete,
      });
    }
  }

  /**
   * snapshots the demo's current on-screen scale (rendered pixels per viewBox unit). Call this
   * immediately before triggering whatever host-side layout change (e.g. collapsing the
   * explanation column) will give this demo's container more width, then pass the result to
   * `showMapBackdrop` once that resize has happened — that's what lets the map widen the viewBox
   * without changing how big or where any already-placed node renders. Returns 0 in environments
   * with no real layout (e.g. tests), which `showMapBackdrop` treats as "don't resize."
   */
  captureScale(): number {
    const rect = this.container.getBoundingClientRect();
    return rect.width / this.viewBox.width;
  }

  /**
   * renders the evolution-axis map backdrop into the backdrop layer, behind everything else; safe
   * to call once, any time after mount. `scale` must be the value `captureScale()` returned just
   * before the container was resized — width is widened to exactly fill the container's new width
   * at that same scale, and (if `targetHeightPx` is given, e.g. a sibling toolbox's measured
   * height) height is extended downward to reach it at that same scale too — never shrunk below
   * the existing viewBox, so every existing node keeps its current pixel size and position; only
   * new map area becomes visible alongside/beneath them. A non-positive `scale` (the default in
   * environments with no real layout) is a no-op and the backdrop renders at the existing viewBox
   * size. If `captionText` is given, it's shown as a transient overlay (see `showMapCaption`)
   * centered on whatever new area the resize just revealed (or the whole viewBox, if there was no
   * resize) — never over the already-placed value chain.
   */
  showMapBackdrop(scale: number, targetHeightPx?: number, captionText?: string): void {
    const previousWidth = this.viewBox.width;
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && scale > 0) {
      const mapWidth = Math.max(this.viewBox.width, rect.width / scale);
      const mapHeight = targetHeightPx
        ? Math.max(this.viewBox.height, targetHeightPx / scale)
        : this.viewBox.height;
      this.viewBox = { width: mapWidth, height: mapHeight };
      this.svg.setAttribute("viewBox", `0 0 ${this.viewBox.width} ${this.viewBox.height}`);
    }
    this.backdropLayer.appendChild(createMapBackdrop(this.viewBox));

    if (captionText) {
      const captionX = (previousWidth + this.viewBox.width) / 2;
      this.showMapCaption(captionText, captionX, this.viewBox.height / 2);
    }
  }

  /** renders `text` into the caption layer (above everything), fades it in, then fades it out and removes it a couple seconds later */
  private showMapCaption(text: string, x: number, y: number): void {
    const caption = createMapCaption(text, x, y);
    this.captionLayer.appendChild(caption);

    // deferred via setTimeout (not added synchronously) so the browser paints the caption's
    // initial opacity:0 first — adding the visible class in the same tick it's appended would let
    // the browser coalesce both states and skip the transition entirely.
    setTimeout(() => caption.classList.add("wd-map-caption--visible"), 0);
    setTimeout(() => {
      caption.classList.remove("wd-map-caption--visible");
      setTimeout(() => caption.remove(), MAP_CAPTION_FADE_MS);
    }, MAP_CAPTION_VISIBLE_MS);
  }

  /** registers a node's data and renders its group into the node layer, at its `start` position if draggable */
  addNode(node: DemoNode): SVGGElement {
    this.nodesById.set(node.id, node);
    const group = createNodeGroup(node);
    this.nodeGroups.set(node.id, group);
    this.nodeLayer.appendChild(group);
    const label = group.querySelector<SVGTextElement>(".wd-node-label");
    if (label) {
      fitNodeLabel(label);
    }
    return group;
  }

  /** renders a connection's line into the line layer; both endpoints must already be registered via addNode */
  addConnection(conn: DemoConnection): SVGLineElement {
    const el = createConnectionLine(conn, this.nodesById);
    this.lines.push({ conn, el });
    this.lineLayer.appendChild(el);
    return el;
  }

  /** updates an already-registered node's label text in place, refitting it to the node's radius */
  relabelNode(id: string, label: string): void {
    const labelEl = this.nodeGroups.get(id)?.querySelector<SVGTextElement>(".wd-node-label");
    if (!labelEl) return;
    labelEl.style.fontSize = "";
    labelEl.textContent = label;
    fitNodeLabel(labelEl);
  }

  /** wires drag-to-target interaction for an already-registered node; fires the snap celebration on success */
  runDragStep(node: DemoNode, options: DragStepOptions): void {
    const nodeGroup = this.nodeGroups.get(node.id)!;
    const targetMarker = createTargetMarker(node);
    this.markerLayer.appendChild(targetMarker);

    if (options.dragHandle) {
      nodeGroup.style.opacity = "0";
    } else {
      nodeGroup.classList.add("wd-node--beckon");
    }

    const connectedLines: ConnectedLine[] = this.lines
      .filter(({ conn }) => conn.from === node.id || conn.to === node.id)
      .map(({ conn, el }) => ({
        line: el,
        endpoint: conn.from === node.id ? "from" : "to",
      }));

    const revealTargets: RevealTarget[] = this.lines.map(({ el }) => ({
      element: el as SVGElement,
      baseOpacity: 0.5,
    }));

    this.pendingDrag = { node, nodeGroup, connectedLines, targetMarker, options };

    attachDrag(
      {
        svg: this.svg,
        nodeGroup,
        node,
        connectedLines,
        revealTargets,
        externalHandle: options.dragHandle,
        onSnapSuccess: () => this.celebrateSnap(node, nodeGroup, targetMarker, options),
      },
      options.snapThreshold,
    );
  }

  /** post-snap reveal: activates every line, charges the node and its root, plays flow particles and a firework burst */
  private celebrateSnap(
    node: DemoNode,
    nodeGroup: SVGGElement,
    targetMarker: SVGGElement,
    options: DragStepOptions,
  ): void {
    this.pendingDrag = undefined;
    this.activateLines();
    targetMarker.classList.add("wd-target-marker--hidden");

    nodeGroup.classList.add("wd-node--charged");
    const rootNodeGroup = options.rootNodeId ? this.nodeGroups.get(options.rootNodeId) : undefined;
    if (rootNodeGroup) {
      rootNodeGroup.classList.add("wd-node--charged");
      const rootNodeShape = rootNodeGroup.querySelector<SVGElement>(".wd-node-shape");
      if (rootNodeShape) {
        rootNodeShape.style.animationDelay = CHARGED_STAGGER_DELAY;
      }
    }

    this.spawnFlowParticles();
    this.fireworkAt(node.x, node.y);

    options.onComplete?.();
  }

  /**
   * completes the in-flight drag step instantly, without a real pointer gesture — places the
   * node at its target and runs the same `celebrateSnap` flourish a real snap would. A no-op if
   * no drag step is pending (e.g. it already snapped, or this config has no draggable node).
   * Dev/testing convenience for jumping straight past Phase 0 — see `src/dev/autopilot.ts`.
   */
  skipDrag(): void {
    const pending = this.pendingDrag;
    if (!pending) return;
    const { node, nodeGroup, connectedLines, targetMarker, options } = pending;
    nodeGroup.classList.remove("wd-node--beckon");
    if (options.dragHandle) {
      nodeGroup.style.opacity = "1";
    }
    setNodePosition(nodeGroup, connectedLines, { x: node.x, y: node.y });
    this.celebrateSnap(node, nodeGroup, targetMarker, options);
  }

  /**
   * adds the inviting "beckon" pulse (the same cue Phase 0 uses on the undragged Need) to a
   * node, e.g. to prompt the visitor toward Phase 2's evolution-axis drag once the map appears.
   */
  beckonNode(nodeId: string): void {
    this.nodeGroups.get(nodeId)?.classList.add("wd-node--beckon");
  }

  /**
   * removes the idle "charged" pulsing glow from the given nodes, without touching anything
   * else (lines stay active, flow particles keep running). Used when Phase 2's map backdrop
   * appears — the glow is a Phase 0/1 "this connection is alive" cue that competes with the
   * evolution-axis drag interaction Phase 2 wants the visitor's attention on instead.
   */
  stopCharging(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.nodeGroups.get(id)?.classList.remove("wd-node--charged");
    }
  }

  /**
   * animates a node (and its connected lines) horizontally to the center of the map's Genesis
   * column, keeping its current y — used right as Phase 2's map backdrop appears, so the Need
   * visibly settles onto its starting evolution stage instead of just appearing there already
   * placed. Updates the node's stored position and respawns flow particles on lines touching it
   * afterward, so the particle flow keeps tracking the line's new path. A no-op if the node id
   * isn't registered.
   */
  slideToGenesis(nodeId: string, durationMs = 700): void {
    const node = this.nodesById.get(nodeId);
    const nodeGroup = this.nodeGroups.get(nodeId);
    if (!node || !nodeGroup) return;

    const connectedLines: ConnectedLine[] = this.lines
      .filter(({ conn }) => conn.from === nodeId || conn.to === nodeId)
      .map(({ conn, el }) => ({
        line: el,
        endpoint: conn.from === nodeId ? "from" : "to",
      }));

    const from = { x: node.x, y: node.y };
    const to = { x: genesisCenterX(this.viewBox.width), y: node.y };

    animateTo(
      from,
      to,
      durationMs,
      (point) => setNodePosition(nodeGroup, connectedLines, point),
      () => {
        node.x = to.x;
        this.respawnFlowParticlesTouching(nodeId);
      },
    );
  }

  /**
   * wires Phase 2's evolution-axis interaction for an already-registered node: free horizontal
   * drag (no snap, no auto-commit) with live `onPositionChange(stageLabel)` callbacks, and a
   * returned `confirm()` the caller invokes once the visitor has committed to where they dropped
   * it — that stops the beckon pulse, respawns flow particles on its lines, and fires a firework
   * at its final position as the "placement confirmed" cue. Doesn't re-add the "charged" glow
   * `stopCharging` cleared going into Phase 2 — it'd compete with the evolution-drag interaction.
   */
  runEvolutionDragStep(nodeId: string, options: EvolutionDragStepOptions = {}): EvolutionDragHandle {
    const node = this.nodesById.get(nodeId)!;
    const nodeGroup = this.nodeGroups.get(nodeId)!;

    const connectedLines: ConnectedLine[] = this.lines
      .filter(({ conn }) => conn.from === nodeId || conn.to === nodeId)
      .map(({ conn, el }) => ({
        line: el,
        endpoint: conn.from === nodeId ? "from" : "to",
      }));

    nodeGroup.classList.add("wd-node--draggable");

    const handle = attachAxisDrag({
      svg: this.svg,
      nodeGroup,
      node,
      connectedLines,
      minX: NODE_RADIUS,
      maxX: this.viewBox.width - NODE_RADIUS,
      onPositionChange: (x) => options.onPositionChange?.(stageLabelAt(x, this.viewBox.width)),
      onFirstRelease: options.onReadyToConfirm,
    });

    return {
      confirm: () => {
        handle.confirm((x) => {
          nodeGroup.classList.remove("wd-node--draggable");
          nodeGroup.classList.remove("wd-node--beckon");
          this.respawnFlowParticlesTouching(nodeId);
          this.fireworkAt(x, node.y);
        });
      },
    };
  }

  /**
   * non-drag celebration: fires one firework burst per node, top to bottom. For
   * flows (e.g. Phase 1's form sequence) that finish without a drag/snap to
   * anchor the celebration to. The lines/charging/flow-particle animations from
   * Phase 0's `celebrateSnap` are already running continuously by this point
   * and aren't re-triggered here.
   */
  celebrateAll(): void {
    this.activateLines();
    const orderedNodes = [...this.nodesById.values()].sort((a, b) => a.y - b.y);
    orderedNodes.forEach((node, i) => {
      setTimeout(() => this.fireworkAt(node.x, node.y), i * FIREWORK_BURST_STAGGER_MS);
    });
  }

  private activateLines(): void {
    for (const { el } of this.lines) {
      el.classList.add("wd-line--active");
      // clears createConnectionLine's initial opacity:0 (normally lifted by clearRevealOverride
      // mid-drag) — skipDrag() never runs a drag, so that inline override would otherwise survive
      // and mask the wd-line--active CSS rule, leaving the line invisible despite being "active"
      el.style.opacity = "";
    }
  }

  private spawnFlowParticles(): void {
    this.lines.forEach((_, index) => this.spawnParticlesForLine(index));
  }

  private spawnParticlesForLine(index: number): void {
    const { conn } = this.lines[index];
    const segmentDelay = index === 0 ? FLOW_STAGGER_DELAY : 0;
    const particles = createFlowParticles(conn, this.nodesById);
    particles.forEach((particle, i) => {
      const delay = segmentDelay + -(i * FLOW_PARTICLE_STAGGER);
      particle.style.animationDelay = `${delay}s`;
      this.particleLayer.appendChild(particle);
    });
  }

  /** removes and respawns the flow particles for every line touching `nodeId`, against its current (post-move) position — keeps the particles riding the line instead of a stale pre-move path */
  private respawnFlowParticlesTouching(nodeId: string): void {
    this.lines.forEach(({ conn }, index) => {
      if (conn.from !== nodeId && conn.to !== nodeId) return;
      this.particleLayer
        .querySelectorAll(`[data-from="${conn.from}"][data-to="${conn.to}"]`)
        .forEach((el) => el.remove());
      this.spawnParticlesForLine(index);
    });
  }

  /** spawns a one-shot firework burst at the given viewBox coordinates, in container pixel space */
  private fireworkAt(x: number, y: number): void {
    const svgRect = this.svg.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const scaleX = svgRect.width / this.viewBox.width;
    const scaleY = svgRect.height / this.viewBox.height;
    const pxX = svgRect.left - containerRect.left + x * scaleX;
    const pxY = svgRect.top - containerRect.top + y * scaleY;
    const shells = createFireworkShells(pxX, pxY);
    for (const shell of shells) {
      this.container.appendChild(shell);
    }
    setTimeout(() => {
      for (const shell of shells) {
        shell.remove();
      }
    }, FIREWORK_CLEANUP_MS);
  }

  destroy(): void {
    this.svg.remove();
    this.container.classList.remove("wardley-demo-root");
  }
}

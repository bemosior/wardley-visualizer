import type { DemoConfig, DemoConnection, DemoNode } from "./types";
import type { EvolutionStage } from "../domain/evolution";
import {
  createAnnotation,
  createConnectionLine,
  createEvolutionChevron,
  createFireworkShells,
  createFlowParticles,
  createLayer,
  createMapBackdrop,
  createMapCaption,
  createNodeGroup,
  createSvgRoot,
  createTargetMarker,
  fitNodeLabel,
  flowParamsForStage,
  genesisCenterX,
  NODE_RADIUS,
  stageLabelAt,
  type AnnotationRect,
} from "./render";
import { injectStylesOnce } from "./styles";
import { attachAxisDrag, attachDrag, setNodePosition, type ConnectedLine, type RevealTarget } from "./drag";
import { animateTo, type Point } from "./animate";

export interface MountOptions {
  /** an external element (e.g. a toolbox slot) that the draggable node must be picked up from */
  dragHandle?: HTMLElement;
}

export interface EvolutionDragStepOptions {
  /** fires with the current stage label ("Genesis"/"Custom-Built"/"Product"/"Commodity") on every pointer move */
  onPositionChange?: (stageLabel: EvolutionStage) => void;
  /** fires once, the first time the node is dropped — the signal a caller uses to reveal a confirm control */
  onReadyToConfirm?: () => void;
}

export interface EvolutionDragHandle {
  /** locks in the node's current position, fires its "placement confirmed" feedback, and stops further dragging */
  confirm: () => void;
  /** triggers onReadyToConfirm without a real drag — for autopilot/testing */
  skipDrag: () => void;
}

export interface DragStepOptions {
  snapThreshold: number;
  /** an external element (e.g. a toolbox slot) that the node must be picked up from */
  dragHandle?: HTMLElement;
  /** id of the node whose "charged" glow and lead flow-particle delay should sync with this step's snap */
  rootNodeId?: string;
  onComplete?: () => void;
}

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

  /** fixed z-order, bottom to top: map backdrop, target markers, connection lines, flow particles, node groups, annotations, map caption */
  private backdropLayer: SVGGElement;
  private markerLayer: SVGGElement;
  private lineLayer: SVGGElement;
  private particleLayer: SVGGElement;
  private nodeLayer: SVGGElement;
  private annotationLayer: SVGGElement;
  private captionLayer: SVGGElement;

  private nodesById = new Map<string, DemoNode>();
  private nodeGroups = new Map<string, SVGGElement>();
  private lines: { conn: DemoConnection; el: SVGLineElement }[] = [];
  /** a node's confirmed evolution stage, driving how the flow particles on its lines look (see `spawnParticlesForLine`); unset until it's actually placed on the evolution axis, which falls back to Phase 0/1's fixed pre-evolution look */
  private nodeStage = new Map<string, EvolutionStage>();
  /** every callout box placed so far (Phase 3), so a new one can pick a tier that doesn't collide with it — see `createAnnotation` */
  private annotationRects: AnnotationRect[] = [];

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
    this.annotationLayer = createLayer();
    this.captionLayer = createLayer();
    this.svg.append(
      this.backdropLayer,
      this.markerLayer,
      this.lineLayer,
      this.particleLayer,
      this.nodeLayer,
      this.annotationLayer,
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
   * Also clears any "pending" dimming `markPending` applied, since the node's turn has arrived.
   */
  beckonNode(nodeId: string): void {
    const nodeGroup = this.nodeGroups.get(nodeId);
    nodeGroup?.classList.add("wd-node--beckon");
    nodeGroup?.classList.remove("wd-node--pending");
  }

  /**
   * dims the given nodes to signal they aren't interactive yet — used for Phase 2's
   * capability queue, so a node waiting its turn doesn't read as draggable next to whichever
   * node is currently beckoning. Cleared automatically by `beckonNode` once a node's turn starts.
   */
  markPending(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.nodeGroups.get(id)?.classList.add("wd-node--pending");
    }
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
   * isn't registered (`onComplete` is not called in that case either).
   */
  slideToGenesis(nodeId: string, durationMs = 700, onComplete?: () => void): void {
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
      (point) => {
        setNodePosition(nodeGroup, connectedLines, point);
        this.updateFlowParticlePaths(nodeId, point);
      },
      () => {
        node.x = to.x;
        this.setNodeStage(nodeId, "Genesis");
        onComplete?.();
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

    const minX = NODE_RADIUS;
    const maxX = this.viewBox.width - NODE_RADIUS;
    const leftChevron = createEvolutionChevron("left");
    const rightChevron = createEvolutionChevron("right");
    nodeGroup.append(leftChevron, rightChevron);
    const updateChevrons = (x: number): void => {
      leftChevron.classList.toggle("wd-node-chevron--hidden", x <= minX);
      rightChevron.classList.toggle("wd-node-chevron--hidden", x >= maxX);
    };
    updateChevrons(node.x);

    const handle = attachAxisDrag({
      svg: this.svg,
      nodeGroup,
      node,
      connectedLines,
      minX,
      maxX,
      onPositionChange: (x) => {
        options.onPositionChange?.(stageLabelAt(x, this.viewBox.width));
        this.updateFlowParticlePaths(nodeId, { x, y: node.y });
        updateChevrons(x);
      },
      onFirstRelease: options.onReadyToConfirm,
    });

    return {
      confirm: () => {
        handle.confirm((x) => {
          nodeGroup.classList.remove("wd-node--draggable");
          nodeGroup.classList.remove("wd-node--beckon");
          leftChevron.remove();
          rightChevron.remove();
          this.setNodeStage(nodeId, stageLabelAt(x, this.viewBox.width));
          this.respawnFlowParticlesTouching(nodeId);
          this.fireworkAt(x, node.y);
        });
      },
      skipDrag: () => handle.skipDrag(),
    };
  }

  /**
   * non-drag celebration: fires one firework burst per node, top to bottom, repeated `rounds`
   * times (default 1). For flows (e.g. Phase 1's form sequence, or the Phase 2 finale) that
   * finish without a drag/snap to anchor the celebration to. The lines/charging/flow-particle
   * animations from Phase 0's `celebrateSnap` are already running continuously by this point
   * and aren't re-triggered here.
   */
  celebrateAll(rounds = 1): void {
    this.activateLines();
    const orderedNodes = [...this.nodesById.values()].sort((a, b) => a.y - b.y);
    const roundDuration = orderedNodes.length * FIREWORK_BURST_STAGGER_MS + 300;
    for (let r = 0; r < rounds; r++) {
      const offset = r * roundDuration;
      orderedNodes.forEach((node, i) => {
        setTimeout(() => this.fireworkAt(node.x, node.y), offset + i * FIREWORK_BURST_STAGGER_MS);
      });
    }
  }

  /**
   * anchors a short text callout near an already-registered node's current position, permanently
   * visible (Phase 3, one per capability). Basic overlap avoidance: if the callout would collide
   * horizontally with one already placed, it stacks one tier higher instead (see `createAnnotation`)
   * rather than solving full layout — at most three of these ever exist.
   */
  addAnnotation(nodeId: string, text: string): void {
    const node = this.nodesById.get(nodeId)!;
    const { element, rect } = createAnnotation(node, text, this.annotationRects);
    this.annotationRects.push(rect);
    this.annotationLayer.appendChild(element);
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

  /**
   * a line's flow is driven by the evolution stage of its `to` node (the "supplier" end) —
   * unset (Phase 0/1's fixed look) until that node has actually been placed on the evolution axis.
   */
  private spawnParticlesForLine(index: number): void {
    const { conn } = this.lines[index];
    const stage = this.nodeStage.get(conn.to);
    const { count, durationS } = flowParamsForStage(stage);
    const stagger = durationS / count;
    const segmentDelay = index === 0 ? FLOW_STAGGER_DELAY : 0;
    const particles = createFlowParticles(conn, this.nodesById, stage);
    particles.forEach((particle, i) => {
      const delay = segmentDelay + -(i * stagger);
      particle.style.animationDelay = `${delay}s`;
      this.particleLayer.appendChild(particle);
    });
  }

  /** records a node's confirmed evolution stage and, only if it actually changed, respawns the flow particles on every line touching it so they pick up the new count/speed/regularity */
  private setNodeStage(nodeId: string, stage: EvolutionStage): void {
    if (this.nodeStage.get(nodeId) === stage) return;
    this.nodeStage.set(nodeId, stage);
    this.respawnFlowParticlesTouching(nodeId);
  }

  /**
   * live-repoints the offset-path of every flow particle riding a line touching `nodeId`, given
   * that node's in-flight position — used while a node is being animated/dragged (before its
   * stored x/y are updated) so the particles keep tracking the line instead of visibly lagging
   * behind it. Cheaper than `respawnFlowParticlesTouching` and doesn't reset each particle's
   * animation phase, which a mid-drag respawn would (a visible stutter on every pointer move).
   */
  private updateFlowParticlePaths(nodeId: string, pos: Point): void {
    this.lines.forEach(({ conn }) => {
      if (conn.from !== nodeId && conn.to !== nodeId) return;
      const from = conn.from === nodeId ? pos : this.nodesById.get(conn.from)!;
      const to = conn.to === nodeId ? pos : this.nodesById.get(conn.to)!;
      const path = `path("M ${from.x},${from.y} L ${to.x},${to.y}")`;
      this.particleLayer
        .querySelectorAll<SVGCircleElement>(`[data-from="${conn.from}"][data-to="${conn.to}"]`)
        .forEach((el) => {
          el.style.offsetPath = path;
        });
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

  /** converts a viewBox coordinate to container-pixel space, shared by `fireworkAt` and `getNodePixelPosition` */
  private viewBoxToContainerPx(x: number, y: number): Point {
    const svgRect = this.svg.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const scaleX = svgRect.width / this.viewBox.width;
    const scaleY = svgRect.height / this.viewBox.height;
    return {
      x: svgRect.left - containerRect.left + x * scaleX,
      y: svgRect.top - containerRect.top + y * scaleY,
    };
  }

  /**
   * a node's current position in container-pixel space (the same coordinate space `fireworkAt`
   * uses), plus its on-screen radius — null if the node id isn't registered. Public so callers
   * (e.g. a mascot/guide overlay) can anchor UI near a node without duplicating this conversion,
   * and can use `radius` to offset themselves clear of the node's circle instead of covering it.
   */
  getNodePixelPosition(nodeId: string): (Point & { radius: number }) | null {
    const node = this.nodesById.get(nodeId);
    if (!node) return null;
    const pos = this.viewBoxToContainerPx(node.x, node.y);
    const scaleX = this.svg.getBoundingClientRect().width / this.viewBox.width;
    return { ...pos, radius: NODE_RADIUS * scaleX };
  }

  /** spawns a one-shot firework burst at the given viewBox coordinates, in container pixel space */
  private fireworkAt(x: number, y: number): void {
    const { x: pxX, y: pxY } = this.viewBoxToContainerPx(x, y);
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

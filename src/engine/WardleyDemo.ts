import type { DemoConfig, DemoConnection, DemoNode } from "./types";
import type { EvolutionStage } from "../domain/evolution";
import {
  backdropSafeBottomY,
  buildFlowParticlePath,
  createAnnotation,
  createConnectionLine,
  createDirectionalArrow,
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
import { attachAxisDrag, attachDrag, setNodePosition, type ConnectedLine, type DragHandle, type RevealTarget } from "./drag";
import { animateTo, type Point } from "./animate";
import type { Rect } from "./geometry";

export interface MountOptions {
  /** an external element (e.g. a toolbox slot) that the draggable node must be picked up from */
  dragHandle?: HTMLElement;
  /**
   * every initial node's label starts hidden (`wd-node-label--hidden`), with zero visible fade --
   * see `createNodeGroup`'s `hideLabel` doc comment for why this must happen at mount time rather
   * than via a separate post-mount `addNode`/class-toggle call. Used by Phase 0's opening beat,
   * which reveals labels later via `revealNodeLabels()` (an intentional, animated reveal).
   */
  hideNodeLabels?: boolean;
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

/** matches `.wd-node--entering`/`.wd-line--entering`'s animation duration (`styles.ts`) — how long before the transient entrance class can be cleaned up */
const NODE_ENTER_MS = 400;

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
  /** true once `activateLines()` has fired (Phase 0's snap celebration) — lets `addConnection` activate any line added afterward immediately instead of leaving it stuck at its initial `opacity:0` */
  private linesActive = false;
  /** a node's confirmed evolution stage, driving how the flow particles on its lines look (see `spawnParticlesForLine`); unset until it's actually placed on the evolution axis, which falls back to Phase 0/10's fixed pre-evolution look */
  private nodeStage = new Map<string, EvolutionStage>();
  /** `slideToGenesis`'s in-flight animation for a node, if any -- cancelled the moment a real evolution-axis drag starts on that node (see `runEvolutionDragStep`'s `onDragStart`), so the slide can't keep overwriting the node's position out from under a visitor who grabbed it mid-slide */
  private pendingSlides = new Map<string, () => void>();
  /** every callout box placed so far (Phase 30), so a new one can pick a tier that doesn't collide with it — see `createAnnotation` */
  private annotationRects: AnnotationRect[] = [];

  /** the in-flight drag step, if any — lets `skipDrag()` complete it without a real pointer gesture */
  private pendingDrag?: {
    node: DemoNode;
    nodeGroup: SVGGElement;
    connectedLines: ConnectedLine[];
    targetMarker: SVGGElement;
    options: DragStepOptions;
    handle: DragHandle;
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
      this.addNode(node, { hideLabel: options?.hideNodeLabels });
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
   * immediately before triggering whatever host-side layout change will give this demo's
   * container more width, then pass the result to `showMapBackdrop` once that resize has
   * happened — that's what lets the map widen the viewBox without changing how big or where any
   * already-placed node renders. Returns 0 in environments with no real layout (e.g. tests),
   * which `growViewBox` (and so `showMapBackdrop`) treats as "don't resize." Host pages no longer
   * resize the container mid-scenario (the canvas is a consistent size throughout, grown once via
   * `growToFillContainer` right after mount — see its doc comment), but this stays available for
   * `showMapBackdrop`'s own resize math and for any future host-side layout change.
   */
  captureScale(): number {
    const rect = this.container.getBoundingClientRect();
    return rect.width / this.viewBox.width;
  }

  /**
   * grows the viewBox (never shrinks it) so it fills the container's *current* width at `scale`
   * (rendered px per viewBox unit), and its height to reach `targetHeightPx` at that same scale
   * if given — every already-placed node keeps its exact pixel size and position; only new,
   * empty viewBox area appears alongside/beneath them. A non-positive `scale`, or a container with
   * no real layout yet (e.g. tests), is a no-op. Shared by `growToFillContainer` (called once,
   * right after mount) and `showMapBackdrop` (called again at the Phase 20 transition, where it's
   * normally a no-op now that the container doesn't resize in between — see both doc comments).
   */
  private growViewBox(scale: number, targetHeightPx?: number): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || scale <= 0) return;
    const mapWidth = Math.max(this.viewBox.width, rect.width / scale);
    const mapHeight = targetHeightPx
      ? Math.max(this.viewBox.height, targetHeightPx / scale)
      : this.viewBox.height;
    this.viewBox = { width: mapWidth, height: mapHeight };
    this.svg.setAttribute("viewBox", `0 0 ${this.viewBox.width} ${this.viewBox.height}`);
  }

  /**
   * grows the viewBox to fill the container's current width, at the scale the value chain's
   * nodes were authored at (`scale` default of 1 — 1 viewBox unit ≈ 1px, e.g. `NODE_RADIUS`'s 48
   * renders as a 48px-radius circle). Call this once, right after mount, so the canvas is already
   * the same size for the whole scenario instead of visibly growing later at the Phase 20
   * transition (that used to be `showMapBackdrop`'s job, driven by `captureScale`/container-resize
   * timing — now the container never resizes, so this just does the growth eagerly using the
   * same math). `targetHeightPx` behaves like `showMapBackdrop`'s.
   */
  growToFillContainer(targetHeightPx?: number, scale = 1): void {
    this.growViewBox(scale, targetHeightPx);
  }

  /**
   * renders the evolution-axis map backdrop into the backdrop layer, behind everything else; safe
   * to call once, any time after mount. `scale` must be the value `captureScale()` returned just
   * before the container was resized — see `growViewBox` for the resize itself, which this reuses
   * (a no-op if `growToFillContainer` already grew the viewBox to fill the container, as host
   * pages now do). If `captionText` is given, it's shown as a transient overlay (see
   * `showMapCaption`) centered on whatever new area the resize just revealed (or the whole
   * viewBox, if there was no resize) — never over the already-placed value chain.
   */
  showMapBackdrop(scale: number, targetHeightPx?: number, captionText?: string): void {
    const previousWidth = this.viewBox.width;
    this.growViewBox(scale, targetHeightPx);
    this.clearBottomLabelBand();
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

  /**
   * lifts every currently-registered node (and its connected lines) straight up, just enough that
   * the lowest one clears `backdropSafeBottomY` — called once by `showMapBackdrop`, right before
   * the bottom evolution-stage labels render, so a value chain laid out before Phase 20 existed
   * (with no notion of that reserved band) doesn't end up with a node sitting on top of/against
   * them. The shift is capped at whatever headroom the topmost node already has above the viewBox
   * top edge, so this never pushes a fully-visible node off-screen to buy the bottom clearance; if
   * that cap isn't enough, some residual overlap is accepted rather than clipping the top. A no-op
   * (and no flow-particle respawn) if nothing actually overlaps the reserved band.
   */
  private clearBottomLabelBand(): void {
    const safeBottom = backdropSafeBottomY(this.viewBox.height);
    let maxBottom = -Infinity;
    let minTop = Infinity;
    for (const node of this.nodesById.values()) {
      maxBottom = Math.max(maxBottom, node.y + NODE_RADIUS);
      minTop = Math.min(minTop, node.y - NODE_RADIUS);
    }
    const overlap = maxBottom - safeBottom;
    if (overlap <= 0) return;
    const shift = Math.min(overlap, Math.max(0, minTop));
    if (shift <= 0) return;

    for (const [id, node] of this.nodesById) {
      node.y -= shift;
      const group = this.nodeGroups.get(id);
      if (!group) continue;
      const connectedLines: ConnectedLine[] = this.lines
        .filter(({ conn }) => conn.from === id || conn.to === id)
        .map(({ conn, el }) => ({ line: el, endpoint: conn.from === id ? "from" : "to" }));
      setNodePosition(group, connectedLines, { x: node.x, y: node.y });
    }
    for (const id of this.nodesById.keys()) {
      this.respawnFlowParticlesTouching(id);
    }
  }

  /**
   * registers a node's data and renders its group into the node layer, at its `start` position if
   * draggable. `animateIn` fades/pops the node in (`wd-node--entering`, `styles.ts`) instead of
   * having it pop into existence instantly — pass this for a node added mid-scenario alongside
   * others that are already sitting there (e.g. Phase 5 filling in the two missing Capability
   * nodes beside the one Phase 0 already rendered); leave it off for the initial mount, where
   * every node appears together and there's nothing for a lone node to visually jump ahead of.
   * `hideLabel` starts the node's label hidden with zero visible fade -- see `createNodeGroup`'s
   * doc comment for why this must be passed here rather than applied via a later class toggle.
   */
  addNode(node: DemoNode, options?: { animateIn?: boolean; hideLabel?: boolean }): SVGGElement {
    this.nodesById.set(node.id, node);
    const group = createNodeGroup(node, { hideLabel: options?.hideLabel });
    this.nodeGroups.set(node.id, group);
    if (options?.animateIn) {
      group.classList.add("wd-node--entering");
      setTimeout(() => group.classList.remove("wd-node--entering"), NODE_ENTER_MS);
    }
    this.nodeLayer.appendChild(group);
    const label = group.querySelector<SVGTextElement>(".wd-node-label");
    if (label) {
      fitNodeLabel(label);
    }
    return group;
  }

  /**
   * renders a connection's line into the line layer; both endpoints must already be registered
   * via addNode. If lines have already been activated (i.e. this is called after Phase 0's snap
   * celebration — e.g. Phase 5 wiring a newly-added Capability to the Need), the new line skips
   * `createConnectionLine`'s initial `opacity:0` and gets its flow particles immediately, matching
   * every other already-active line instead of sitting invisible forever (nothing else ever
   * re-activates a line added after the fact) — and both endpoints get the idle "charged" glow
   * too, matching whatever every other already-active connection's nodes already show (see
   * `celebrateSnap`; Phase 20's `stopCharging` expects every Capability to have it). That line
   * also fades in (`wd-line--entering`, same `NODE_ENTER_MS` duration as a new node's entrance)
   * rather than snapping straight to full opacity.
   */
  addConnection(conn: DemoConnection): SVGLineElement {
    const el = createConnectionLine(conn, this.nodesById);
    this.lines.push({ conn, el });
    this.lineLayer.appendChild(el);
    if (this.linesActive) {
      el.classList.add("wd-line--active", "wd-line--entering");
      el.style.opacity = "";
      setTimeout(() => el.classList.remove("wd-line--entering"), NODE_ENTER_MS);
      this.spawnParticlesForLine(this.lines.length - 1);
      this.nodeGroups.get(conn.from)?.classList.add("wd-node--charged");
      this.nodeGroups.get(conn.to)?.classList.add("wd-node--charged");
    }
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

  /**
   * appends a static directional-arrow cue (render.ts's `createDirectionalArrow`) into the marker
   * layer, pointing from `from` to `to` (both viewBox coordinates) — Phase 0's opening beat uses
   * this in place of a mascot explanation, pointing at the Need's destination before the visitor
   * has dragged it there. Caller removes the returned element once the cue is no longer needed
   * (e.g. right after the Need snaps into place).
   */
  addDirectionalArrow(from: Point, to: Point): SVGGElement {
    const arrow = createDirectionalArrow(from, to);
    this.markerLayer.appendChild(arrow);
    return arrow;
  }

  /**
   * reveals every currently-registered node's label (undoes the `hideNodeLabels` mount option, or
   * `addNode`'s `hideLabel` option) — fades in via `.wd-node-label`'s CSS transition, an
   * intentional animated reveal (unlike the hide itself, which must start instant — see
   * `createNodeGroup`'s doc comment).
   */
  revealNodeLabels(): void {
    for (const group of this.nodeGroups.values()) {
      group.querySelector<SVGTextElement>(".wd-node-label")?.classList.remove("wd-node-label--hidden");
    }
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

    const handle = attachDrag(
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
    this.pendingDrag = { node, nodeGroup, connectedLines, targetMarker, options, handle };
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

    // the node has settled at its target x/y for good now — clears `draggable` so any *later*
    // `addConnection` touching it (e.g. Phase 5 wiring a newly-added Capability to an
    // already-dragged Need) renders from that settled position via `createConnectionLine` instead
    // of stale-reading its pre-drag `start` (which `createConnectionLine` prefers whenever
    // `draggable` is still true, since that's what lets *this* node's own original connections
    // track it live during the drag itself, via `connectedLines`)
    node.draggable = false;
    nodeGroup.classList.add("wd-node--charged");
    const rootNodeGroup = options.rootNodeId ? this.nodeGroups.get(options.rootNodeId) : undefined;
    if (rootNodeGroup) {
      rootNodeGroup.classList.add("wd-node--charged");
      const rootNodeShape = rootNodeGroup.querySelector<SVGElement>(".wd-node-shape");
      if (rootNodeShape) {
        rootNodeShape.style.animationDelay = CHARGED_STAGGER_DELAY;
      }
    }
    // every other node hanging off the snapped node (e.g. Phase 0's Capability row) charges too,
    // in sync with the snapped node itself rather than staggered like the root — same "lead"
    // grouping the flow particles use (see FLOW_STAGGER_DELAY). Without this, Phase 20's
    // `stopCharging` call (which clears every Capability's glow) has nothing to clear.
    for (const { conn } of this.lines) {
      const otherId = conn.from === node.id ? conn.to : conn.to === node.id ? conn.from : undefined;
      if (!otherId || otherId === options.rootNodeId) continue;
      this.nodeGroups.get(otherId)?.classList.add("wd-node--charged");
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
    const { node, nodeGroup, connectedLines, targetMarker, options, handle } = pending;
    handle.skipDrag();
    nodeGroup.classList.remove("wd-node--beckon");
    if (options.dragHandle) {
      nodeGroup.style.opacity = "1";
    }
    setNodePosition(nodeGroup, connectedLines, { x: node.x, y: node.y });
    this.celebrateSnap(node, nodeGroup, targetMarker, options);
  }

  /**
   * adds the inviting "beckon" pulse (the same cue Phase 0 uses on the undragged Need) to a
   * node, e.g. to prompt the visitor toward Phase 20's evolution-axis drag once the map appears.
   * Also clears any "pending" dimming `markPending` applied, since the node's turn has arrived.
   */
  beckonNode(nodeId: string): void {
    const nodeGroup = this.nodeGroups.get(nodeId);
    nodeGroup?.classList.add("wd-node--beckon");
    nodeGroup?.classList.remove("wd-node--pending");
  }

  /**
   * dims the given nodes to signal they aren't interactive yet — used for Phase 20's
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
   * else (lines stay active, flow particles keep running). Used when Phase 20's map backdrop
   * appears — the glow is a Phase 0/10 "this connection is alive" cue that competes with the
   * evolution-axis drag interaction Phase 20 wants the visitor's attention on instead.
   */
  stopCharging(nodeIds: string[]): void {
    for (const id of nodeIds) {
      this.nodeGroups.get(id)?.classList.remove("wd-node--charged");
    }
  }

  /**
   * animates a node (and its connected lines) horizontally to the center of the map's Genesis
   * column, keeping its current y — used right as Phase 20's map backdrop appears, so the Need
   * visibly settles onto its starting evolution stage instead of just appearing there already
   * placed. Updates the node's stored position and respawns flow particles on lines touching it
   * afterward, so the particle flow keeps tracking the line's new path. A no-op if the node id
   * isn't registered (`onComplete` is not called in that case either).
   *
   * Registers its animation handle in `pendingSlides` so `runEvolutionDragStep` can cancel it the
   * instant a visitor actually grabs the node -- this animation runs on its own rAF loop, entirely
   * independent of a drag, so without cancellation a visitor who drags and releases quickly (while
   * this is still in flight) would see it keep overwriting their dropped position afterward,
   * snapping the node back toward Genesis right as they let go.
   */
  slideToGenesis(nodeId: string, durationMs = 700, onComplete?: () => void): void {
    const node = this.nodesById.get(nodeId);
    const nodeGroup = this.nodeGroups.get(nodeId);
    if (!node || !nodeGroup) return;

    this.pendingSlides.get(nodeId)?.();

    const connectedLines: ConnectedLine[] = this.lines
      .filter(({ conn }) => conn.from === nodeId || conn.to === nodeId)
      .map(({ conn, el }) => ({
        line: el,
        endpoint: conn.from === nodeId ? "from" : "to",
      }));

    const from = { x: node.x, y: node.y };
    const to = { x: genesisCenterX(this.viewBox.width), y: node.y };

    const handle = animateTo(
      from,
      to,
      durationMs,
      (point) => {
        setNodePosition(nodeGroup, connectedLines, point);
        this.updateFlowParticlePaths(nodeId, point);
      },
      () => {
        this.pendingSlides.delete(nodeId);
        node.x = to.x;
        this.setNodeStage(nodeId, "Genesis");
        onComplete?.();
      },
    );
    this.pendingSlides.set(nodeId, handle.cancel);
  }

  /** stops `slideToGenesis`'s in-flight animation for a node, if any, leaving it wherever it currently sits -- see `pendingSlides`' doc comment */
  private cancelPendingSlide(nodeId: string): void {
    this.pendingSlides.get(nodeId)?.();
    this.pendingSlides.delete(nodeId);
  }

  /**
   * wires Phase 20's evolution-axis interaction for an already-registered node: free horizontal
   * drag (no snap, no auto-commit) with live `onPositionChange(stageLabel)` callbacks. Flow
   * particles on the node's lines respawn to the new stage's look the instant the drag crosses a
   * stage boundary (see `setNodeStage` in the `onPositionChange` handler below), not just at
   * confirm. A returned `confirm()` the caller invokes once the visitor has committed to where
   * they dropped it — that stops the beckon pulse and fires a firework at its final position as
   * the "placement confirmed" cue. Doesn't re-add the "charged" glow `stopCharging` cleared going
   * into Phase 20 — it'd compete with the evolution-drag interaction.
   */
  runEvolutionDragStep(nodeId: string, options: EvolutionDragStepOptions = {}): EvolutionDragHandle {
    const node = this.nodesById.get(nodeId)!;
    const nodeGroup = this.nodeGroups.get(nodeId)!;

    // re-appending an already-attached child moves it to the end of nodeLayer's children, i.e. the
    // top of paint order among nodes — so whichever node is currently taking its turn on the
    // evolution axis always renders above every other node instead of being obstructed by one
    // already placed nearby (or one still waiting its turn, added later at mount).
    this.nodeLayer.appendChild(nodeGroup);

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
      onDragStart: () => this.cancelPendingSlide(nodeId),
      onPositionChange: (x) => {
        const stage = stageLabelAt(x, this.viewBox.width);
        options.onPositionChange?.(stage);
        // respawns flow particles the instant the node crosses a stage boundary mid-drag
        // (setNodeStage no-ops if the stage hasn't actually changed) instead of waiting for
        // confirm() — updateFlowParticlePaths below immediately re-paths any freshly spawned
        // particles to this in-flight x, since respawn draws from the node's stale stored position
        this.setNodeStage(nodeId, stage);
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
   * times (default 1). For flows (e.g. Phase 10's form sequence, or the Phase 20 finale) that
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
   * visible (Phase 30, one per concept the visitor digs into). Basic overlap avoidance: if the
   * callout would collide horizontally with one already placed, it stacks one tier higher instead
   * (see `createAnnotation`) rather than solving full layout — a node can end up with more than one
   * annotation if several concepts settle on it, so this stacking is load-bearing, not incidental.
   */
  addAnnotation(nodeId: string, text: string): void {
    const node = this.nodesById.get(nodeId)!;
    const { element, rect } = createAnnotation(node, text, this.annotationRects);
    this.annotationRects.push(rect);
    this.annotationLayer.appendChild(element);
  }

  private activateLines(): void {
    this.linesActive = true;
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
   * unset (Phase 0/10's fixed look) until that node has actually been placed on the evolution axis.
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
      // rolls a fresh random orbit shape on every drag-frame tick (no persisted per-particle
      // state) — a curved stage's particle will visibly jitter between wobbles while dragging,
      // which reads as fitting "unreliable supply" texture rather than as a bug. Whether the
      // particle completes its ride is rolled once at spawn (rollMissStopPercent), not here.
      const { orbitAmplitude, orbitCount } = flowParamsForStage(this.nodeStage.get(conn.to));
      const path = buildFlowParticlePath(from, to, { orbitAmplitude, orbitCount });
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

  /** true if a node with this id has already been registered (via the initial config or a later `addNode` call) — lets a caller (e.g. a phase that must render a node the current config might already include) avoid adding it twice */
  hasNode(nodeId: string): boolean {
    return this.nodesById.has(nodeId);
  }

  /**
   * every currently-registered node's circle, every rendered connection's line segment, and every
   * evolution-stage label chip (`.wd-backdrop-label-chip`, rendered by `showMapBackdrop` -- empty
   * before the map backdrop exists), all in the same container-pixel space `getNodePixelPosition`
   * uses — for a caller (the mascot's positioner) that needs to steer clear of the whole scene, not
   * just the one node it's anchored to. Nodes still mid-drag report their stored target position,
   * same caveat as `getNodePixelPosition`.
   */
  getObstacles(): { nodes: (Point & { radius: number })[]; edges: { a: Point; b: Point }[]; labels: Rect[] } {
    const nodes: (Point & { radius: number })[] = [];
    for (const id of this.nodesById.keys()) {
      const pos = this.getNodePixelPosition(id);
      if (pos) nodes.push(pos);
    }
    const edges: { a: Point; b: Point }[] = [];
    for (const { conn } of this.lines) {
      const from = this.getNodePixelPosition(conn.from);
      const to = this.getNodePixelPosition(conn.to);
      if (from && to) edges.push({ a: { x: from.x, y: from.y }, b: { x: to.x, y: to.y } });
    }
    return { nodes, edges, labels: this.getStageLabelRects() };
  }

  /** every evolution-stage label chip's bounding box, converted from its viewBox-space `x`/`y`/`width`/`height` attributes (set by `createMapBackdrop`) to container-pixel space -- empty before `showMapBackdrop` has rendered the backdrop */
  private getStageLabelRects(): Rect[] {
    const rects: Rect[] = [];
    this.backdropLayer.querySelectorAll<SVGRectElement>(".wd-backdrop-label-chip").forEach((chip) => {
      const x = Number(chip.getAttribute("x"));
      const y = Number(chip.getAttribute("y"));
      const width = Number(chip.getAttribute("width"));
      const height = Number(chip.getAttribute("height"));
      const topLeft = this.viewBoxToContainerPx(x, y);
      const bottomRight = this.viewBoxToContainerPx(x + width, y + height);
      rects.push({ left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y });
    });
    return rects;
  }

  /** current viewBox dimensions, in viewBox units — for a caller (e.g. a phase choosing a node-independent whitespace spot for the mascot) that needs to reason about the canvas's own bounds rather than any node's position */
  getViewBoxSize(): { width: number; height: number } {
    return { width: this.viewBox.width, height: this.viewBox.height };
  }

  /**
   * a registered node's raw viewBox-space position — unlike `getNodePixelPosition`, not converted
   * to container pixels. For a caller computing *new* node positions relative to an already-placed
   * one (e.g. Phase 5 spreading a row out from whichever capability a host's custom config already
   * rendered), since `addNode` takes viewBox coordinates, not pixels.
   */
  getNodePosition(nodeId: string): Point | null {
    const node = this.nodesById.get(nodeId);
    return node ? { x: node.x, y: node.y } : null;
  }

  /** a node's last-confirmed evolution stage (Phase 20's `runEvolutionDragStep`/`slideToGenesis`), if it's been placed on the evolution axis yet. */
  getNodeStage(nodeId: string): EvolutionStage | undefined {
    return this.nodeStage.get(nodeId);
  }

  /**
   * container-pixel position of an arbitrary viewBox coordinate, plus the standard node radius —
   * for anchoring UI (e.g. the mascot) to a draggable node's pre-drag `start` position, which
   * `getNodePixelPosition` can't give since it always reads a node's stored *target* x/y, not
   * wherever `start` rendered it before the first drag.
   */
  getViewBoxPixelPosition(x: number, y: number): Point & { radius: number } {
    const pos = this.viewBoxToContainerPx(x, y);
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

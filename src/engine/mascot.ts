import { Panel, type EvolutionKind, type PanelDragSlot, type PanelDragHandle, type PanelField } from "./panel";
import { createMascotAvatar, type MascotState } from "./mascotAvatar";
import type { WardleyDemo } from "./WardleyDemo";
import type { EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** how long the "talking" bob animation plays before the mascot settles back to idle */
const TALK_DURATION_MS = 600;

/** matches `.wardley-demo-root .wd-mascot-avatar`'s width in styles.ts, so the avatar can be centered under a node */
const AVATAR_WIDTH = 40;

/** matches `.wardley-demo-root .wd-mascot-avatar`'s height in styles.ts, used to keep the avatar itself
 * clear of the node without needing to measure it (it never changes size) */
const AVATAR_HEIGHT = 60;

/** minimum distance the speech-bubble tail is kept from the bubble's top/bottom corners, so it never
 * renders past the rounded border while tracking the avatar's real position */
const TAIL_MARGIN = 16;

/** vertical breathing room between a node's edge and the avatar planted below it */
const NODE_CLEARANCE = 12;

/** matches `.wd-mascot`'s `gap: 0.5rem` in styles.ts (at the browser's 16px default root font size) */
const BUBBLE_GAP = 8;

/** clearance on both axes for a `"northeast"` placement -- matches the gap phase0.ts already uses
 * for its own hand-rolled beside-the-node anchor */
const NORTHEAST_GAP = 32;

/**
 * `"auto"` is `reposition`'s default below/above-the-node behavior. `"northeast"` instead anchors
 * up and to the right of the node -- for anchors whose "below" spot would land on another row of
 * nodes underneath (this demo stacks several rows close together), NE clears it instead of
 * covering it. `"south"` forces the below side even when `reposition`'s overflow math would
 * otherwise flip to "above" -- for anchors with another row directly *above* them (e.g. a
 * Capability, sitting right under its Need), flipping up would plant the bubble on that row
 * instead of clearing it. Below-the-node is a safe floor for these since nothing else renders
 * underneath the bottom row; spilling past the canvas's bottom edge is an acceptable, secondary
 * trade-off (see `reposition`'s doc comment).
 */
export type MascotPlacement = "auto" | "northeast" | "south";

/**
 * the mascot's speech-bubble guide — the sole guide for the whole scenario, from the moment
 * it mounts (Phase 0's drag affordance) through the closing recap. Composes a `Panel` pointed
 * at a floating, node-anchored bubble instead of a fixed sidebar, so every render method below
 * is a thin delegation to that `Panel`, reusing its already-tested rendering logic (drag-handle/
 * form/instrument-panel/question/recap markup, `.wd-panel-form`/`.wd-next-link`/
 * `.wd-panel-question-option` classes) verbatim rather than reimplementing it — this also keeps
 * `src/dev/autopilot.ts`'s existing class-name selectors working unchanged against the bubble.
 *
 * `demo` is attached via `attachDemo` rather than passed to the constructor: Phase 0's drag step
 * needs the mascot's rendered drag-slot element to exist *before* `WardleyDemo.mount()` is called
 * (its constructor wires the drag step synchronously off `options.dragHandle`), so the mascot has
 * to mount and render before a `WardleyDemo` instance exists. `attachDemo` must be called before
 * any `moveTo`, since `trackAnchor` (the resize handler) depends on it.
 */
export class Mascot {
  private host: HTMLElement;
  private demo: WardleyDemo | null = null;
  private root: HTMLElement;
  private bubbleEl: HTMLElement;
  private panel: Panel;
  private avatar = createMascotAvatar();
  private avatarState: MascotState = "idle";
  private currentAnchorNodeId: string | null = null;
  private lastPos: { x: number; y: number; radius?: number } | null = null;
  private placement: MascotPlacement = "auto";
  private resizeHandler = (): void => this.trackAnchor();

  constructor(host: HTMLElement) {
    this.host = host;

    this.root = document.createElement("div");
    this.root.classList.add("wd-mascot");

    this.bubbleEl = document.createElement("div");
    this.bubbleEl.classList.add("wd-mascot-bubble");

    this.root.append(this.avatar.element, this.bubbleEl);
    this.panel = new Panel(this.bubbleEl);
  }

  /** wires up the `WardleyDemo` instance this mascot tracks — see the class doc comment for why this is separate from the constructor */
  attachDemo(demo: WardleyDemo): void {
    this.demo = demo;
  }

  /** appends the mascot into `host` and starts tracking window resizes for `moveTo`'s last node */
  mount(): void {
    this.host.appendChild(this.root);
    window.addEventListener("resize", this.resizeHandler);
  }

  /** removes the mascot and stops tracking resizes */
  unmount(): void {
    this.root.remove();
    window.removeEventListener("resize", this.resizeHandler);
  }

  /**
   * positions the bubble+avatar just below `pos` (container-pixel space, from
   * `WardleyDemo.getNodePixelPosition`), offset by `pos.radius` so the avatar is planted clear of
   * the node's circle instead of covering it, and remembers `nodeId` so a window resize re-tracks it.
   * `placement` defaults to `"auto"` (below/above); pass `"northeast"` for anchors whose "below"
   * spot would land on another row of nodes underneath -- see `MascotPlacement`.
   */
  moveTo(nodeId: string, pos: { x: number; y: number; radius?: number }, placement: MascotPlacement = "auto"): void {
    this.currentAnchorNodeId = nodeId;
    this.lastPos = pos;
    this.placement = placement;
    this.reposition();
  }

  /**
   * (re)computes the mascot's left/top from `lastPos`, then re-clamps the bubble — called by
   * `moveTo` and by every panel-content method below, since a content change (e.g. swapping in a
   * taller `showQuestion` panel) can push the bubble out of bounds just as much as the anchor
   * node moving can, and `lastPos` lets it redo that math without the caller re-supplying it.
   * No-ops the bounds math (but still sets left/top) when the host has no real layout yet (e.g.
   * unit tests) — same as this code always assumed before it was split out of `moveTo`.
   *
   * Picks one shared side -- below the node, or above it -- for *both* the avatar and the bubble,
   * based on whichever of the two (the small fixed-size avatar, or the bubble's actual measured
   * height) needs more room, so a tall panel can pull the whole group above the node instead of
   * only the bubble. This is the key invariant: `NODE_CLEARANCE` from the node's own circle is a
   * hard floor neither the avatar's nor the bubble's near edge ever crosses, even if that means
   * overflowing the *far* edge of the canvas -- a draggable node moves only horizontally at a
   * fixed y, so keeping the whole group's y-range off that node's row guarantees the bubble can
   * never end up in the node's path, regardless of where it's dragged along the axis. Canvas
   * containment is a secondary, best-effort concern the old code over-prioritized, which is what
   * let a tall bubble creep back up into the node's row when the canvas was short.
   */
  /**
   * a point `NORTHEAST_GAP` clear of the node's circle on both axes, clamped so the vertical
   * shift never lifts the point above the host's own top edge -- keeps nodes already near the
   * canvas top (e.g. the value chain's User row, which has no room above it) from being pushed
   * off-canvas; they degrade gracefully to a mostly-horizontal shift instead. Returns `radius: 0`
   * since the shift already bakes the node's own radius into the gap.
   */
  private northeastPoint(pos: { x: number; y: number; radius?: number }): { x: number; y: number; radius: number } {
    const radius = pos.radius ?? 0;
    return { x: pos.x + radius + NORTHEAST_GAP, y: Math.max(pos.y - radius - NORTHEAST_GAP, 0), radius: 0 };
  }

  private reposition(): void {
    if (!this.lastPos) return;
    const { x, y, radius } =
      this.placement === "northeast" ? this.northeastPoint(this.lastPos) : { x: this.lastPos.x, y: this.lastPos.y, radius: this.lastPos.radius ?? 0 };
    const hostRect = this.host.getBoundingClientRect();
    const bubbleHeight = this.bubbleEl.getBoundingClientRect().height;

    const clearBelow = y + radius + NODE_CLEARANCE; // top edge of the safe zone below the node
    const clearAbove = y - radius - NODE_CLEARANCE; // bottom edge of the safe zone above the node
    const groupHeight = Math.max(AVATAR_HEIGHT, bubbleHeight);

    let side: "below" | "above" = "below";
    if (this.placement !== "south" && hostRect.height) {
      const belowOverflow = Math.max(0, clearBelow + groupHeight - hostRect.height);
      const aboveOverflow = Math.max(0, groupHeight - clearAbove);
      if (aboveOverflow < belowOverflow) side = "above";
    }

    const avatarTop = side === "below" ? clearBelow : clearAbove - AVATAR_HEIGHT;

    this.root.style.left = `${x - AVATAR_WIDTH / 2}px`;
    this.root.style.top = `${avatarTop}px`;
    this.clampBubbleHorizontally(radius);
    this.positionBubbleVertically(side, avatarTop, clearBelow, clearAbove, bubbleHeight);
  }

  /**
   * shifts the speech bubble beside the avatar, preferring to keep it inside the mascot host's
   * bounds (the canvas) but never at the cost of sliding it back over the avatar itself. Only
   * ever shifts the bubble itself — flipping it to the avatar's left side when the right doesn't
   * have room — so the avatar (and the node it's anchored under) never moves. Uses `radius` (not
   * just the avatar's own width) for the gap from the node's center, so the bubble clears the
   * node's *full circle* horizontally — this is what keeps it from covering the node on the rare
   * occasion `reposition` above has to plant it at the node's own vertical level. When the bubble
   * is wider than the room available on *either* side (e.g. anchored dead-center under a narrow
   * grid), it still respects the clearance line and instead spills past the canvas's far edge —
   * same containment-is-secondary trade-off `reposition` makes vertically (see its doc comment).
   * No-ops when the host has no real layout yet (e.g. unit tests), same as `moveTo` already
   * assumes elsewhere.
   */
  private clampBubbleHorizontally(radius: number): void {
    const hostRect = this.host.getBoundingClientRect();
    if (!hostRect.width) return;

    const bubbleWidth = this.bubbleEl.getBoundingClientRect().width;
    if (!bubbleWidth) return;

    const avatarLeft = parseFloat(this.root.style.left) || 0;
    const nodeCenter = avatarLeft + AVATAR_WIDTH / 2;
    const clearance = Math.max(AVATAR_WIDTH / 2, radius) + BUBBLE_GAP;
    const naturalLeft = avatarLeft + AVATAR_WIDTH + BUBBLE_GAP; // unshifted flex position, used only to derive the CSS offset below
    const rightOfNode = nodeCenter + clearance;
    const leftOfNode = nodeCenter - clearance - bubbleWidth;

    const fitsRight = rightOfNode + bubbleWidth <= hostRect.width;
    const fitsLeft = leftOfNode >= 0;
    const flip = !fitsRight && fitsLeft;

    // `rightOfNode`/`leftOfNode` already bake in `clearance`, so they're the hard floor -- the
    // bubble's near edge must never cross back past them into the avatar, even if that means its
    // far edge spills past the canvas edge. Canvas containment is secondary, same trade-off
    // `reposition` makes vertically (see its doc comment) -- clamping to `hostRect.width` here
    // (as this used to) can pull a too-wide bubble back over the avatar it's supposed to clear.
    const targetLeft = flip ? leftOfNode : rightOfNode;

    this.bubbleEl.style.left = `${targetLeft - naturalLeft}px`;
    this.bubbleEl.classList.toggle("wd-mascot-bubble--flip", flip);
  }

  /**
   * plants the bubble's near edge on the *same* `clearBelow`/`clearAbove` line as the avatar (per
   * `reposition`'s shared `side` decision), so it grows away from the node in lockstep with the
   * avatar instead of independently drifting back toward it -- the bug this replaced. No-ops when
   * the host has no real layout yet, or the bubble hasn't rendered any measurable content yet
   * (e.g. unit tests), same as this code always assumed. Also points the speech-bubble tail (via
   * the `--wd-tail-top` custom property styles.ts reads) back at the avatar's real vertical
   * center, since a tall bubble growing upward can land avatar and bubble on different rows --
   * clamped away from the bubble's rounded corners so it always lands on the straight edge.
   */
  private positionBubbleVertically(
    side: "below" | "above",
    avatarTop: number,
    clearBelow: number,
    clearAbove: number,
    bubbleHeight: number,
  ): void {
    if (!bubbleHeight) return;

    const bubbleTop = side === "below" ? clearBelow : clearAbove - bubbleHeight;
    this.bubbleEl.style.top = `${bubbleTop - avatarTop}px`;

    const avatarCenter = avatarTop + AVATAR_HEIGHT / 2;
    const tailMargin = Math.min(TAIL_MARGIN, bubbleHeight / 2);
    const tailTop = Math.min(Math.max(avatarCenter - bubbleTop, tailMargin), bubbleHeight - tailMargin);
    this.bubbleEl.style.setProperty("--wd-tail-top", `${tailTop}px`);
  }

  setState(state: MascotState): void {
    this.avatarState = state;
    this.avatar.setState(state);
  }

  private trackAnchor(): void {
    if (!this.demo || !this.currentAnchorNodeId) return;
    const pos = this.demo.getNodePixelPosition(this.currentAnchorNodeId);
    if (pos) this.moveTo(this.currentAnchorNodeId, pos, this.placement);
  }

  /**
   * briefly plays the "talking" animation, then settles back to idle — unless something else
   * (e.g. a caller-triggered "celebrating") has already changed the state in the meantime, so a
   * `talk()` call never stomps on a later `setState` call.
   */
  private talk(delayMs = 0): void {
    const start = (): void => {
      this.setState("talking");
      setTimeout(() => {
        if (this.avatarState === "talking") this.setState("idle");
      }, TALK_DURATION_MS);
    };
    if (delayMs > 0) {
      setTimeout(start, delayMs);
    } else {
      start();
    }
  }

  showDragHandles(slots: PanelDragSlot[], intro?: { heading: string; subheading: string }): PanelDragHandle {
    this.talk();
    const handle = this.panel.showDragHandles(slots, intro);
    this.reposition();
    return handle;
  }

  showField(field: PanelField): Promise<string> {
    this.talk();
    const result = this.panel.showField(field);
    this.reposition();
    return result;
  }

  showInstrumentPanel(heading: string, kind: EvolutionKind, initialStage: EvolutionStage, delayMs = 0): void {
    this.talk(delayMs);
    this.panel.showInstrumentPanel(heading, kind, initialStage, delayMs);
    this.reposition();
  }

  updateInstrumentPanel(stage: EvolutionStage): void {
    this.panel.updateInstrumentPanel(stage);
    this.reposition();
  }

  confirmPlacement(label = "Confirm placement"): Promise<void> {
    const result = this.panel.confirmPlacement(label);
    this.reposition();
    return result;
  }

  showQuestion(heading: string, question: Question, options?: { onReroll?: () => Question }): Promise<QuestionOption> {
    this.talk();
    const result = this.panel.showQuestion(heading, question, options);
    this.reposition();
    return result;
  }

  showRecap(items: string[], cta: { label: string; href: string }): void {
    this.talk();
    this.panel.showRecap(items, cta);
    this.reposition();
  }

  showEmpty(): void {
    this.panel.showEmpty();
    this.reposition();
  }

  showPlaceholder(heading: string, subheading: string, delayMs = 0): void {
    this.talk(delayMs);
    this.panel.showPlaceholder(heading, subheading, delayMs);
    this.reposition();
  }
}

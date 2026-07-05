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

/** clearance from the node's own circle for a `"northeast"` or `"east"` placement -- the one
 * source of truth for "how far beside a node the mascot sits", so callers never need their own
 * copy of this gap */
const SIDE_GAP = 32;

/** clearance from the host's own top/right edges for `moveToTopRight` -- keeps the avatar off the
 * canvas border while still reading as "the corner" */
const CORNER_MARGIN = 64;

/**
 * Two independent axes, not four hand-picked directions: *does the anchor shift before the
 * below/above pick runs*, and *is that pick measured or forced*. Getting this wrong (forcing a
 * side, or shifting sideways, for the wrong kind of row) is what actually caused the bugs this
 * type used to produce -- see git history on this file.
 *
 * `"auto"`: no shift, and a *measured* below/above pick (whichever side has less real overflow
 * against the host's actual bounds). Right for a node with no row of *side-by-side siblings*
 * squeezed in beside it -- `moveToTopRight`'s corner, a lone capability once the map has settled,
 * or the last of several capabilities once the whole row is already laid out (nothing further
 * right to walk into).
 *
 * `"northeast"`: shifts the anchor up-and-right first, *then* the same measured pick -- for
 * anchoring beside a node that has *other rows* stacked close above or below it (this demo stacks
 * several close together), so the mascot reads as "pointing at" the node rather than sitting on
 * top of whichever row is closest. Wrong for a node with side-by-side siblings in its *own* row
 * (e.g. one of several Capability nodes) -- the rightward shift has nowhere to go but into the
 * next sibling, regardless of which vertical side gets picked.
 *
 * `"south"`: no shift, but *forces* "below" -- for anchoring beside one of several side-by-side
 * siblings that has another row directly above it and nothing below (a Capability node, with its
 * Need above): the measured pick can occasionally still choose "above" here (a tall canvas can
 * make "below" *look* like the worse overflow even though nothing is actually there), so this
 * removes that measurement entirely rather than let it gamble on the one row that's never safe.
 *
 * `"pinned"`: `"northeast"`'s stricter sibling, for a node that will itself be dragged *along* its
 * own row afterward while the mascot stays put (the evolution axis, `WardleyDemo.
 * runEvolutionDragStep`). Forcing "above" isn't a hard-enough guarantee there on its own -- a
 * tight row can still leave the group dipping back into the node's path even once forced above --
 * so `"pinned"` additionally verifies real, unclipped room exists before committing to that spot,
 * and falls back to the same out-of-the-way corner `moveToTopRight` uses when it doesn't -- see
 * `reposition`'s `pinned` branch.
 */
export type MascotPlacement = "auto" | "northeast" | "south" | "pinned";

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
  private anchoredToCorner = false;
  private viewBoxAnchor: { x: number; y: number } | null = null;
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
    this.anchoredToCorner = false;
    this.viewBoxAnchor = null;
    this.lastPos = pos;
    this.placement = placement;
    this.reposition();
    this.scrollIntoViewIfNeeded();
  }

  /**
   * plants the mascot at an arbitrary point in the canvas's open whitespace, not anchored to any
   * node — e.g. Phase 7's "stepping back" beat, where the mascot introduces itself away from the
   * value chain rather than beside one of its nodes. `x`/`y` are viewBox coordinates (the same
   * space `WardleyDemo.addNode` takes), converted via `demo.getViewBoxPixelPosition` and re-derived
   * from those same coordinates on resize (`trackAnchor`), unlike `moveToTopRight`'s host-relative
   * corner or `moveTo`'s node-id tracking. A no-op if `attachDemo` hasn't run yet.
   */
  moveToViewBoxPoint(x: number, y: number, placement: MascotPlacement = "auto"): void {
    if (!this.demo) return;
    this.currentAnchorNodeId = null;
    this.anchoredToCorner = false;
    this.viewBoxAnchor = { x, y };
    this.lastPos = this.demo.getViewBoxPixelPosition(x, y);
    this.placement = placement;
    this.reposition();
    this.scrollIntoViewIfNeeded();
  }

  /**
   * plants the mascot in the host's top-right corner, clear of any node -- used once the map is
   * fully placed (see `phase20.ts`'s closing "All placed!" beat) so the mascot stops anchoring
   * beside whichever node it last visited and steps out of the way of the finished map instead.
   * Unlike `moveTo`, tracked on resize independent of any node id (there is none here), via
   * `anchoredToCorner`.
   */
  moveToTopRight(): void {
    this.currentAnchorNodeId = null;
    this.anchoredToCorner = true;
    this.viewBoxAnchor = null;
    this.lastPos = this.topRightPoint();
    this.placement = "auto";
    this.reposition();
    this.scrollIntoViewIfNeeded();
  }

  /**
   * brings the mascot into the current viewport whenever it re-anchors to a (possibly distant)
   * node -- e.g. jumping back up to the User node after the visitor scrolled down to drag the Need
   * or inspect the Capability row. `reposition`'s own math keeps the group on the *page*, but
   * nothing scrolls the page itself, so a re-anchor to a spot above wherever the visitor happens to
   * be scrolled to would otherwise just look like the mascot vanished off-screen.
   *
   * Scrolls by the union of the avatar's and bubble's own rects, not `this.root.scrollIntoView()`
   * -- `.wd-mascot-bubble` is `position: relative` with a `top` offset that plants it along
   * `reposition`'s `clearAbove`/`clearBelow` line, which can shift it well above or below `.wd-
   * mascot`'s own flex-box (the `<img>` avatar plus the bubble's *unshifted* flow position); a
   * relative offset doesn't grow its parent's `getBoundingClientRect()` to match, so scrolling
   * `.wd-mascot` into view left the actual (shifted) bubble still cropped. A no-op when already
   * fully on-screen, so this never yanks the scroll position during the common case of anchoring
   * to a node already in view. Instant (not smooth) -- verified against a real headless run that
   * `behavior: "smooth"` silently never completes the scroll here.
   */
  private scrollIntoViewIfNeeded(): void {
    const avatarRect = this.avatar.element.getBoundingClientRect();
    const bubbleRect = this.bubbleEl.getBoundingClientRect();
    const top = Math.min(avatarRect.top, bubbleRect.top);
    const bottom = Math.max(avatarRect.bottom, bubbleRect.bottom);
    const viewportHeight = window.innerHeight;
    if (!viewportHeight) return;

    if (top < 0) {
      window.scrollBy({ top, behavior: "auto" });
    } else if (bottom > viewportHeight) {
      window.scrollBy({ top: Math.min(bottom - viewportHeight, top), behavior: "auto" });
    }
  }

  /** the host's top-right corner, inset by `CORNER_MARGIN` on both axes, in container-pixel space -- `radius: 0` since there's no node to clear */
  private topRightPoint(): { x: number; y: number; radius: number } {
    const hostRect = this.host.getBoundingClientRect();
    return { x: Math.max(hostRect.width - CORNER_MARGIN, 0), y: CORNER_MARGIN, radius: 0 };
  }

  /**
   * a point `SIDE_GAP` clear of the node's circle on both axes, clamped so the vertical shift
   * never lifts the point above the host's own top edge -- keeps nodes already near the canvas
   * top (e.g. the value chain's User row, which has no room above it) from being pushed
   * off-canvas; they degrade gracefully to a mostly-horizontal shift instead (see `reposition`'s
   * `clamped` handling below). Returns `radius: 0` since the shift already bakes the node's own
   * radius into the gap, and `clamped: true` when the vertical shift hit that floor -- i.e. there
   * was no real room above the node to begin with.
   */
  private northeastPoint(pos: { x: number; y: number; radius?: number }): { x: number; y: number; radius: number; clamped: boolean } {
    const radius = pos.radius ?? 0;
    const rawY = pos.y - radius - SIDE_GAP;
    return { x: pos.x + radius + SIDE_GAP, y: Math.max(rawY, 0), radius: 0, clamped: rawY < 0 };
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
   * let a tall bubble creep back up into the node's row when the canvas was short. `"pinned"`
   * strengthens this further still, for the one case where even that isn't enough -- see its own
   * comment below.
   */
  private reposition(): void {
    if (!this.lastPos) return;
    const shiftsSideways = this.placement === "northeast" || this.placement === "pinned";
    const shifted = shiftsSideways ? this.northeastPoint(this.lastPos) : null;
    let { x, y, radius } = shifted ?? { x: this.lastPos.x, y: this.lastPos.y, radius: this.lastPos.radius ?? 0 };
    const hostRect = this.host.getBoundingClientRect();
    const bubbleHeight = this.bubbleEl.getBoundingClientRect().height;
    const groupHeight = Math.max(AVATAR_HEIGHT, bubbleHeight);

    // "pinned" exists for a node that will itself be dragged along its own row afterward (the
    // evolution axis) while the mascot stays put -- forcing "above" further down still isn't a
    // hard guarantee on its own, since a tight row can leave the group dipping back into the
    // node's path even once forced there (see `effectiveClearAbove`'s floor below). So this
    // verifies *real*, unclipped room exists above the shifted anchor before ever committing to
    // "above" -- past the host's own document position, not just past y=0 -- and falls back to
    // the same out-of-the-way corner `moveToTopRight` uses when it doesn't, rather than planting
    // the group somewhere the node's drag can still reach, or half off the page. That corner isn't
    // a *perfect* guarantee either -- a row stacked this close to the canvas's own top edge (the
    // very reason the "real room" check above failed) leaves little vertical gap between the
    // corner and the row, so a node dragged far enough toward that corner's *side* of the axis can
    // still brush the bubble with its own (large) radius. The alternative -- anchoring below the
    // row instead of in the corner -- was tried and rejected: it immediately collides with
    // whatever row sits underneath (e.g. the Capability row just below Need's), trading one
    // guaranteed overlap for another. Same "spilling is an acceptable, secondary trade-off"
    // philosophy as `reposition`'s canvas-containment comments elsewhere in this file.
    let forcePinnedAbove = false;
    if (this.placement === "pinned" && shifted && !shifted.clamped) {
      const clearAbove = y - NODE_CLEARANCE; // shifted.radius is always 0
      const hostDocTop = hostRect.top + window.scrollY;
      const hasRealRoom = !Number.isFinite(hostDocTop) || clearAbove - groupHeight >= -hostDocTop;
      if (hasRealRoom) {
        forcePinnedAbove = true;
      } else {
        const corner = this.topRightPoint();
        x = corner.x;
        y = corner.y;
        radius = 0;
      }
    }

    const clearBelow = y + radius + NODE_CLEARANCE; // top edge of the safe zone below the node
    const clearAbove = y - radius - NODE_CLEARANCE; // bottom edge of the safe zone above the node

    // "auto" and "northeast" pick whichever side actually has less overflow, measured against the
    // host's real bounds, rather than a per-call-site guess. "south" forces "below" instead --
    // for a node with side-by-side siblings and only a row *above* it to avoid, the measured pick
    // can occasionally still gamble on "above" (a tall canvas can make "below" look like the
    // worse overflow even with nothing actually there), which this removes entirely.
    let side: "below" | "above" = "below";
    if (forcePinnedAbove) {
      side = "above";
    } else if (this.placement !== "south" && hostRect.height) {
      const belowOverflow = Math.max(0, clearBelow + groupHeight - hostRect.height);
      const aboveOverflow = Math.max(0, groupHeight - clearAbove);
      if (aboveOverflow < belowOverflow) side = "above";
    }

    // even when a node genuinely has *some* clearance above it, that clearance can still be
    // shorter than `groupHeight` -- e.g. a node just far enough from the canvas top to look
    // "clear", paired with a tall multi-line bubble. Host-local overflow past *its own* origin is
    // normally fine (a host embedded with headroom above it -- `.wd-canvas`'s margin in
    // index.html, a hero section's padding in preview.html -- can absorb it harmlessly), but past
    // the actual *page's* top edge there's nothing left to scroll to. Floor `clearAbove` at
    // whatever keeps the group's top on the page, using the host's real document-relative
    // position -- skipped when that isn't measurable (unit tests mock the host's rect without a
    // real `top`), same as the rest of this method already no-ops without real layout.
    let effectiveClearAbove = clearAbove;
    if (side === "above") {
      const hostDocTop = hostRect.top + window.scrollY;
      if (Number.isFinite(hostDocTop)) {
        effectiveClearAbove = Math.max(clearAbove, groupHeight - hostDocTop);
      }
    }

    const avatarTop = side === "below" ? clearBelow : effectiveClearAbove - AVATAR_HEIGHT;

    this.root.style.left = `${x - AVATAR_WIDTH / 2}px`;
    this.root.style.top = `${avatarTop}px`;
    this.clampBubbleHorizontally(radius);
    this.positionBubbleVertically(side, avatarTop, clearBelow, effectiveClearAbove, bubbleHeight);
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
    if (this.anchoredToCorner) {
      this.moveToTopRight();
      return;
    }
    if (this.viewBoxAnchor) {
      if (!this.demo) return;
      this.lastPos = this.demo.getViewBoxPixelPosition(this.viewBoxAnchor.x, this.viewBoxAnchor.y);
      this.reposition();
      return;
    }
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

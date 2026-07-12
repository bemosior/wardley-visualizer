import { Panel, type EvolutionKind, type Finding, type GateOption, type PanelDragSlot, type PanelDragHandle, type PanelField } from "./panel";
import { createMascotAvatar, type MascotState } from "./mascotAvatar";
import { showNextLink } from "./nextLink";
import { prefersReducedMotion } from "./animate";
import { shiftRect } from "./geometry";
import { DIRECTION_PRIORITY, pickMascotPlacement, type CompassDirection } from "./mascotPlacement";
import { createFireworkShells, FIREWORK_CLEANUP_MS } from "./render";
import type { WardleyDemo } from "./WardleyDemo";
import type { EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** how long the "talking" bob animation plays before the mascot settles back to idle */
const TALK_DURATION_MS = 600;

/** how long the mascot's one-time first-appearance "arrival" flourish (`arrive()`) holds before
 * settling back to idle -- long enough for the pop-in (0.48s) plus the reused celebrate bounce
 * (0.28s delay + 0.8s) to finish, ~1.08s, without hard-cutting its tail */
const ARRIVE_DURATION_MS = 1100;

/** delay (ms) before `arrive()` spawns its firework burst -- timed to land at `wd-mascot-arrive`'s
 * 55% overshoot peak (0.55 * 0.48s) rather than the first frame of the pop-in */
const ARRIVE_FIREWORK_DELAY_MS = 260;

/** matches `.wardley-demo-root .wd-mascot-avatar`'s width in styles.ts, so the avatar can be centered under a node */
const AVATAR_WIDTH = 40;

/** matches `.wardley-demo-root .wd-mascot-avatar`'s height in styles.ts, used to keep the avatar itself
 * clear of the node without needing to measure it (it never changes size) */
const AVATAR_HEIGHT = 60;

/** vertical breathing room between a node's edge and the avatar planted below/above it */
const NODE_CLEARANCE = 12;

/** matches `.wd-mascot-caption`'s gap from the avatar in styles.ts */
const CAPTION_GAP = 8;

/** dev guard on `say()`'s caption text -- routing between the small caption and the big dialog
 * panel is decided by *which method a phase calls*, not by measuring rendered text; this just
 * catches an author accidentally cramming panel-length prose into the one-line caption. A
 * console warning, not a thrown error, since a slightly-long caption still renders fine (it just
 * wraps to a second line) -- this is a nudge, not a hard contract. */
const CAPTION_MAX_CHARS = 80;

/** shown in the avatar's caption whenever a panel-hosted ("big") method renders, so the visitor's
 * attention follows the mascot down to the dialog panel instead of the caption going stale */
const POINT_TO_PANEL_TEXT = "Take a look below. ↓";

/**
 * the mascot's guide presence -- a small avatar that tracks whichever node it's discussing, and
 * two places it can say something: a short single-line **caption** right beside the avatar (for
 * brief narrative beats and simple confirmations, via `say()`), or the permanent **dialog panel**
 * below the canvas (for anything structural -- forms, multi-option questions, live readouts,
 * findings, recap -- via the `showX` methods below, each a thin delegation to the composed
 * `Panel`). The split exists so the dialog can never cover the map/value-chain: the panel is a
 * fixed region in the page's own flow, not a bubble anchored over the canvas, so there's no
 * geometry to fight to keep it clear of nodes. Every panel-hosted method also points the avatar's
 * caption at the panel (`pointToPanel`) so the visitor's attention follows it down there.
 *
 * `confirmPlacement` is the single "advance" mechanism for both surfaces: it appends a confirm
 * control to whichever one most recently rendered content (`activeSurface`), so `say(text)` +
 * `await confirmPlacement(label)` reads exactly like a panel method + `await confirmPlacement`
 * pair -- and calling `say()` more than once in a row, each gated behind its own
 * `confirmPlacement`, is the intended way to deliver a short multi-beat exchange (two or three
 * quick lines) without escalating to the panel.
 *
 * `demo` is attached via `attachDemo` rather than passed to the constructor: Phase 0's drag step
 * needs the mascot's rendered drag-slot element to exist *before* `WardleyDemo.mount()` is called
 * (its constructor wires the drag step synchronously off `options.dragHandle`), so the mascot has
 * to mount and render before a `WardleyDemo` instance exists. `attachDemo` must be called before
 * any `moveTo`, since `trackAnchor` (the resize handler) depends on it.
 */
export class Mascot {
  private avatarHost: HTMLElement;
  private dialogHost: HTMLElement;
  private demo: WardleyDemo | null = null;
  private avatarRoot: HTMLElement;
  private captionEl: HTMLElement;
  private captionTextEl: HTMLElement;
  private captionActionEl: HTMLElement;
  private dialogEl: HTMLElement;
  private panel: Panel;
  private avatar = createMascotAvatar();
  private avatarState: MascotState = "idle";
  private currentAnchorNodeId: string | null = null;
  private viewBoxAnchor: { x: number; y: number } | null = null;
  private lastPos: { x: number; y: number; radius?: number } | null = null;
  /** the avatar's center in `avatarHost`-local pixel space, set by `reposition()` -- lets `arrive()`
   * spawn its firework burst at wherever the avatar actually landed without recomputing that math
   * itself. Null until the first `reposition()` call (e.g. `arrive()` invoked with no prior `moveTo`). */
  private lastAvatarCenter: { x: number; y: number } | null = null;
  /** which compass directions `reposition` may consider -- see `moveTo`'s `directions` option */
  private lastDirections: CompassDirection[] = DIRECTION_PRIORITY;
  private hasPositioned = false;
  /** which surface last rendered content -- `confirmPlacement` targets whichever one this is */
  private activeSurface: "caption" | "panel" = "caption";
  private resizeHandler = (): void => this.trackAnchor();

  /**
   * `avatarHost` must be a child of the same element passed to `WardleyDemo.mount` as its
   * container, sized to cover it -- see `.wd-mascot-avatar-host`'s doc comment in styles.ts for
   * why (the avatar's positioning math is measured relative to that container's own top-left
   * corner). `dialogHost` has no such requirement -- it's a plain page-flow element the dialog
   * panel renders into, anywhere in the layout (today, a sibling strip below the canvas).
   */
  constructor(avatarHost: HTMLElement, dialogHost: HTMLElement) {
    this.avatarHost = avatarHost;
    this.dialogHost = dialogHost;

    this.avatarRoot = document.createElement("div");
    this.avatarRoot.classList.add("wd-mascot");
    // hides the caption (`wd-mascot--arriving` in styles.ts) from the moment it exists, before
    // `mount`/`moveTo`/`say` ever insert or position it -- see `arrive`'s doc comment for why.
    this.avatarRoot.classList.add("wd-mascot--arriving");

    this.captionTextEl = document.createElement("span");
    this.captionTextEl.classList.add("wd-mascot-caption-text");
    this.captionActionEl = document.createElement("span");
    this.captionActionEl.classList.add("wd-mascot-caption-action");
    this.captionEl = document.createElement("div");
    this.captionEl.classList.add("wd-mascot-caption");
    this.captionEl.append(this.captionTextEl, this.captionActionEl);

    this.avatarRoot.append(this.avatar.element, this.captionEl);

    this.dialogEl = document.createElement("div");
    this.dialogEl.classList.add("wd-mascot-dialog", "wd-mascot-dialog--arriving");
    this.panel = new Panel(this.dialogEl);
  }

  /** wires up the `WardleyDemo` instance this mascot tracks — see the class doc comment for why this is separate from the constructor */
  attachDemo(demo: WardleyDemo): void {
    this.demo = demo;
  }

  /** appends the avatar into `avatarHost` and the dialog panel into `dialogHost`, and starts tracking window resizes for `moveTo`'s last node */
  mount(): void {
    this.avatarHost.appendChild(this.avatarRoot);
    this.dialogHost.appendChild(this.dialogEl);
    window.addEventListener("resize", this.resizeHandler);
  }

  /** removes the mascot and stops tracking resizes */
  unmount(): void {
    this.avatarRoot.remove();
    this.dialogEl.remove();
    window.removeEventListener("resize", this.resizeHandler);
  }

  /**
   * plays a one-time "arrival" flourish the moment the mascot first appears (Phase 0, right after
   * the Need snaps into place): a springy overshoot pop-in plus the same celebratory bounce/glow
   * `setState("celebrating")` uses elsewhere, topped off with a firework burst (the same
   * `createFireworkShells` used for node-snap/evolution-confirm celebrations elsewhere) landing at
   * the pop-in's overshoot peak, so the mascot's own entrance gets the same reward treatment as the
   * scenario's other milestones. Both the caption and the dialog panel stay hidden
   * (`wd-mascot--arriving`/`wd-mascot-dialog--arriving`, added in the constructor) for the same
   * span -- whichever surface the caller's first content lands on, it shouldn't flash into view
   * before the flourish finishes. `reveal`, if passed, is invoked right as the flourish ends --
   * *before* the hiding classes are removed -- so it's the one place to set that first content
   * (e.g. `say(...)`) and have it already sitting in the DOM the instant it becomes visible,
   * rather than the caller setting it themselves a statement later and leaving an empty box to
   * flash first. Skips straight to idle (still invoking `reveal` and unhiding immediately, just
   * with no transition, no firework) with no delay under `prefers-reduced-motion`, same as
   * `animateTo`.
   */
  async arrive(reveal?: () => void): Promise<void> {
    if (prefersReducedMotion()) {
      this.setState("idle");
      reveal?.();
      this.avatarRoot.classList.remove("wd-mascot--arriving");
      this.dialogEl.classList.remove("wd-mascot-dialog--arriving");
      return;
    }
    this.setState("celebrating");
    this.fireworkAtAvatar();
    await new Promise<void>((resolve) => setTimeout(resolve, ARRIVE_DURATION_MS));
    this.setState("idle");
    reveal?.();
    this.avatarRoot.classList.remove("wd-mascot--arriving");
    this.dialogEl.classList.remove("wd-mascot-dialog--arriving");
  }

  /**
   * spawns `arrive()`'s firework burst at wherever the avatar last landed (`lastAvatarCenter`,
   * `avatarHost`-local pixel space -- already the right coordinate space for `createFireworkShells`
   * since `avatarHost` and `WardleyDemo`'s own container share the same pixel origin, same as
   * `reposition`'s own `avatarRect` math). No-op if `reposition()` has never run (e.g. `arrive()`
   * called without a prior `moveTo`, as some unit tests do) -- nothing to burst at yet.
   */
  private fireworkAtAvatar(): void {
    const center = this.lastAvatarCenter;
    if (!center) return;
    setTimeout(() => {
      const shells = createFireworkShells(center.x, center.y);
      for (const shell of shells) this.avatarHost.appendChild(shell);
      setTimeout(() => {
        for (const shell of shells) shell.remove();
      }, FIREWORK_CLEANUP_MS);
    }, ARRIVE_FIREWORK_DELAY_MS);
  }

  /**
   * positions the avatar just below (or above, if there's no room) `pos` (container-pixel space,
   * from `WardleyDemo.getNodePixelPosition`), offset by `pos.radius` so it's planted clear of the
   * node's circle instead of covering it, and remembers `nodeId` so a window resize re-tracks it.
   *
   * `directions`, if given, narrows which compass directions `reposition` may choose among instead
   * of the full 8 (`NON_ROW_DIRECTIONS`, e.g., for Phase 20's evolution-axis anchors, which must
   * never sit beside the node -- it's about to slide freely through that exact spot). Persists
   * across the window-resize re-anchor (`trackAnchor`) until the next explicit `moveTo`/
   * `moveToViewBoxPoint` call resets it.
   */
  moveTo(nodeId: string, pos: { x: number; y: number; radius?: number }, directions: CompassDirection[] = DIRECTION_PRIORITY): void {
    this.currentAnchorNodeId = nodeId;
    this.viewBoxAnchor = null;
    this.lastPos = pos;
    this.lastDirections = directions;
    this.reposition();
    this.scrollIntoViewIfNeeded();
  }

  /**
   * plants the mascot at an arbitrary point in the canvas's open whitespace, not anchored to any
   * node — e.g. Phase 7's "stepping back" beat, where the mascot introduces itself away from the
   * value chain rather than beside one of its nodes. `x`/`y` are viewBox coordinates (the same
   * space `WardleyDemo.addNode` takes), converted via `demo.getViewBoxPixelPosition` and re-derived
   * from those same coordinates on resize (`trackAnchor`). A no-op if `attachDemo` hasn't run yet.
   */
  moveToViewBoxPoint(x: number, y: number): void {
    if (!this.demo) return;
    this.currentAnchorNodeId = null;
    this.viewBoxAnchor = { x, y };
    this.lastPos = this.demo.getViewBoxPixelPosition(x, y);
    this.lastDirections = DIRECTION_PRIORITY;
    this.reposition();
    this.scrollIntoViewIfNeeded();
  }

  /**
   * brings the mascot into the current viewport whenever it re-anchors to a (possibly distant)
   * node -- `reposition`'s own math keeps the group on the *page*, but nothing scrolls the page
   * itself, so a re-anchor to a spot above wherever the visitor happens to be scrolled to would
   * otherwise just look like the mascot vanished off-screen. Instant (not smooth) -- verified
   * against a real headless run that `behavior: "smooth"` silently never completes the scroll here.
   */
  private scrollIntoViewIfNeeded(): void {
    const rect = this.avatarRoot.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (!viewportHeight) return;

    if (rect.top < 0) {
      window.scrollBy({ top: rect.top, behavior: "auto" });
    } else if (rect.bottom > viewportHeight) {
      window.scrollBy({ top: Math.min(rect.bottom - viewportHeight, rect.top), behavior: "auto" });
    }
  }

  /**
   * (re)computes the avatar's (and caption's) position from `lastPos` by searching every compass
   * direction around the anchor -- see `pickMascotPlacement` for the full scoring rules. In short:
   * never overlap a node (any node, not just the one anchored to), avoid crossing an edge unless
   * every direction does, avoid spilling outside the host, and otherwise prefer the most natural
   * reading order (below, then above, then beside). Obstacle data comes from `this.demo`; without
   * one attached (e.g. unit tests that never call `attachDemo`), the search still runs but sees an
   * empty scene, so it just falls back to the direction-priority/overflow tie-break.
   */
  private reposition(): void {
    if (!this.lastPos) return;
    const anchor = { x: this.lastPos.x, y: this.lastPos.y, radius: this.lastPos.radius ?? 0 };
    const hostRect = this.avatarHost.getBoundingClientRect();
    const bounds = hostRect.width && hostRect.height ? { width: hostRect.width, height: hostRect.height } : null;
    const obstacles = this.demo?.getObstacles() ?? { nodes: [], edges: [] };
    const captionSize = this.measureCaption();

    const placement = pickMascotPlacement(
      anchor,
      { width: AVATAR_WIDTH, height: AVATAR_HEIGHT },
      captionSize,
      obstacles,
      bounds,
      CAPTION_GAP,
      NODE_CLEARANCE,
      this.lastDirections,
    );
    let { avatarRect, captionRect } = placement;

    // host-local overflow past the host's own origin is normally fine (a host embedded with
    // headroom above it can absorb it harmlessly), but past the actual page's top edge there's
    // nothing left to scroll to -- shift the whole placement down by whatever it takes to keep the
    // avatar's top on the page. Skipped when that isn't measurable (unit tests mock the host's rect
    // without a real `top`).
    const hostDocTop = hostRect.top + window.scrollY;
    if (Number.isFinite(hostDocTop)) {
      const deficit = -(avatarRect.top + hostDocTop);
      if (deficit > 0) {
        avatarRect = shiftRect(avatarRect, 0, deficit);
        if (captionRect) captionRect = shiftRect(captionRect, 0, deficit);
      }
    }

    // `.wd-mascot`'s CSS gives it a resting `top: 0; left: 0` (styles.ts) plus a `left`/`top`
    // transition meant for *later* re-anchors (e.g. jumping between nodes). Without this guard,
    // the very first `reposition` after `mount` would animate from that CSS resting position to
    // the real spawn point -- the mascot visibly appearing top-left of the host and sliding into
    // place instead of just appearing there. Suppressing the transition only for that first call
    // (then forcing a reflow so the browser commits "no transition" before re-enabling it next
    // frame) keeps every later re-anchor animated as intended.
    const isFirstPosition = !this.hasPositioned;
    if (isFirstPosition) this.avatarRoot.style.transition = "none";
    this.avatarRoot.style.left = `${avatarRect.left}px`;
    this.avatarRoot.style.top = `${avatarRect.top}px`;
    this.lastAvatarCenter = { x: avatarRect.left + AVATAR_WIDTH / 2, y: avatarRect.top + AVATAR_HEIGHT / 2 };
    if (isFirstPosition) {
      this.hasPositioned = true;
      void this.avatarRoot.offsetHeight;
      requestAnimationFrame(() => {
        this.avatarRoot.style.transition = "";
      });
    }
    this.captionEl.classList.toggle("wd-mascot-caption--flip", placement.flip);
  }

  /** the caption's real rendered size, independent of which side it's currently drawn on (its CSS width is `max-content` capped by `max-width`, never a function of its own `left`/`right`) -- null before any text/content has been set, so callers can skip caption-avoidance entirely rather than scoring against a phantom 0x0 box */
  private measureCaption(): { width: number; height: number } | null {
    const rect = this.captionEl.getBoundingClientRect();
    return rect.width && rect.height ? { width: rect.width, height: rect.height } : null;
  }

  setState(state: MascotState): void {
    this.avatarState = state;
    this.avatar.setState(state);
  }

  private trackAnchor(): void {
    if (this.viewBoxAnchor) {
      if (!this.demo) return;
      this.lastPos = this.demo.getViewBoxPixelPosition(this.viewBoxAnchor.x, this.viewBoxAnchor.y);
      this.reposition();
      return;
    }
    if (!this.demo || !this.currentAnchorNodeId) return;
    const pos = this.demo.getNodePixelPosition(this.currentAnchorNodeId);
    // updates lastPos and re-derives placement directly, rather than going through the public
    // `moveTo` (which would reset `lastDirections` to the full 8-direction default and silently
    // drop a Phase-20-style row restriction if the visitor resizes mid-drag)
    if (pos) {
      this.lastPos = pos;
      this.reposition();
    }
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

  /**
   * sets the avatar's small caption -- for brief, single-line narrative beats that don't need the
   * full dialog panel (a short "This is a Need." aside, not a form or a multi-option question).
   * Gate progression the same way every panel-hosted method below does: a separate `await
   * mascot.confirmPlacement(label)` appends a confirm control right after this text, since
   * `confirmPlacement` always targets whichever surface most recently rendered. Calling `say()`
   * more than once in a row (each gated behind its own `confirmPlacement`) is the intended way to
   * deliver a short multi-beat exchange without escalating to the panel.
   */
  say(text: string): void {
    if (text.length > CAPTION_MAX_CHARS) {
      console.warn(
        `Mascot.say: caption text is ${text.length} chars, over the ${CAPTION_MAX_CHARS}-char guard for the ` +
          `small caption -- consider splitting into two say() calls, or using a panel method instead: "${text}"`,
      );
    }
    this.talk();
    // clears any lingering dialog-panel content (e.g. a form/gate from the previous beat) --
    // otherwise switching to a brief caption would leave a stale, orphaned panel behind instead
    // of the empty space this beat doesn't need.
    if (this.activeSurface === "panel") this.panel.showEmpty();
    this.activeSurface = "caption";
    this.captionEl.classList.remove("wd-mascot-caption--hidden");
    this.captionTextEl.textContent = text;
    this.captionActionEl.replaceChildren();
    this.reposition();
  }

  /**
   * hides the small caption entirely, rather than leaving an empty bubble floating beside the
   * avatar -- for beats like Phase 7's post-confirm celebration bounce where nothing should
   * visually compete with the mascot. Reverses automatically the next time `say()` or a
   * panel-hosted method (via `pointToPanel`) renders new caption content.
   */
  hideCaption(): void {
    this.captionTextEl.textContent = "";
    this.captionActionEl.replaceChildren();
    this.captionEl.classList.add("wd-mascot-caption--hidden");
  }

  /**
   * appends a confirm control to whichever surface last rendered content (the small caption via
   * `say()`, or the dialog panel via any panel-hosted method below) -- mirrors `Panel.
   * confirmPlacement` exactly, just routed to the right surface. Resolves once clicked.
   */
  confirmPlacement(label = "Confirm placement"): Promise<void> {
    if (this.activeSurface === "caption") {
      this.captionActionEl.replaceChildren();
      const result = showNextLink(this.captionActionEl, label, { compact: true });
      this.reposition();
      return result;
    }
    return this.panel.confirmPlacement(label);
  }

  /** points the avatar's caption at the dialog panel below -- called by every panel-hosted method
   * so a phase author gets the "look below" redirect for free, without wiring it per call site.
   * `caption`, if passed, overrides the default `POINT_TO_PANEL_TEXT` for phases that want the
   * small caption to say something more specific than "look below" while still routing
   * `confirmPlacement` at the panel. */
  private pointToPanel(caption: string = POINT_TO_PANEL_TEXT): void {
    this.activeSurface = "panel";
    this.captionEl.classList.remove("wd-mascot-caption--hidden");
    this.captionTextEl.textContent = caption;
    this.captionActionEl.replaceChildren();
    this.reposition();
  }

  showDragHandles(slots: PanelDragSlot[], intro?: { heading: string; subheading: string }, caption?: string): PanelDragHandle {
    this.talk();
    this.pointToPanel(caption);
    return this.panel.showDragHandles(slots, intro);
  }

  showField(field: PanelField, caption?: string): Promise<string> {
    this.talk();
    this.pointToPanel(caption);
    return this.panel.showField(field);
  }

  showInstrumentPanel(heading: string, kind: EvolutionKind, initialStage: EvolutionStage, delayMs = 0, caption?: string): void {
    this.talk(delayMs);
    this.pointToPanel(caption ?? `Drag ${heading} into place. The info below will help. ↓`);
    this.panel.showInstrumentPanel(heading, kind, initialStage, delayMs);
  }

  updateInstrumentPanel(stage: EvolutionStage): void {
    this.panel.updateInstrumentPanel(stage);
  }

  showQuestion(heading: string, question: Question, caption?: string): Promise<QuestionOption> {
    this.talk();
    this.pointToPanel(caption ?? `Learn more about ${heading} below. ↓`);
    return this.panel.showQuestion(heading, question);
  }

  showGate(prompt: string, subtitle: string, options: GateOption[], emphasize?: string[], caption?: string): Promise<string> {
    this.talk();
    this.pointToPanel(caption ?? "Make a choice below. ↓");
    return this.panel.showGate(prompt, subtitle, options, emphasize);
  }

  showRecap(items: string[], cta: { label: string; href: string }, caption?: string): void {
    this.talk();
    this.pointToPanel(caption ?? "See your recap below. ↓");
    this.panel.showRecap(items, cta);
  }

  showEmpty(caption?: string): void {
    this.pointToPanel(caption);
    this.panel.showEmpty();
  }

  showFindings(findings: Finding[], heading: string, caption?: string): void {
    this.talk();
    const findingCount = findings.length;
    this.pointToPanel(caption ?? `See your ${findingCount} finding${findingCount === 1 ? "" : "s"} below. ↓`);
    this.panel.showFindings(findings, heading);
  }

  showPlaceholder(heading: string, subheading: string, delayMs = 0, caption?: string): void {
    this.talk(delayMs);
    this.pointToPanel(caption);
    this.panel.showPlaceholder(heading, subheading, delayMs);
  }
}

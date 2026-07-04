import { Panel, type EvolutionKind } from "./panel";
import { createMascotAvatar, type MascotState } from "./mascotAvatar";
import type { WardleyDemo } from "./WardleyDemo";
import type { EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** how long the "talking" bob animation plays before the mascot settles back to idle */
const TALK_DURATION_MS = 600;

/** matches `.wardley-demo-root .wd-mascot-avatar`'s width in styles.ts, so the avatar can be centered under a node */
const AVATAR_WIDTH = 40;

/** vertical breathing room between a node's edge and the avatar planted below it */
const NODE_CLEARANCE = 12;

/** matches `.wd-mascot`'s `gap: 0.5rem` in styles.ts (at the browser's 16px default root font size) */
const BUBBLE_GAP = 8;

/**
 * the mascot's speech-bubble guide — replaces the sidebar Toolbox for Phase 2 (Evolution) onward.
 * Composes a `Panel` pointed at a floating, node-anchored bubble instead of a fixed sidebar, so
 * every render method below is a thin delegation to that `Panel`, reusing its already-tested
 * rendering logic (instrument-panel/question/recap markup, `.wd-panel-form`/`.wd-next-link`/
 * `.wd-panel-question-option` classes) verbatim rather than reimplementing it — this also keeps
 * `src/dev/autopilot.ts`'s existing class-name selectors working unchanged against the bubble.
 * `Panel` itself, and the sidebar Toolbox it renders into for Phase 0/1, are untouched by this
 * class.
 */
export class Mascot {
  private host: HTMLElement;
  private demo: WardleyDemo;
  private root: HTMLElement;
  private bubbleEl: HTMLElement;
  private panel: Panel;
  private avatar = createMascotAvatar();
  private avatarState: MascotState = "idle";
  private currentAnchorNodeId: string | null = null;
  private lastPos: { x: number; y: number; radius?: number } | null = null;
  private resizeHandler = (): void => this.trackAnchor();

  constructor(host: HTMLElement, demo: WardleyDemo) {
    this.host = host;
    this.demo = demo;

    this.root = document.createElement("div");
    this.root.classList.add("wd-mascot");

    this.bubbleEl = document.createElement("div");
    this.bubbleEl.classList.add("wd-mascot-bubble");

    this.root.append(this.avatar.element, this.bubbleEl);
    this.panel = new Panel(this.bubbleEl);
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
   * the node's circle instead of covering it, and remembers `nodeId` so a window resize re-tracks it
   */
  moveTo(nodeId: string, pos: { x: number; y: number; radius?: number }): void {
    this.currentAnchorNodeId = nodeId;
    this.lastPos = pos;
    this.reposition();
  }

  /**
   * (re)computes the mascot's left/top from `lastPos`, then re-clamps the bubble — called by
   * `moveTo` and by every panel-content method below, since a content change (e.g. swapping in a
   * taller `showQuestion` panel) can push the bubble out of bounds just as much as the anchor
   * node moving can, and `lastPos` lets it redo that math without the caller re-supplying it.
   * No-ops the bounds math (but still sets left/top) when the host has no real layout yet (e.g.
   * unit tests) — same as this code always assumed before it was split out of `moveTo`.
   */
  private reposition(): void {
    if (!this.lastPos) return;
    const { x, y, radius = 0 } = this.lastPos;
    const hostRect = this.host.getBoundingClientRect();

    const below = y + radius + NODE_CLEARANCE; // the two node-clear zones: below it, or above it
    let top = below; // default: planted below the node
    if (hostRect.height) {
      const rootHeight = this.root.getBoundingClientRect().height;
      const above = y - radius - NODE_CLEARANCE - rootHeight;
      // each zone can only overflow on the one edge that points away from the node (below can
      // only run past the host's bottom, above can only run past its top) -- if neither zone
      // fits outright (e.g. a tall question panel anchored to a node with little canvas below
      // *and* little above it), pick whichever overflows less rather than always defaulting to
      // "below".
      const belowOverflow = Math.max(0, below + rootHeight - hostRect.height);
      const aboveOverflow = Math.max(0, -above);
      if (aboveOverflow < belowOverflow) top = above;
      // if the content is shorter than the whole canvas but simply can't clear the node on
      // either side within it (e.g. a tall question panel anchored to a node sitting mid-canvas),
      // clamp fully inside rather than let the pick above still spill past an edge. Safe to prefer
      // full containment here even though it can now vertically overlap the node's own row,
      // because `clampBubbleHorizontally` below always keeps the *bubble* clear of the node's
      // full circle (not just the avatar it's attached to), so nothing ends up rendered on top of
      // the node itself.
      if (rootHeight <= hostRect.height) {
        top = Math.min(Math.max(top, 0), hostRect.height - rootHeight);
      }
    }

    this.root.style.left = `${x - AVATAR_WIDTH / 2}px`;
    this.root.style.top = `${top}px`;
    this.clampBubbleHorizontally(radius);
  }

  /**
   * keeps the speech bubble fully inside the mascot host's bounds (the canvas) instead of
   * spilling past its edge when the anchor node sits near the genesis or commodity end of the
   * evolution axis. Only ever shifts the bubble itself — flipping it to the avatar's left side
   * when the right doesn't have room, clamping as a last resort if neither side does — so the
   * avatar (and the node it's anchored under) never moves. Uses `radius` (not just the avatar's
   * own width) for the gap from the node's center, so the bubble clears the node's *full circle*
   * horizontally — this is what keeps it from covering the node on the rare occasion
   * `reposition` above has to plant it at the node's own vertical level. No-ops when the host has
   * no real layout yet (e.g. unit tests), same as `moveTo` already assumes elsewhere.
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

    const targetLeft = Math.min(Math.max(flip ? leftOfNode : rightOfNode, 0), hostRect.width - bubbleWidth);

    this.bubbleEl.style.left = `${targetLeft - naturalLeft}px`;
    this.bubbleEl.classList.toggle("wd-mascot-bubble--flip", flip);
  }

  setState(state: MascotState): void {
    this.avatarState = state;
    this.avatar.setState(state);
  }

  private trackAnchor(): void {
    if (!this.currentAnchorNodeId) return;
    const pos = this.demo.getNodePixelPosition(this.currentAnchorNodeId);
    if (pos) this.moveTo(this.currentAnchorNodeId, pos);
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

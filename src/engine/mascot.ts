import { Panel, type EvolutionKind } from "./panel";
import { createMascotAvatar, type MascotState } from "./mascotAvatar";
import type { WardleyDemo } from "./WardleyDemo";
import type { EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** how long the "talking" bob animation plays before the mascot settles back to idle */
const TALK_DURATION_MS = 600;

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

  /** positions the bubble+avatar at `pos` (container-pixel space, from `WardleyDemo.getNodePixelPosition`) and remembers `nodeId` so a window resize re-tracks it */
  moveTo(nodeId: string, pos: { x: number; y: number }): void {
    this.currentAnchorNodeId = nodeId;
    this.root.style.left = `${pos.x}px`;
    this.root.style.top = `${pos.y}px`;
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
  }

  updateInstrumentPanel(stage: EvolutionStage): void {
    this.panel.updateInstrumentPanel(stage);
  }

  confirmPlacement(label = "Confirm placement"): Promise<void> {
    return this.panel.confirmPlacement(label);
  }

  showQuestion(heading: string, question: Question, options?: { onReroll?: () => Question }): Promise<QuestionOption> {
    this.talk();
    return this.panel.showQuestion(heading, question, options);
  }

  showRecap(items: string[], cta: { label: string; href: string }): void {
    this.talk();
    this.panel.showRecap(items, cta);
  }

  showEmpty(): void {
    this.panel.showEmpty();
  }

  showPlaceholder(heading: string, subheading: string, delayMs = 0): void {
    this.talk(delayMs);
    this.panel.showPlaceholder(heading, subheading, delayMs);
  }
}

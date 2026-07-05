import { fitNodeLabel } from "./render";
import { injectStylesOnce } from "./styles";
import { showNextLink } from "./nextLink";
import { characteristicsFor, type EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** the two component kinds that travel along the evolution axis — User never does */
export type EvolutionKind = "need" | "capability";

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_RADIUS = 26;

export interface PanelDragSlot {
  id: string;
  /** short label inside the icon circle */
  iconText: string;
  /** caption below the icon */
  label: string;
  /** exactly one slot per `showDragHandles` call must be active */
  active: boolean;
}

export interface PanelDragHandle {
  /** the active slot's element; pass as `dragHandle` to `WardleyDemo.mount`/`runDragStep` */
  activeElement: HTMLElement;
  /** marks the active slot inert once its drag step has snapped */
  complete(): void;
}

export type PanelField = {
  type: "text";
  prompt: string;
  placeholder?: string;
  /** fallback suggestions rendered as clickable chips below the input; clicking one fills the input without submitting */
  examples?: string[];
};

/**
 * a single region that swaps between interaction modes as the tutorial
 * progresses — the mascot (`engine/mascot.ts`) composes one `Panel` instance
 * pointed at its speech bubble and is the sole renderer of every mode below.
 * Today: drag-handle (pick up a node), form (answer one prompt at a time),
 * instrument-panel (live evolution-stage characteristics readout, Phase 20),
 * and question (multiple-choice doctrine prompt with an optional reroll,
 * Phase 30).
 */
export class Panel {
  private container: HTMLElement;
  /** the kind currently rendered by `showInstrumentPanel`, so `updateInstrumentPanel` knows which characteristics table to read from */
  private instrumentKind: EvolutionKind | null = null;
  /** the node label currently rendered by `showInstrumentPanel`, so `updateInstrumentPanel` can rebuild the "Is X in Y?" heading */
  private instrumentLabel = "";

  constructor(container: HTMLElement) {
    injectStylesOnce();
    this.container = container;
    this.container.classList.add("wd-panel");
  }

  /**
   * renders one slot per descriptor; returns the active slot as a drag pickup point.
   * `intro`, if given, renders a heading + subheading above the slot row (reusing the same
   * classes `showPlaceholder`/`showInstrumentPanel` use for theirs).
   */
  showDragHandles(slots: PanelDragSlot[], intro?: { heading: string; subheading: string }): PanelDragHandle {
    this.clear();
    let active: HTMLElement | null = null;

    const content = document.createElement("div");
    content.classList.add("wd-panel-content");
    const iconLabels: SVGTextElement[] = [];

    if (intro) {
      content.classList.add("wd-panel-content--top");

      const headingEl = document.createElement("div");
      headingEl.classList.add("wd-panel-placeholder-heading");
      headingEl.textContent = intro.heading;

      const subheadingEl = document.createElement("div");
      subheadingEl.classList.add("wd-panel-placeholder-subheading");
      subheadingEl.textContent = intro.subheading;

      content.append(headingEl, subheadingEl);
    }

    for (const slot of slots) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("wd-panel-slot");
      wrapper.title = slot.active ? "Drag this onto the canvas" : "Not available yet";
      if (slot.active) {
        wrapper.classList.add("wd-panel-slot--active");
      }

      const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
      svg.setAttribute("viewBox", "0 0 64 64");

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", "32");
      circle.setAttribute("cy", "32");
      circle.setAttribute("r", String(ICON_RADIUS));

      const text = document.createElementNS(SVG_NS, "text") as SVGTextElement;
      text.setAttribute("x", "32");
      text.setAttribute("y", "33");
      text.textContent = slot.iconText;

      svg.append(circle, text);

      const caption = document.createElement("span");
      caption.classList.add("wd-panel-slot-label");
      caption.textContent = slot.label;

      wrapper.append(svg, caption);
      content.appendChild(wrapper);
      iconLabels.push(text);

      if (slot.active) {
        active = wrapper;
      }
    }

    this.container.appendChild(content);
    for (const text of iconLabels) {
      fitNodeLabel(text, ICON_RADIUS);
    }

    if (!active) {
      throw new Error("Panel.showDragHandles requires exactly one active slot");
    }

    return {
      activeElement: active,
      complete: () => {
        active!.classList.remove("wd-panel-slot--active");
        active!.title = "Not available yet";
      },
    };
  }

  /**
   * renders one prompt + one text input; resolves with the trimmed value once the visitor
   * submits a non-empty answer. If `field.examples` is given, also renders a row of clickable
   * chips below the input — clicking one fills the input with that example (and focuses it)
   * without submitting, so the visitor can still edit it before confirming.
   */
  showField(field: PanelField): Promise<string> {
    this.clear();
    return new Promise((resolve) => {
      const form = document.createElement("form");
      form.classList.add("wd-panel-form", "wd-panel-content");

      const prompt = document.createElement("label");
      prompt.classList.add("wd-panel-form-prompt");
      prompt.textContent = field.prompt;
      form.appendChild(prompt);

      const input = document.createElement("input");
      input.type = "text";
      input.classList.add("wd-panel-form-input");
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
      form.appendChild(input);

      if (field.examples?.length) {
        const examples = document.createElement("div");
        examples.classList.add("wd-panel-form-examples");
        for (const example of field.examples) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.classList.add("wd-panel-form-example");
          chip.textContent = example;
          chip.addEventListener("click", () => {
            input.value = example;
            input.focus();
          });
          examples.appendChild(chip);
        }
        form.appendChild(examples);
      }

      const submit = document.createElement("button");
      submit.type = "submit";
      submit.textContent = "Confirm";
      submit.classList.add("wd-panel-form-submit");
      form.appendChild(submit);

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        resolve(value);
      });

      this.container.appendChild(form);
      input.focus();
    });
  }

  /** clears the panel down to an empty `.wd-panel-content` placeholder */
  showEmpty(): void {
    this.clear();
    const content = document.createElement("div");
    content.classList.add("wd-panel-content");
    this.container.appendChild(content);
  }

  /**
   * renders a heading + subheading placeholder at full panel height, fading in after `delayMs`
   * (used to stagger this behind the map caption's own fade-in); stands in for Phase 20's
   * instrument-panel mode (not built yet)
   */
  showPlaceholder(heading: string, subheading: string, delayMs = 0): void {
    this.clear();
    const content = document.createElement("div");
    content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-placeholder");

    const headingEl = document.createElement("div");
    headingEl.classList.add("wd-panel-placeholder-heading");
    headingEl.textContent = heading;

    const subheadingEl = document.createElement("div");
    subheadingEl.classList.add("wd-panel-placeholder-subheading");
    subheadingEl.textContent = subheading;

    content.append(headingEl, subheadingEl);
    this.container.appendChild(content);

    // deferred via setTimeout (same trick as WardleyDemo's showMapCaption) so the browser paints
    // the initial opacity:0 first, then `delayMs` later starts this fading in.
    setTimeout(() => content.classList.add("wd-panel-placeholder--visible"), delayMs);
  }

  /**
   * live-updating readout for Phase 20's evolution drag: heading asks "Is [node] in [stage]?" +
   * real characteristics text (`domain/evolution.ts`'s `characteristicsFor`) for that stage/kind
   * in the subheading slot. Reuses `showPlaceholder`'s layout/fade-in so it stays visually
   * consistent with the rest of Phase 20; `updateInstrumentPanel` then swaps stage + characteristics
   * as the visitor drags, without a full re-render.
   */
  showInstrumentPanel(heading: string, kind: EvolutionKind, initialStage: EvolutionStage, delayMs = 0): void {
    this.clear();
    this.instrumentKind = kind;
    this.instrumentLabel = heading;
    const content = document.createElement("div");
    content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-placeholder");

    const headingEl = document.createElement("div");
    headingEl.classList.add("wd-panel-placeholder-heading");
    headingEl.textContent = `Is ${heading} in ${initialStage}?`;

    const characteristicsEl = document.createElement("div");
    characteristicsEl.classList.add("wd-panel-instrument-characteristics");
    characteristicsEl.textContent = characteristicsFor(kind, initialStage);

    content.append(headingEl, characteristicsEl);
    this.container.appendChild(content);

    setTimeout(() => content.classList.add("wd-panel-placeholder--visible"), delayMs);
  }

  /** updates the "Is X in Y?" heading + characteristics text of an already-rendered `showInstrumentPanel`; a no-op if the panel isn't currently in that mode */
  updateInstrumentPanel(stage: EvolutionStage): void {
    if (!this.instrumentKind) return;
    const headingEl = this.container.querySelector<HTMLElement>(".wd-panel-placeholder-heading");
    const characteristicsEl = this.container.querySelector<HTMLElement>(".wd-panel-instrument-characteristics");
    if (headingEl) headingEl.textContent = `Is ${this.instrumentLabel} in ${stage}?`;
    if (characteristicsEl) characteristicsEl.textContent = characteristicsFor(this.instrumentKind, stage);
  }

  /**
   * appends a confirm link (the same `showNextLink` control) into the currently-rendered
   * `.wd-panel-content`, so it shows up inside the panel's own container instead of a
   * host-page element; resolves once clicked, then removes itself.
   */
  confirmPlacement(label = "Confirm placement"): Promise<void> {
    const content = this.container.querySelector<HTMLElement>(".wd-panel-content") ?? this.container;
    return showNextLink(content, label);
  }

  /**
   * renders `heading` (the capability's label) + `question.prompt`, then one button per
   * `question.options`; resolves with the chosen option once clicked. If `onReroll` is given, also
   * renders a "Try a different question" link — clicking it calls `onReroll()` for a replacement
   * `Question` and re-renders in place, without resolving the returned promise.
   */
  showQuestion(heading: string, question: Question, options?: { onReroll?: () => Question }): Promise<QuestionOption> {
    return new Promise((resolve) => {
      const render = (q: Question) => {
        this.clear();
        const content = document.createElement("div");
        content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-question");

        const headingEl = document.createElement("div");
        headingEl.classList.add("wd-panel-placeholder-heading");
        headingEl.textContent = heading;
        content.appendChild(headingEl);

        const promptEl = document.createElement("div");
        promptEl.classList.add("wd-panel-question-prompt");
        promptEl.textContent = q.prompt;
        content.appendChild(promptEl);

        const optionList = document.createElement("div");
        optionList.classList.add("wd-panel-question-options");
        for (const option of q.options) {
          const button = document.createElement("button");
          button.type = "button";
          button.classList.add("wd-panel-question-option");
          button.textContent = option.label;
          button.addEventListener("click", () => resolve(option));
          optionList.appendChild(button);
        }
        content.appendChild(optionList);

        if (options?.onReroll) {
          const reroll = document.createElement("a");
          reroll.href = "#";
          reroll.classList.add("wd-next-link", "wd-panel-question-reroll");
          reroll.textContent = "Try a different question";
          reroll.addEventListener("click", (event) => {
            event.preventDefault();
            render(options.onReroll!());
          });
          content.appendChild(reroll);
        }

        this.container.appendChild(content);
      };

      render(question);
    });
  }

  /**
   * renders the closing recap: a heading, one line per accomplishment, and an external CTA link
   * (opens in a new tab) — the last thing the visitor sees after clicking the finale's
   * "What's next →" link.
   */
  showRecap(items: string[], cta: { label: string; href: string }): void {
    this.clear();
    const content = document.createElement("div");
    content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-recap");

    const heading = document.createElement("div");
    heading.classList.add("wd-panel-placeholder-heading");
    heading.textContent = "Nice work!";
    content.appendChild(heading);

    const list = document.createElement("ul");
    list.classList.add("wd-panel-recap-list");
    for (const item of items) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    content.appendChild(list);

    const link = document.createElement("a");
    link.classList.add("wd-next-link", "wd-panel-recap-cta");
    link.href = cta.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = cta.label;
    content.appendChild(link);

    this.container.appendChild(content);
  }

  /** updates the subheading text of an already-rendered `showPlaceholder`; a no-op if the panel isn't currently in that mode */
  updatePlaceholderSubheading(text: string): void {
    const subheadingEl = this.container.querySelector<HTMLElement>(".wd-panel-placeholder-subheading");
    if (subheadingEl) {
      subheadingEl.textContent = text;
    }
  }

  clear(): void {
    this.container.innerHTML = "";
    this.instrumentKind = null;
  }
}

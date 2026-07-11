import { fitNodeLabel } from "./render";
import { injectStylesOnce } from "./styles";
import { showNextLink } from "./nextLink";
import { characteristicsFor, type EvolutionStage } from "../domain/evolution";
import type { Question, QuestionOption } from "../domain/questionBank";

/** the two component kinds that travel along the evolution axis — User never does */
export type EvolutionKind = "need" | "capability";

const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_RADIUS = 26;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * writes `text` into `el`, wrapping every exact occurrence of any string in `names` in a
 * `.wd-name` span. Used wherever a node or concept label gets interpolated into a hand-written
 * sentence (e.g. "Is Customer satisfaction in Genesis?") -- without this, a multi-word label just
 * reads as more prose and the sentence can get hard to parse. Falls back to plain `textContent`
 * when `names` is empty.
 */
function renderWithEmphasis(el: HTMLElement, text: string, names: string[]): void {
  el.textContent = "";
  const uniqueNames = [...new Set(names.filter(Boolean))];
  if (uniqueNames.length === 0) {
    el.textContent = text;
    return;
  }
  const pattern = new RegExp(`(${uniqueNames.map(escapeRegExp).join("|")})`, "g");
  for (const part of text.split(pattern)) {
    if (!part) continue;
    if (uniqueNames.includes(part)) {
      const span = document.createElement("span");
      span.classList.add("wd-name");
      span.textContent = part;
      el.appendChild(span);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  }
}

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

export interface GateOption {
  id: string;
  label: string;
}

/** one insight-producing (concept, node) pairing from Phase 30, rendered by `showFindings` */
export interface Finding {
  concept: string;
  node: string;
  text: string;
}

export type PanelField =
  | {
      type: "text";
      prompt: string;
      placeholder?: string;
      /** fallback suggestions rendered as clickable chips below the input; clicking one confirms it immediately */
      examples?: string[];
    }
  | {
      type: "choice";
      prompt: string;
      /** rendered as clickable chips only — no text input, no free typing; clicking one resolves the field immediately */
      options: string[];
    };

/**
 * a single region that swaps between interaction modes as the tutorial
 * progresses — the mascot (`engine/mascot.ts`) composes one `Panel` instance
 * pointed at its speech bubble and is the sole renderer of every mode below.
 * Today: drag-handle (pick up a node), form (answer one prompt at a time),
 * instrument-panel (live evolution-stage characteristics readout, Phase 20),
 * gate (Yes/No/shuffle/Done prompt deciding whether to explore a concept
 * against a node, Phase 30), and question (the concept's multiple-choice
 * deep-dive, Phase 30). Gate and question buttons deliberately share the
 * `wd-panel-question-option` class — see `Mascot`'s doc comment for why.
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
   * renders one prompt, then either a text input (`type: "text"`, resolving with the trimmed
   * value once the visitor submits a non-empty answer, plus an optional row of clickable
   * `examples` chips that confirm immediately) or a pill-only row of clickable `options` chips
   * with no input at all (`type: "choice"`, for a question where free typing isn't wanted).
   */
  showField(field: PanelField): Promise<string> {
    this.clear();
    if (field.type === "choice") {
      return new Promise((resolve) => {
        const content = document.createElement("div");
        content.classList.add("wd-panel-form", "wd-panel-content");

        const prompt = document.createElement("label");
        prompt.classList.add("wd-panel-form-prompt");
        prompt.textContent = field.prompt;
        content.appendChild(prompt);

        const options = document.createElement("div");
        options.classList.add("wd-panel-form-examples");
        for (const option of field.options) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.classList.add("wd-panel-form-example");
          chip.textContent = option;
          chip.addEventListener("click", () => resolve(option.trim()));
          options.appendChild(chip);
        }
        content.appendChild(options);

        this.container.appendChild(content);
      });
    }

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
            resolve(example.trim());
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
    renderWithEmphasis(headingEl, `Is ${heading} in ${initialStage}?`, [heading, initialStage]);

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
    if (headingEl) renderWithEmphasis(headingEl, `Is ${this.instrumentLabel} in ${stage}?`, [this.instrumentLabel, stage]);
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
   * renders `heading` (the node's label) + `question.prompt`, then one button per
   * `question.options`; resolves with the chosen option once clicked.
   */
  showQuestion(heading: string, question: Question): Promise<QuestionOption> {
    this.clear();
    return new Promise((resolve) => {
      const content = document.createElement("div");
      content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-question");

      const headingEl = document.createElement("div");
      headingEl.classList.add("wd-panel-placeholder-heading");
      headingEl.textContent = heading;
      content.appendChild(headingEl);

      const promptEl = document.createElement("div");
      promptEl.classList.add("wd-panel-question-prompt");
      promptEl.textContent = question.prompt;
      content.appendChild(promptEl);

      const optionList = document.createElement("div");
      optionList.classList.add("wd-panel-question-options");
      for (const option of question.options) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("wd-panel-question-option");
        button.textContent = option.label;
        button.addEventListener("click", () => resolve(option));
        optionList.appendChild(button);
      }
      content.appendChild(optionList);

      this.container.appendChild(content);
    });
  }

  /**
   * renders `prompt` + `subtitle`, then one button per `option` (plain string ids, unlike
   * `showQuestion`'s `QuestionOption`+`annotation` — a gate's Yes/No/shuffle/Done choices don't
   * carry a map annotation of their own); resolves with the chosen option's `id` once clicked.
   * Used by Phase 30 to ask "Could exploring {concept} with {node} teach us something?" before
   * committing to a concept's deep-dive `showQuestion`. `emphasize`, if given, is the list of
   * node/concept names to highlight via `renderWithEmphasis` wherever they appear in `prompt`.
   */
  showGate(prompt: string, subtitle: string, options: GateOption[], emphasize: string[] = []): Promise<string> {
    this.clear();
    return new Promise((resolve) => {
      const content = document.createElement("div");
      content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-gate");

      const promptEl = document.createElement("div");
      promptEl.classList.add("wd-panel-question-prompt");
      renderWithEmphasis(promptEl, prompt, emphasize);
      content.appendChild(promptEl);

      const subtitleEl = document.createElement("div");
      subtitleEl.classList.add("wd-panel-placeholder-subheading");
      subtitleEl.textContent = subtitle;
      content.appendChild(subtitleEl);

      const optionList = document.createElement("div");
      optionList.classList.add("wd-panel-question-options");
      for (const option of options) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("wd-panel-question-option");
        button.textContent = option.label;
        button.addEventListener("click", () => resolve(option.id));
        optionList.appendChild(button);
      }
      content.appendChild(optionList);

      this.container.appendChild(content);
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

  /**
   * renders the Phase 30 exit report: `heading` followed by one line per finding
   * ("{concept} at {node}", concept emphasized via `.wd-name`). Rendered in place of
   * `showEmpty` whenever at least one concept produced an annotation, right before Phase 30 hands
   * off to the Finale — reuses the same `.wd-panel-content` container so the Finale's
   * `confirmPlacement` "What's next →" link appends directly beneath the list.
   *
   * The report sits parked over the map's corner (`Mascot.moveToTopRight`) for as long as the
   * visitor lingers on their finished map, so a persistent `.wd-panel-findings-header` bar (a
   * short "Report (N findings)" label + toggle button) stays visible above a collapsible
   * `.wd-panel-findings-body` holding the actual heading + list — collapsing that body is what
   * lets the visitor get the map back unobstructed without losing the report, and re-expand it
   * later. `onToggle`, if given, fires after each collapse/expand so `Mascot.showFindings` can
   * re-run its own bubble-position math (`reposition`) against the now-different bubble height.
   */
  showFindings(findings: Finding[], heading: string, onToggle?: () => void): void {
    this.clear();
    const content = document.createElement("div");
    content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-findings");

    const header = document.createElement("div");
    header.classList.add("wd-panel-findings-header");

    const label = document.createElement("span");
    label.classList.add("wd-panel-findings-label");
    label.textContent = `Report (${findings.length} finding${findings.length === 1 ? "" : "s"})`;
    header.appendChild(label);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.classList.add("wd-panel-collapse-toggle");
    toggle.textContent = "–";
    toggle.title = "Collapse report";
    toggle.setAttribute("aria-expanded", "true");
    header.appendChild(toggle);

    content.appendChild(header);

    const body = document.createElement("div");
    body.classList.add("wd-panel-findings-body");

    const headingEl = document.createElement("div");
    headingEl.classList.add("wd-panel-placeholder-heading");
    headingEl.textContent = heading;
    body.appendChild(headingEl);

    const list = document.createElement("ul");
    list.classList.add("wd-panel-findings-list");
    for (const finding of findings) {
      const li = document.createElement("li");
      const conceptEl = document.createElement("span");
      conceptEl.classList.add("wd-name");
      conceptEl.textContent = finding.concept;
      li.append(conceptEl, document.createTextNode(` at ${finding.node}`));
      list.appendChild(li);
    }
    body.appendChild(list);

    content.appendChild(body);

    toggle.addEventListener("click", () => {
      const collapsed = body.classList.toggle("wd-panel-findings-body--collapsed");
      toggle.textContent = collapsed ? "+" : "–";
      toggle.title = collapsed ? "Show report" : "Collapse report";
      toggle.setAttribute("aria-expanded", String(!collapsed));
      onToggle?.();
    });

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

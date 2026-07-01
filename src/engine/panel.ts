import { fitNodeLabel } from "./render";
import { injectStylesOnce } from "./styles";
import { showNextLink } from "./nextLink";
import { characteristicsFor, type EvolutionStage } from "../domain/evolution";

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

export interface PanelSelectOption {
  value: string;
  label: string;
}

export type PanelField =
  | { type: "select"; prompt: string; options: PanelSelectOption[] }
  | { type: "text"; prompt: string; placeholder?: string };

/**
 * the side panel ("toolbox"): a single region that swaps between interaction
 * modes as the tutorial progresses. Today: drag-handle (pick up a node), form
 * (answer one prompt at a time), and instrument-panel (live evolution-stage
 * characteristics readout, Phase 2). A Q&A mode (Phase 3) is not built yet.
 */
export class Panel {
  private container: HTMLElement;
  /** the kind currently rendered by `showInstrumentPanel`, so `updateInstrumentPanel` knows which characteristics table to read from */
  private instrumentKind: EvolutionKind | null = null;

  constructor(container: HTMLElement) {
    injectStylesOnce();
    this.container = container;
    this.container.classList.add("wd-panel");
  }

  /** renders one slot per descriptor; returns the active slot as a drag pickup point */
  showDragHandles(slots: PanelDragSlot[]): PanelDragHandle {
    this.clear();
    let active: HTMLElement | null = null;

    const content = document.createElement("div");
    content.classList.add("wd-panel-content");
    const iconLabels: SVGTextElement[] = [];

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

  /** renders one prompt + one input; resolves with the trimmed value once the visitor submits a non-empty answer */
  showField(field: PanelField): Promise<string> {
    this.clear();
    return new Promise((resolve) => {
      const form = document.createElement("form");
      form.classList.add("wd-panel-form", "wd-panel-content");

      const prompt = document.createElement("label");
      prompt.classList.add("wd-panel-form-prompt");
      prompt.textContent = field.prompt;
      form.appendChild(prompt);

      const input: HTMLSelectElement | HTMLInputElement =
        field.type === "select" ? document.createElement("select") : document.createElement("input");
      input.classList.add("wd-panel-form-input");

      if (field.type === "select") {
        for (const option of field.options) {
          const optionEl = document.createElement("option");
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          input.appendChild(optionEl);
        }
      } else {
        (input as HTMLInputElement).type = "text";
        if (field.placeholder) {
          (input as HTMLInputElement).placeholder = field.placeholder;
        }
      }
      form.appendChild(input);

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
      if (field.type !== "select") {
        (input as HTMLInputElement).focus();
      }
    });
  }

  /** clears the panel down to an empty `.wd-panel-content` placeholder, keeping the toolbox at its full height between modes */
  showEmpty(): void {
    this.clear();
    const content = document.createElement("div");
    content.classList.add("wd-panel-content");
    this.container.appendChild(content);
  }

  /**
   * renders a heading + subheading placeholder at full panel height, fading in after `delayMs`
   * (used to stagger this behind the map caption's own fade-in); stands in for Phase 2's
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
   * live-updating readout for Phase 2's evolution drag: heading (the node's label) + current
   * stage name + real characteristics text (`domain/evolution.ts`'s `characteristicsFor`) for
   * that stage/kind. Reuses `showPlaceholder`'s layout/fade-in so it stays visually consistent
   * with the rest of Phase 2; `updateInstrumentPanel` then swaps stage + characteristics as the
   * visitor drags, without a full re-render.
   */
  showInstrumentPanel(heading: string, kind: EvolutionKind, initialStage: EvolutionStage, delayMs = 0): void {
    this.clear();
    this.instrumentKind = kind;
    const content = document.createElement("div");
    content.classList.add("wd-panel-content", "wd-panel-content--top", "wd-panel-placeholder");

    const headingEl = document.createElement("div");
    headingEl.classList.add("wd-panel-placeholder-heading");
    headingEl.textContent = heading;

    const stageEl = document.createElement("div");
    stageEl.classList.add("wd-panel-placeholder-subheading");
    stageEl.textContent = initialStage;

    const characteristicsEl = document.createElement("div");
    characteristicsEl.classList.add("wd-panel-instrument-characteristics");
    characteristicsEl.textContent = characteristicsFor(kind, initialStage);

    content.append(headingEl, stageEl, characteristicsEl);
    this.container.appendChild(content);

    setTimeout(() => content.classList.add("wd-panel-placeholder--visible"), delayMs);
  }

  /** updates the stage name + characteristics text of an already-rendered `showInstrumentPanel`; a no-op if the panel isn't currently in that mode */
  updateInstrumentPanel(stage: EvolutionStage): void {
    if (!this.instrumentKind) return;
    const stageEl = this.container.querySelector<HTMLElement>(".wd-panel-placeholder-subheading");
    const characteristicsEl = this.container.querySelector<HTMLElement>(".wd-panel-instrument-characteristics");
    if (stageEl) stageEl.textContent = stage;
    if (characteristicsEl) characteristicsEl.textContent = characteristicsFor(this.instrumentKind, stage);
  }

  /**
   * appends a confirm link (the same `showNextLink` control) into the currently-rendered
   * `.wd-panel-content`, so it shows up inside the Toolbox instead of a host-page element;
   * resolves once clicked, then removes itself.
   */
  confirmPlacement(label = "Confirm placement"): Promise<void> {
    const content = this.container.querySelector<HTMLElement>(".wd-panel-content") ?? this.container;
    return showNextLink(content, label);
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

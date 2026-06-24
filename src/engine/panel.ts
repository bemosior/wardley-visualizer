import { fitNodeLabel } from "./render";
import { injectStylesOnce } from "./styles";

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
 * modes as the tutorial progresses. Today: drag-handle (pick up a node) and
 * form (answer one prompt at a time). Later phases add an instrument-panel
 * readout (Phase 2) and a Q&A mode (Phase 3) — not built yet.
 */
export class Panel {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    injectStylesOnce();
    this.container = container;
    this.container.classList.add("wd-panel");
  }

  /** renders one slot per descriptor; returns the active slot as a drag pickup point */
  showDragHandles(slots: PanelDragSlot[]): PanelDragHandle {
    this.clear();
    let active: HTMLElement | null = null;

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
      this.container.appendChild(wrapper);
      fitNodeLabel(text, ICON_RADIUS);

      if (slot.active) {
        active = wrapper;
      }
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
      form.classList.add("wd-panel-form");

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
    });
  }

  clear(): void {
    this.container.innerHTML = "";
  }
}

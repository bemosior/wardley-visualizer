const SVG_NS = "http://www.w3.org/2000/svg";

export type MascotState = "idle" | "talking" | "celebrating";

export interface MascotAvatar {
  element: SVGSVGElement;
  setState(state: MascotState): void;
}

const STATE_CLASSES: Record<MascotState, string> = {
  idle: "wd-mascot--idle",
  talking: "wd-mascot--talking",
  celebrating: "wd-mascot--celebrating",
};

/**
 * a small geometric character (circle body, dot eyes, curved mouth) reusing `.wd-node-shape`'s
 * exact fill/stroke recipe (see styles.ts) so it visually belongs to the same "node" family
 * already on screen, rather than a foreign, hand-drawn illustration. All three states (idle,
 * talking, celebrating) are pure CSS class toggles — the animation itself lives in styles.ts.
 */
export function createMascotAvatar(): MascotAvatar {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.classList.add("wd-mascot-avatar");
  svg.setAttribute("viewBox", "0 0 64 64");

  const body = document.createElementNS(SVG_NS, "circle");
  body.classList.add("wd-mascot-avatar-body");
  body.setAttribute("cx", "32");
  body.setAttribute("cy", "32");
  body.setAttribute("r", "28");

  const leftEye = document.createElementNS(SVG_NS, "circle");
  leftEye.classList.add("wd-mascot-avatar-eye");
  leftEye.setAttribute("cx", "22");
  leftEye.setAttribute("cy", "28");
  leftEye.setAttribute("r", "3");

  const rightEye = document.createElementNS(SVG_NS, "circle");
  rightEye.classList.add("wd-mascot-avatar-eye");
  rightEye.setAttribute("cx", "42");
  rightEye.setAttribute("cy", "28");
  rightEye.setAttribute("r", "3");

  const mouth = document.createElementNS(SVG_NS, "path");
  mouth.classList.add("wd-mascot-avatar-mouth");
  mouth.setAttribute("d", "M 20 40 Q 32 48 44 40");

  svg.append(body, leftEye, rightEye, mouth);

  let current: MascotState = "idle";
  svg.classList.add(STATE_CLASSES[current]);

  return {
    element: svg,
    setState(state: MascotState): void {
      if (state === current) return;
      svg.classList.remove(STATE_CLASSES[current]);
      svg.classList.add(STATE_CLASSES[state]);
      current = state;
    },
  };
}

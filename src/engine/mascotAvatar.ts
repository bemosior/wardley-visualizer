import pixelMascotUrl from "../assets/pixel-mascot.png";

export type MascotState = "idle" | "talking" | "celebrating";

export interface MascotAvatar {
  element: HTMLImageElement;
  setState(state: MascotState): void;
}

const STATE_CLASSES: Record<MascotState, string> = {
  idle: "wd-mascot--idle",
  talking: "wd-mascot--talking",
  celebrating: "wd-mascot--celebrating",
};

/**
 * the mascot's pixel-art portrait. All three states (idle, talking, celebrating) are pure CSS
 * class toggles on the `<img>` itself — the animation lives in styles.ts.
 */
export function createMascotAvatar(): MascotAvatar {
  const img = document.createElement("img");
  img.classList.add("wd-mascot-avatar");
  img.src = pixelMascotUrl;
  img.alt = "";

  let current: MascotState = "idle";
  img.classList.add(STATE_CLASSES[current]);

  return {
    element: img,
    setState(state: MascotState): void {
      if (state === current) return;
      img.classList.remove(STATE_CLASSES[current]);
      img.classList.add(STATE_CLASSES[state]);
      current = state;
    },
  };
}

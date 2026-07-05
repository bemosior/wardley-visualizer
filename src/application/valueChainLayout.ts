import { NODE_RADIUS } from "../engine/render";
import type { DemoConfig, DemoConnection, DemoNode } from "../engine/types";
import { valueChainComponents, valueChainDependencies, type ValueChain } from "../domain/valueChain";

export interface Point {
  x: number;
  y: number;
}

export interface ValueChainLayoutOptions {
  viewBox?: { width: number; height: number };
  snapThreshold?: number;
  /** y-position of the User node; defaults to tangent against the top viewBox edge */
  userY?: number;
  /** y-position of the Need node */
  needY?: number;
  /** y-position of the Capability row */
  capabilityY?: number;
  /** horizontal gap between adjacent Capability nodes */
  capabilityGap?: number;
  /** the Need's pre-drag starting position; defaults level with needY, near the left edge */
  needStart?: Point;
  onComplete?: () => void;
}

const DEFAULT_VIEW_BOX = { width: 400, height: 300 };
const DEFAULT_NEED_Y = 76;
const DEFAULT_CAPABILITY_Y = 157;
/** horizontal spacing between adjacent Capability nodes in a row; exported so `phase5.ts` can use
 * the same spacing when it adds capability nodes a custom config didn't already render */
export const DEFAULT_CAPABILITY_GAP = 140;
const DEFAULT_NEED_START_X = 35;
/** clears both the User and Capability rows (unlike `needY`, which sits close enough to the
 * Capability row to overlap it at `DEFAULT_NEED_START_X`) — now that the Need renders here from
 * the very start instead of staying hidden until picked up from a toolbox slot, its start
 * position has to look like a real (non-overlapping) spot on the canvas */
const DEFAULT_NEED_START_Y = 24;

/**
 * lays out a ValueChain as a draggable teaching demo: User anchored above the
 * viewBox, Need draggable into place below it, Capabilities spread evenly
 * underneath. Reused across any demo that teaches a User/Need/Capability
 * value chain — only the domain content (labels, capability count) and
 * presentation tuning (viewBox, spacing) need to change per demo.
 */
export function layoutValueChain(chain: ValueChain, options: ValueChainLayoutOptions = {}): DemoConfig {
  const viewBox = options.viewBox ?? DEFAULT_VIEW_BOX;
  const userY = options.userY ?? -NODE_RADIUS;
  const needY = options.needY ?? DEFAULT_NEED_Y;
  const capabilityY = options.capabilityY ?? DEFAULT_CAPABILITY_Y;
  const capabilityGap = options.capabilityGap ?? DEFAULT_CAPABILITY_GAP;
  const needStart = options.needStart ?? { x: DEFAULT_NEED_START_X, y: DEFAULT_NEED_START_Y };
  const centerX = viewBox.width / 2;

  const positions = new Map<string, Point>();
  positions.set(chain.user.id, { x: centerX, y: userY });
  positions.set(chain.need.id, { x: centerX, y: needY });
  chain.capabilities.forEach((capability, i) => {
    const offset = i - (chain.capabilities.length - 1) / 2;
    positions.set(capability.id, { x: centerX + offset * capabilityGap, y: capabilityY });
  });

  const nodes: DemoNode[] = valueChainComponents(chain).map((component) => {
    const pos = positions.get(component.id)!;
    const draggable = component.id === chain.need.id;
    return {
      id: component.id,
      label: component.label,
      x: pos.x,
      y: pos.y,
      draggable,
      start: draggable ? needStart : undefined,
    };
  });

  const connections: DemoConnection[] = valueChainDependencies(chain);

  return {
    viewBox,
    nodes,
    connections,
    snapThreshold: options.snapThreshold ?? 30,
    onComplete: options.onComplete,
  };
}

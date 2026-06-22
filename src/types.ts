export interface DemoNode {
  id: string;
  label: string;
  /** correct/target position, in SVG viewBox units */
  x: number;
  y: number;
  draggable: boolean;
  /** initial position before the user drags it into place; required if draggable */
  start?: { x: number; y: number };
}

export interface DemoConnection {
  from: string;
  to: string;
}

export interface DemoConfig {
  viewBox: { width: number; height: number };
  nodes: DemoNode[];
  connections: DemoConnection[];
  /** max distance (viewBox units) from target at drop time that still counts as a snap */
  snapThreshold: number;
  onComplete?: () => void;
}

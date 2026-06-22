import type { DemoConfig } from "../types";

export const userNeedDependencyDemo: DemoConfig = {
  viewBox: { width: 400, height: 300 },
  snapThreshold: 30,
  nodes: [
    { id: "user", label: "User", x: 200, y: 40, draggable: false },
    { id: "need", label: "Need", x: 200, y: 160, draggable: true, start: { x: 350, y: 160 } },
    { id: "dependency-1", label: "Dependency", x: 130, y: 260, draggable: false },
    { id: "dependency-2", label: "Dependency", x: 270, y: 260, draggable: false },
  ],
  connections: [
    { from: "user", to: "need" },
    { from: "need", to: "dependency-1" },
    { from: "need", to: "dependency-2" },
  ],
};

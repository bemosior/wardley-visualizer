import type { DemoConfig } from "../types";
import { createConnectionLine, createNodeGroup, createSvgRoot, createTargetMarker } from "./render";
import { injectStylesOnce } from "./styles";
import { attachDrag, type ConnectedLine, type RevealTarget } from "./drag";

export interface MountOptions {
  /** an external element (e.g. a toolbox slot) that the draggable node must be picked up from */
  dragHandle?: HTMLElement;
}

export class WardleyDemo {
  private container: HTMLElement;
  private svg: SVGSVGElement;

  static mount(container: HTMLElement, config: DemoConfig, options?: MountOptions): WardleyDemo {
    return new WardleyDemo(container, config, options);
  }

  private constructor(container: HTMLElement, config: DemoConfig, options?: MountOptions) {
    injectStylesOnce();

    this.container = container;
    this.container.classList.add("wardley-demo-root");

    this.svg = createSvgRoot(config.viewBox);
    this.container.appendChild(this.svg);

    const nodesById = new Map(config.nodes.map((n) => [n.id, n]));
    const nodeGroups = new Map(config.nodes.map((n) => [n.id, createNodeGroup(n)]));

    const lines = config.connections.map((conn) => ({
      conn,
      el: createConnectionLine(conn, nodesById),
    }));

    const draggableNode = config.nodes.find((n) => n.draggable);
    const targetMarker = draggableNode ? createTargetMarker(draggableNode) : null;
    if (targetMarker) {
      this.svg.appendChild(targetMarker);
    }
    for (const { el } of lines) {
      this.svg.appendChild(el);
    }
    for (const group of nodeGroups.values()) {
      this.svg.appendChild(group);
    }

    if (draggableNode) {
      const nodeGroup = nodeGroups.get(draggableNode.id)!;
      if (options?.dragHandle) {
        nodeGroup.style.opacity = "0";
      } else {
        nodeGroup.classList.add("wd-node--beckon");
      }

      const connectedLines: ConnectedLine[] = lines
        .filter(({ conn }) => conn.from === draggableNode.id || conn.to === draggableNode.id)
        .map(({ conn, el }) => ({
          line: el,
          endpoint: conn.from === draggableNode.id ? "from" : "to",
        }));

      const revealTargets: RevealTarget[] = lines.map(({ el }) => ({
        element: el as SVGElement,
        baseOpacity: 0.5,
      }));

      attachDrag(
        {
          svg: this.svg,
          nodeGroup,
          node: draggableNode,
          connectedLines,
          revealTargets,
          externalHandle: options?.dragHandle,
          onSnapSuccess: () => {
            for (const { el } of lines) {
              el.classList.add("wd-line--active");
            }
            targetMarker?.classList.add("wd-target-marker--hidden");
            config.onComplete?.();
          },
        },
        config.snapThreshold,
      );
    }
  }

  destroy(): void {
    this.svg.remove();
    this.container.classList.remove("wardley-demo-root");
  }
}

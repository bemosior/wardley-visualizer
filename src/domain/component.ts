export type ComponentKind = "user" | "need" | "capability";

export interface Component {
  id: string;
  label: string;
  kind: ComponentKind;
}

export function relabelComponent(component: Component, label: string): Component {
  return { ...component, label };
}

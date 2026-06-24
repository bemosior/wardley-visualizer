import { relabelComponent, type Component } from "./component";
import type { Dependency } from "./dependency";

/**
 * the simplest complete Wardley value chain: a User has a Need, and that
 * Need depends on one or more Capabilities to be met. This is an aggregate —
 * construct it only through `createValueChain` so the invariant (one User,
 * one Need, at least one Capability) always holds.
 */
export interface ValueChain {
  user: Component;
  need: Component;
  capabilities: Component[];
}

export interface ValueChainSpec {
  user: { id: string; label: string };
  need: { id: string; label: string };
  capabilities: { id: string; label: string }[];
}

export function createValueChain(spec: ValueChainSpec): ValueChain {
  if (spec.capabilities.length === 0) {
    throw new Error("a value chain needs at least one Capability");
  }
  return {
    user: { ...spec.user, kind: "user" },
    need: { ...spec.need, kind: "need" },
    capabilities: spec.capabilities.map((c) => ({ ...c, kind: "capability" as const })),
  };
}

export function valueChainComponents(chain: ValueChain): Component[] {
  return [chain.user, chain.need, ...chain.capabilities];
}

export function valueChainDependencies(chain: ValueChain): Dependency[] {
  return [
    { from: chain.user.id, to: chain.need.id },
    ...chain.capabilities.map((c) => ({ from: chain.need.id, to: c.id })),
  ];
}

export function relabelUser(chain: ValueChain, label: string): ValueChain {
  return { ...chain, user: relabelComponent(chain.user, label) };
}

export function relabelNeed(chain: ValueChain, label: string): ValueChain {
  return { ...chain, need: relabelComponent(chain.need, label) };
}

export function relabelCapability(chain: ValueChain, id: string, label: string): ValueChain {
  return {
    ...chain,
    capabilities: chain.capabilities.map((c) => (c.id === id ? relabelComponent(c, label) : c)),
  };
}

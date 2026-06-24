import { WardleyDemo } from "./engine/WardleyDemo";
import { fitNodeLabel } from "./engine/render";
import { Panel } from "./engine/panel";
import { createValueChain } from "./domain/valueChain";
import { layoutValueChain } from "./application/valueChainLayout";
import { runValueChainScenario } from "./demos/userNeedDependency";

const api = {
  mount: WardleyDemo.mount,
  fitNodeLabel,
  Panel,
  domain: { createValueChain },
  layouts: { layoutValueChain },
  demos: { userNeedDependency: runValueChainScenario },
};

export default api;

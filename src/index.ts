import { WardleyDemo } from "./engine/WardleyDemo";
import { userNeedDependencyDemo } from "./demos/userNeedDependency";

const api = {
  mount: WardleyDemo.mount,
  demos: { userNeedDependency: userNeedDependencyDemo },
};

export default api;

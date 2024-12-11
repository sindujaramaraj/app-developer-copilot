import { ICodeComponent } from '../types';

export function sortComponentsByDependency(
  nodes: ICodeComponent[],
): ICodeComponent[] {
  const componentMap = new Map<string, ICodeComponent>();
  nodes.forEach((node) => {
    componentMap.set(node.name, node);
  });

  const sortedNodes: ICodeComponent[] = [];
  while (nodes.length > sortedNodes.length) {
    for (const node of nodes) {
      // Check if the node is sorted
      if (sortedNodes.find((sortedNode) => node.name === sortedNode.name)) {
        continue;
      }

      const dependencies = node.dependsOn || [];
      if (!dependencies || dependencies.length === 0) {
        sortedNodes.push(node);
        continue;
      }
      let dependeciesFound = true;
      for (const dependency of dependencies) {
        // check if the dependency is on one of the nodes
        if (!componentMap.has(dependency)) {
          continue; // External dependency. Skip checking in sorted nodes
        }
        // check if the dependency is already sorted
        if (sortedNodes.some((sortedNode) => sortedNode.name === dependency)) {
          continue;
        }
        dependeciesFound = false;
        break; // dependency not sorted yet
      }
      if (dependeciesFound) {
        sortedNodes.push(node);
      }
    }
  }
  return sortedNodes;
}

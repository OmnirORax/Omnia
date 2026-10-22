import { selfInventory, resolvePropertyTarget } from "../src/properties/registry.ts";
import { PROPERTY_REGISTRY, PROPERTIES, TARGETS } from "../src/appearance/registry.ts";
import { PROPERTY_TREE } from "../src/appearance/propertyTree.ts";
import { SETTINGS_PROPERTY_ADAPTERS } from "../src/properties/settingsAdapter.ts";
// Registration rejects incompatible definitions and missing properties. This checks
// the projections/adapters too, so listing a consumer alone is not integration.
const flatten = nodes => nodes.flatMap(node => [...(node.property ? [node.property] : []), ...flatten(node.children ?? [])]);
const nodes = flatten(PROPERTY_TREE);
for (const property of PROPERTIES) {
  if (nodes.filter(id => id === property.id).length !== 1)
    throw new Error(`Property must have exactly one controller node: ${property.id}`);
}
for (const consumer of PROPERTY_REGISTRY.consumers) {
  if (consumer.owner === "appearance") {
    const target = TARGETS.find(target => target.id === consumer.id);
    if (!target) throw new Error(`Coupled consumer absent from hierarchy: ${consumer.id}`);
    for (const [property, channel] of Object.entries(consumer.channels))
      if (!target.properties?.includes(property) || target.couplings?.[property] !== channel)
        throw new Error(`Missing target coupling: ${consumer.id}/${property}`);
  } else if (consumer.owner === "settings") {
    const adapter = SETTINGS_PROPERTY_ADAPTERS[consumer.id];
    if (!adapter) throw new Error(`Missing consumer adapter: ${consumer.id}`);
    for (const channel of Object.values(consumer.channels))
      if (!adapter.channels[channel]) throw new Error(`Missing consumer channel: ${consumer.id}/${channel}`);
    for (const channel of Object.keys(adapter.channels))
      if (!consumer.channels[channel]) throw new Error(`Adapter field is not coupled: ${consumer.id}/${channel}`);
  } else throw new Error(`A new state owner needs adapter coverage in the property check: ${consumer.owner}`);
}
// Self inventory is a projection of coupled groups, never a second target list.
const checkSelf = node => {
  const resolved = resolvePropertyTarget(PROPERTY_REGISTRY, node.id);
  if (JSON.stringify([...resolved.consumers].sort()) !== JSON.stringify([...node.consumers].sort()))
    throw new Error(`Self inventory diverged from coupling graph: ${node.id}`);
  node.children.forEach(checkSelf);
};
selfInventory(PROPERTY_REGISTRY).forEach(checkSelf);
console.log(`Property contract: ${PROPERTIES.length} shared definitions, ${PROPERTY_REGISTRY.consumers.length} coupled consumers.`);

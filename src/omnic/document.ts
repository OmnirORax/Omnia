import { validateDocument, type Document, type Entity } from "../graph/structural.ts";
import { validateRecipe, type Recipe } from "./model.ts";

/** Revise one canonical object. Placements and other structural facts are untouched.
 * The document owner records history and increments document.revision on commit. */
export function saveOmnicDefinition(doc: Document, entityId: string, recipe: Recipe): Document {
  const entity = doc.entities.find(item => item.id === entityId);
  if (!entity) throw new Error(`Missing Omnium object: ${entityId}`);
  const definition = validateRecipe({ ...recipe, revision: (entity.omnic?.revision ?? 0) + 1 });
  return validateDocument({
    ...doc,
    entities: doc.entities.map(item => item === entity ? { ...item, omnic: definition } : item),
  });
}

/** Explicitly derive a separately editable identity. Component IDs remain stable
 * within their new canonical object's scope; references to other objects stay shared.
 * Callers create placements using the normal placement path, never duplicate the
 * recipe onto each occurrence. sourceEntityId is provenance for metadata only. */
export function forkOmnicDefinition(doc: Document, sourceEntityId: string | undefined, recipe: Recipe, label: string, newEntityId: string): Document {
  const source = sourceEntityId === undefined ? undefined : doc.entities.find(entity => entity.id === sourceEntityId);
  if (sourceEntityId !== undefined && !source) throw new Error(`Missing source Omnium object: ${sourceEntityId}`);
  if (doc.entities.some(entity => entity.id === newEntityId)) throw new Error(`Omnium object already exists: ${newEntityId}`);
  const definition = validateRecipe({ ...recipe, revision: 1 });
  const entity: Entity = { id: newEntityId, label, aliases: [], notes: source?.notes ?? "", omnic: definition };
  return validateDocument({ ...doc, entities: [...doc.entities, entity] });
}

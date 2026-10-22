# Universal properties, coupling and generated controllers

Status: **agreed product direction; general implementation pending**. Recorded
2026-10-22. The existing appearance registry implements part of the model for
visual targets. A universal registry and automatic coupling/category mechanism
have not been implemented. This document preserves the user's decisions for the
worker implementing that system; it does not claim new runtime behavior.

## Purpose

A new function can have properties unique to it and properties shared with other
functions. Shared properties must be defined and implemented once, with consumers
coupled to the shared machinery rather than recreating settings and setters.
This applies across the project, not just to visual features.

The master controller groups properties into categories such as Physical and
Visual. Examples include speed, gravity, rate, weight, color and brightness.
These examples do not imply that physical simulation or its properties already
exist. The category vocabulary and complete property inventory remain extensible.

## Agreed behavior

1. When a new function introduces a property, first check whether the compatible
   property already exists in the shared pool.
2. If it exists, couple the consumer to it. Do not create a second definition,
   setter or parallel control system for the same property.
3. If it does not exist, add its definition and shared editing support once,
   under the relevant category. Create a category when none fits.
4. Established couplings drive inclusion in the hierarchy of controllable things.
   Do not independently maintain a list and hope the property path is wired later.
5. A unique property can later be reused by additional compatible consumers.
6. **Consumers retain independent values. Changing one does not change the others.**
   Explicitly targeting several consumers permits a shared adjustment to that set.
7. Existing shared fields should remain shared. Add and serialize only genuinely
   new property definitions/fields; use the established path for existing ones.

Here “shared” means a common definition, setter/editing machinery and supported
contract. It does not mean one global mutable value, synchronized instances,
identical defaults, or that every consumer supports every property.

## Example: two functions with color and rate

Suppose functions A and B both support compatible Color and Rate properties.
The controller has one Color definition and one compatible Rate definition. A
can have blue and rate 2 while B has red and rate 5. Editing A changes only A.
Selecting both and applying a compatible adjustment explicitly changes both.

A third function with a genuinely new property adds it to the pool once. A later
function can couple to that property without adding another editor. The same
identity should appear consistently in discovery, editing and serialization.

## Implementation constraints

The following clarify the contract; the exact detection algorithm, schemas and
category creation UI still need design:

- Names alone are insufficient for matching. Meaning, value type, units and
  supported ranges/operations matter. Playback rate and particle emission rate
  must not be merged merely because both contain the word “rate.”
- Prefer explicit machine-readable capability/property declarations over guessing
  from pixels, CSS names or arbitrary implementation variables. Automatic lookup,
  validation, coupling and inclusion can operate on those declarations. This is
  an implementation recommendation, not a claim that the user specified a schema.
- A property definition and its application adapter are separate. Text, a light
  source and a physics object may require different application logic while
  sharing compatible editing and validation. Each advertised coupling must reach
  real behavior; displaying a control is not sufficient.
- Property identity, category, consumer identity, value, coupling and current
  targeting are separate. Labels and category organization must not change IDs.
- Categories organize the property pool; hierarchy inclusion describes coupled
  consumers. Do not treat every function as an appearance target or mix this with
  canonical knowledge containment.
- Preserve independent values, overrides, locks, bypass, history, serialization
  and defaults when migrating existing consumers. Reuse existing state owners;
  a universal registry does not make all state graph data or all state UI styling.
- Preserve working old routes until their supported behavior is covered, then
  remove redundant definitions/editors rather than leave two active systems.

## Existing foundation and known gap

Appearance currently has PROPERTIES, registered target capabilities, shared
PropertyEditor/PropertyTree, contextual editing, value resolution and draft/history
support. Actions/shortcuts have their own shared catalog. These are useful existing
integration paths, not one already-unified function/property registry.

Mouse trail illustrates why inclusion and working coupling must be treated as one
integration: registering animation fields and a Theme section did not give it the
ordinary Color/Opacity/Glow capabilities expected by the user. Its current target
has a hierarchy declaration but only animation properties. Do not call this fixed
without verifying discovery, applicability, shared edits and actual behavior.

The last attempted response proposed a visual-feature-only registration check.
The user explicitly corrected that scope: this system is broader than appearance.
No such narrow system was implemented after that correction.

## Acceptance examples for future implementation

A newly declared compatible consumer should automatically become controllable
through existing properties and enter the appropriate hierarchy. It should not
require a second hand-written hierarchy row or copied editor. An unknown property
should follow the new-property/category path. Incompatible properties must not
silently couple.

A change to one consumer must leave another consumer's value untouched. A targeted
group edit must reach only included compatible consumers and respect the relevant
protections. Saved independent values and established identities must round-trip.
A declared capability with no application path must be detectable, rather than
silently passing because its panel rendered.

These are behavioral requirements, not authorization to run extra tests now.

# Omnium V2: Simulation Mode

This document records the intended design, not a claim that the capabilities below are already implemented.

## 1. Access & Discovery

- **Node Integration:** Every node has a **Simulation Mode** option in its right-click menu.
- **Search & Filtering:** Users can search/filter nodes by available simulations to discover which systems can be simulated.

## 2. Simulation Scope

- **Universal Applicability:** Any existing system can be simulated for exploration and optimization.
- **Examples:** Batteries, cars, computer components, human hearts, water cycles, chemical reactions, supply and demand, etc.
- **Variable Sophistication:** Simulation complexity, accuracy, and depth depend on the time invested and the chosen implementation.
- **Composable Simulations:** Simulations can connect to form larger simulations: Battery → Motor → Car → Road → Traffic. Each subsystem can be independently modified, replaced, or optimized.
- **Simulation Inheritance:** Changes to one component can propagate through dependent simulations. If someone improves a battery design, that variant should be usable in any compatible simulation containing batteries.

## 3. Canonical Simulations

- **Canonical Baseline:** Each simulated system has a canonical reference version under its corresponding node.
- **Agent Implementation:** Agents individually construct these canonical simulations.
- **Gradual Expansion:** Agents are periodically assigned to create simulations for additional nodes.

## 4. User Branching & Optimization

- **Branching:** Users can branch from a canonical simulation into their own independent versions.
- **Structural Freedom:** Users can modify structures and configurations to explore alternative designs and optimizations.
- **Target Metrics:** Each simulation exposes relevant optimization objectives, such as friction, wear, efficiency, etc.
- **Challenges:** These objectives act as quests/challenges for users to improve upon.
- **Comparison:** Users can evaluate whether their versions outperform the canonical baseline.
- **Separate the simulated system from the simulation engine and evaluator.** Otherwise, users could achieve a supposedly superior car by simply changing the simulation's friction equations instead of improving the car.

## 5. Visualization & Performance

- **Graphics Are Secondary:** Realistic visuals are not a priority.
- **Initial Representation:** Use icon-based nodes, cause-and-effect relationships, and minimal, computationally inexpensive graphics.
- **Core Priority:** Simulate system behavior and enable structural optimization rather than visual realism. Later, increasingly sophisticated visualizations can be attached without rebuilding the simulation.

# Omnium V2: Simulation Architecture

## 1. Zoom & Branching

- **Levels = Zoom Depth:** Out → fewer manipulable components (macro); in → greater structural detail (micro).
- **Macro Independence:** Operate without understanding internal mechanisms.
- **Branching:** Possible at any zoom level.
- **Depth ≠ Fundamentality:** Deeply nested components aren't necessarily fundamental.
- **Simulation Floor:** Explicitly states maximum supported zoom depth.

## 2. Dependencies & Metrics

- **Impact:** Highlighting a component reveals dependency counts (affects / depends on).
- **Cross-Level:** Dependencies persist across zoom levels, including hidden components.

## 3. Symbolic Interface

- **No Text:** All concepts, properties, metrics, and interactions use assigned icons/glyphs/symbols.

## 4. Global Mapping & Reuse

- **Shared Mechanisms:** Explicitly linked across Omnium.
- **Reverse Lookup:** Selecting a component (e.g., battery) highlights all systems containing it.
- **Isolation:** Internal structures can remain irrelevant to external systems, allowing compatible upgrades.

## 5. Linked DOFs

- **Constraints:** Variants may depend on specific structures/configurations within defined DOFs.
- **Violation:** Changes exceeding a dependent's permitted DOFs highlight the affected node red.

# Omnium V2: Knowledge & Mastery

- **Unrestricted Access:** Every zoom level and branch is immediately accessible. No compulsory qualifications.
- If all affected DOFs involved remain unbroken after a change, the user has considered them—demonstrating knowledge of those nodes.
- **Cross-System Recognition:** Mastered knowledge transfers across explicitly linked systems. Relevant nodes appear green.
- **Progressive Guidance:** Highlight unmastered prerequisites relevant to the user's intended operation.
- **Mastery:** Demonstrated competence over specific DOFs and their tested dependencies, transferable wherever those same requirements occur.
- Omnium can then construct each user's knowledge map automatically from their actual operations.

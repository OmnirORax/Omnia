# Omnium V2: Simulation Mode

This is the intended design for the simulation platform, not a claim that every capability below is already implemented. Agents must check current implementation status before reporting availability.

## 1. Access & Discovery

- **Node integration:** Every node has a **Simulation Mode** option in its right-click menu.
- **Search & filtering:** Users can search/filter nodes by available simulations to discover which systems can be simulated.

## 2. Simulation Scope

- **Universal applicability:** Any existing system can be simulated for exploration and optimization.
- **Examples:** Batteries, cars, computer components, human hearts, water cycles, chemical reactions, supply and demand, etc.
- **Variable sophistication:** Simulation complexity, accuracy, and depth depend on the time invested and the chosen implementation.
- **Composable simulations:** Simulations can connect to form larger simulations: Battery → Motor → Car → Road → Traffic. Each subsystem can be independently modified, replaced, or optimized.
- **Simulation inheritance:** Changes to one component can propagate through dependent simulations. If someone improves a battery design, that variant should be usable in any compatible simulation containing batteries.

## 3. Canonical Simulations

- **Canonical baseline:** Each simulated system has a canonical reference version under its corresponding node.
- **Agent implementation:** Agents individually construct these canonical simulations.
- **Gradual expansion:** Agents are periodically assigned to create simulations for additional nodes.

## 4. User Branching & Optimization

- **Branching:** Users can branch from a canonical simulation into their own independent versions.
- **Structural freedom:** Users can modify structures and configurations to explore alternative designs and optimizations.
- **Target metrics:** Each simulation exposes relevant optimization objectives, such as friction, wear, efficiency, etc.
- **Challenges:** These objectives act as quests/challenges for users to improve upon.
- **Comparison:** Users can evaluate whether their versions outperform the canonical baseline.
- **Separate the simulated system from the simulation engine and evaluator.** Otherwise, users could achieve a supposedly superior car by simply changing the simulation's friction equations instead of improving the car.

## 5. Visualization & Performance

- **Graphics are secondary:** Realistic visuals are not a priority.
- **Initial representation:** Use icon-based nodes, cause-and-effect relationships, and minimal, computationally inexpensive graphics.
- **Core priority:** Simulate system behavior and enable structural optimization rather than visual realism. Later, increasingly sophisticated visualizations can be attached without rebuilding the simulation.

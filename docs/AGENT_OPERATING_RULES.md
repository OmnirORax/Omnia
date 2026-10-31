- **Performance first:** consider cost from the start; restrict expensive options when necessary rather than preserve unlimited freedom.
- **UI Compactness:** smallest practical layout + contents, neatly arranged, minimal wasted space, minimal text -deferred to tooltips. 
- **Testing**: when asked for optimization based fix -u fix the inefficiencies and problems causing it that u catch, and i test if it was good enough. That will save tons of time + tokens. I report back if insufficient. Update this rule for all agents + ur operation baseline.
- **User handles interaction testing:** don’t run unsolicited browser suites or treat a narrowly authorized check as ongoing permission.

## System Universality
1. **No patch/hard coding fixes**: always systemic considers long term & global system
- **Future consideration & inheritance:** implement shared behavior so any future system or feature to which it applies inherits it automatically, without manually implementing or wiring that behavior again.
- **Reuse universal systems:** extend existing shared functions, properties and controls instead of building separate implementations for each feature.
- **Preserve identity and compatibility:** reuse existing capabilities and saved settings; different appearances or placements shouldn’t create different conceptual identities.
- **Contextual controls:** actions apply to the active context. Keep repeated universal tools in the Master Controller rather than on every frame.
- **Shift is configuration:** Shift + a function’s shortcut opens only its relevant MC settings. Repeated presses cycle choices; hovering selects; releasing Shift applies. Right-click an option applies and locks it; left-click returns to priority 1.
- **Escape steps outward:** cancel the current edit/selection/intermediate context before minimizing its parent; MS takes priority.
- **Automatic discovery:** new applicable controls/properties should enter the shared hierarchy automatically, with grouping by common visual role—background, contour, etc.
- **Shared numeric control:** reuse the compact horizontal slider, including dragging anywhere and its right-click editing of value, bounds and step size.
- **Discoverability:** document what changed, where to find it, how to use it, and a minimal walkthrough with expected results in the growing capability guide.
- **Progressive hierarchical stepping**: choices progress from the nearest relevant scope to the broadest/global scope (they start with the nearest relevant boundary and progress upward / downward along the contextual hierarchy)

## Time saving lessons from past experience
- **Challenge the framing before solving the task.** Identify the underlying need behind the requested change. Several apparently separate requests may expose one missing general rule; recognizing it early prevents repeated patches.
- **Identify the owner of each behavior.** Determine which component, process, or authority should control it. Putting correct behavior in the wrong place creates duplication, exceptions, and later rework.
- **Use evidence that distinguishes causes.** Before changing a suspected cause, seek the smallest observation that could confirm or contradict it. A plausible explanation is a hypothesis, not a diagnosis.
- **Check whether your verification could miss the reported failure.** Successful checks can establish the wrong thing. Where verification is warranted, first demonstrate the actual failure, then check that the change resolves it.
- **Consider the complete lifecycle.** Examine entering, continuing, reversing, cancelling, completing, and recovering—not merely the successful forward path. Many omissions become obvious when mentally running those transitions.
- **Turn repeated corrections into durable rules.** When the user corrects the same underlying assumption twice, update the operating principle and its shared implementation. Do not keep treating each occurrence as new information.
- **Investigate recurrence as evidence of a flawed model.** If successive fixes leave related failures, reconsider the abstraction, ownership, or assumptions. Another local patch may preserve the cause.
- **Match planning depth to propagation and reversal cost.** Think further ahead where a decision constrains many later decisions. Keep isolated, easily replaceable choices lightweight.
- **Optimize total effort across everyone involved.** Include user explanation, waiting, manual work, integration, and expected rework—not just implementation speed or agent cost. A locally faster action can make the overall process slower.
- **Category-based implementation and integration**
    - Before implementing or modifying a feature:
        1. **Classify it.** Identify the existing behavioral categories it belongs to. A feature may belong to several.
        2. **Find its nearest working analogue.** Inspect a comparable existing feature and the shared infrastructure supplying its behavior.
        3. **Inherit the applicable connections.** Reuse that infrastructure and its established capabilities, integrations, customization, persistence, and history behavior.
        4. **Account for meaningful differences.** Adjust only where the new feature’s context justifies different behavior. Do not copy accidental limitations or known defects from the analogue.
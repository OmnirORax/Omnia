# Omnium V2

V2 is the active application. Work from current `master`. V1 is obsolete and
preserved at `archive/v1` and the `v1-final` tag; retrieve specific implementations
when useful, rather than importing its architecture or instructions wholesale.

Read README.md for current scope, architecture decisions and commands. Read
docs/DEPLOYMENT.md before changing hosting, workflows or backend integration.

## Working approach

- Investigate relevant code and infrastructure before consequential decisions.
  Explain trade-offs and ask when an answer would materially change architecture.
- Establish canonical reusable capabilities/DOFs. Compatible targets declare
  their capabilities; selection, operations and contextual controls should derive
  from them. Avoid parallel registries or a speculative universal framework.
- Source-backed structural editing is the agreed first experiment: actual code
  must become visible and editable inside Omnium through Omnic. A diagram or
  separate metadata copy does not fulfill this. Start with the first reused
  implementation, then iterate as subsequent systems are brought in.
- Keep source/build/recovery usable outside Omnium. The precise editing and
  execution mechanism is still to be designed; do not imply it already works.
- Keep UI compact and relevant to the current task. Do not add controls for
  capabilities that do not exist. Keep pointer/frame work bounded and avoid
  unrelated state updates, discovery and persistence in hot paths.
- The user owns project documentation. Do not create or update documentation
  unless explicitly requested. Agent instructions may be updated when requested.
- Tell the user promptly about blockers or newly discovered architectural choices.

## Delivery

Use Node 24 and `npm ci`. Run `npm test` and `npm run build` before delivery.
Use focused behavioral checks for substantive code; do not add tests that only
mirror static UI. The user owns interactive/visual acceptance; browser suites
require their request. Never infer browser acceptance from a build.

Push completed work once, open/update its PR, and provide the private Cloudflare
preview and a concise inventory of what actually works. Production deployment
from `master` remains active: the user explicitly wants V2 to replace the website.
This transition is authorized to merge and publish once its checks pass. Future
production merges require authorization from their task context.

No secrets, workspace data or local environment files belong in commits/builds.
Preserve Cloudflare Access and the existing Supabase authorization boundary.
There is no required V1 authored-content migration. V2 currently has no persistent
data owner or backend client; do not introduce either merely to preserve V1 shapes.
Before future backend changes, inspect the actual hosted state and historical
migrations; never reset the deployed database or replay the archive blindly.

## User instructions

- **Performance first:** always consider and optimize performance costs. Mention performance costs only when there are material additional costs or trade-offs; do not mention them when there are none.
- **UI Compactness:** smallest practical layout + contents, neatly arranged, minimal wasted space, minimal text, no tooltips or descriptions.
- **User handles interaction testing:** if asked for resolving or optimizing something, only target & fix the suspects - i do the testing. Don’t run unsolicited browser suites or treat a narrowly authorized check as ongoing permission.

## Time saving lessons from past experience

- **Challenge the framing before solving the task.** Identify the underlying need behind the requested change. Several apparently separate requests may expose one missing general rule; recognizing it early prevents repeated patches.
- **Identify the owner of each behavior.** Determine which component, process, or authority should control it. Putting correct behavior in the wrong place creates duplication, exceptions, and later rework.
- **Use evidence that distinguishes causes.** Before changing a suspected cause, seek the smallest observation that could confirm or contradict it.
- **Check whether your verification could miss the reported failure.** Successful checks can establish the wrong thing. Where verification is warranted, first demonstrate the actual failure, then check that the change resolves it.
- **Consider the complete lifecycle.** Examine entering, continuing, reversing, cancelling, completing, and recovering—not merely the successful forward path. Many omissions become obvious when mentally running those transitions.
- **Investigate recurrence as evidence of a flawed model.** If successive fixes leave related failures, reconsider systemically not locally.
- **Match planning depth to propagation and reversal cost.** Think further ahead where a decision constrains many later decisions. Keep isolated, easily replaceable choices lightweight.
- **Optimize total effort across everyone involved.** Include user explanation, waiting, manual work, integration, and expected rework—not just implementation speed or agent cost. A locally faster action can make the overall process slower.

import { ALIGNMENT_ACTIONS } from "./alignmentActions";
import { FRAME_LAYOUTS } from "./frameLayout";

/** Default UI notation, not Omnic grammar. Explicit feature/custom icons take priority. */
const properties: Record<string, string> = {
  textSize: "•●",
  effectAppearance: "◈",
  size: "✦",
  length: "↔",
  contourStyle: "┄",
  gradientAngle: "↗",
  shadowStrength: "◕",
  shadowSpread: "⤢",
  shadowX: "↔",
  shadowY: "↕",
};
const symbols: [RegExp, string][] = [
  [/import|upload|load.*(?:json|file|template)/i, "⇩"],
  [/export|download/i, "⇧"],
  [/text.?size|font.?size/i, "•●"],
  [/hide.?names|name.?visibility/i, "◌"],
  [/undo/i, "↶"],
  [/redo/i, "↷"],
  [/delete|remove|discard|dismiss|close/i, "×"],
  [/save|checkpoint/i, "▣"],
  [/reset|restore|default/i, "↺"],
  [/rename|edit|styling/i, "✎"],
  [/collapse/i, "⊖"],
  [/expand/i, "⊕"],
  [/compact|reflow/i, "⇥⇤"],
  [/align/i, "≡"],
  [/focus|origin|camera/i, "⌖"],
  [/fit/i, "⛶"],
  [/search|find|lookup/i, "⌕"],
  [/shortcut|keybind|keyboard/i, "⌨"],
  [/hierarchy|tree|nest|parent|child/i, "⑂"],
  [/reuse|existing|reference/i, "♻"],
  [/relationship|binder|connect/i, "↔"],
  [/lightning.?length|spacing|horizontal|offset.?x/i, "↔"],
  [/vertical|offset.?y/i, "↕"],
  [/brightness/i, "☼"],
  [/lighting/i, "☀"],
  [/glow/i, "✧"],
  [/opacity|transparen/i, "◐"],
  [/blur/i, "≋"],
  [/second.?color|gradient.?color/i, "◑"],
  [/gradient/i, "◒"],
  [/direction|angle|rotation/i, "↗"],
  [/shadow/i, "◪"],
  [/strength/i, "◕"],
  [/spread/i, "⤢"],
  [/color|saturation/i, "◉"],
  [/font/i, "𝑨"],
  [/weight/i, "𝗔"],
  [/speed/i, "»"],
  [/intensity/i, "ϟ"],
  [/density/i, "⁙"],
  [/star|sparkle/i, "✦"],
  [/animation|effect|motion|lightning/i, "▶"],
  [/thickness|width/i, "━"],
  [/line.?style/i, "┄"],
  [/contour|border/i, "□"],
  [/rounding|corner/i, "╭"],
  [/size|diameter|radius|scale|zoom/i, "•●"],
  [/everything|all$/i, "✺"],
  [/inspector|inspect|specification/i, "ⓘ"],
  [/setting|preference|configuration/i, "⚙"],
  [/theme|appearance/i, "◈"],
  [/window|frame|surface|background|header|handle/i, "▣"],
  [/text|label|name|alias/i, "𝑻"],
  [/icon|symbol|asset|visual/i, "◆"],
  [/slider/i, "⊶"],
  [/checkbox|toggle|radio|switch/i, "☑"],
  [/button|action/i, "⊙"],
  [/field|input|control/i, "▭"],
  [/list|result|library/i, "☷"],
  [/menu|content/i, "☰"],
  [/workspace|spatial|position|snap|grid|magnet/i, "⌖"],
  [/file|document/i, "▤"],
  [/view/i, "◉"],
  [/create|new|add|insert/i, "＋"],
  [/node|entity|concept|variant/i, "●"],
  [/help|about/i, "?"],
  [/lock|pin/i, "⚿"],
  [/select|include|apply|confirm/i, "✓"],
];

export function nameSymbol(id: string, name: string): string {
  const actionId = id.replace(/^function:/, "");
  const alignment = ALIGNMENT_ACTIONS.find(action => actionId === `ui:align:${action.id}`);
  if (alignment) return alignment.symbol;
  const frameLayout = FRAME_LAYOUTS.find(mode => actionId === `ui:createFrame:${mode.id}` || actionId === `ui:frameLayout:${mode.id}`);
  if (frameLayout) return frameLayout.symbol;
  // Known property IDs retain their meaning after the user renames their headings.
  const property = id.match(/^window:property:[^:]+:(.+)$/)?.[1];
  if (property && properties[property]) return properties[property];
  const target = id.match(/^appearance:target:(.+)$/)?.[1];
  const hint = property ?? target ?? name;
  return symbols.find(([pattern]) => pattern.test(hint))?.[1] ?? "◇";
}

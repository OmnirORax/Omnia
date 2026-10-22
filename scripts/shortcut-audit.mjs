import ts from "typescript";

// Existing hardware adapters read configurable settings.mouse actions. These
// exceptions cover only their MB4/5 protocol, never new feature hotkeys.
const hardwareButtons = new Map([
  ["src/App.tsx", new Set([3, 4])],
  ["src/SpatialWorkspace.tsx", new Set([3, 4])],
  ["src/ui/useButtonSelection.tsx", new Set([3, 4])],
]);
const comparisons = new Set([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken]);
const isInputReference = (node, aliases, fields = ["key", "code", "button"]) => {
  if (ts.isIdentifier(node) && aliases.has(node.text)) return true;
  if (ts.isPropertyAccessExpression(node) && fields.includes(node.name.text) &&
    ts.isIdentifier(node.expression) && ["e", "event", "ev"].includes(node.expression.text)) return true;
  let found = false;
  ts.forEachChild(node, child => { if (isInputReference(child, aliases, fields)) found = true; });
  return found;
};
/** Audit shortcut literals, not native Enter/Escape/arrows/primary-click widget
 * behavior. Handles direct, lowercased and locally aliased input comparisons. */
export function privateShortcutLiterals(text, filename = "src/new-feature.tsx") {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const aliases = new Set(), buttonAliases = new Set(), violations = [];
  const aliasPass = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isInputReference(node.initializer, aliases)) aliases.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isInputReference(node.initializer, buttonAliases, ["button"])) buttonAliases.add(node.name.text);
    ts.forEachChild(node, aliasPass);
  };
  aliasPass(source);
  const visit = node => {
    if (ts.isBinaryExpression(node) && comparisons.has(node.operatorToken.kind)) {
      for (const [reference, literal] of [[node.left, node.right], [node.right, node.left]]) {
        if (!isInputReference(reference, aliases)) continue;
        const key = ts.isStringLiteral(literal) && /^(?:[a-z]|F\d{1,2}|Key[A-Z]|Digit\d|(?:Ctrl|Alt|Shift|Meta)\+.+)$/i.test(literal.text);
        const button = ts.isNumericLiteral(literal) && isInputReference(reference, buttonAliases, ["button"]) && [1, 3, 4].includes(Number(literal.text)) &&
          !hardwareButtons.get(filename)?.has(Number(literal.text));
        if (key || button) violations.push(`${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.getText(source)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

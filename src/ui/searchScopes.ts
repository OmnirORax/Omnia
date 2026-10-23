/** Nearest active frame, its ancestors, then the whole interface. Global's level
 * stays 10 so locking it remains global when the active nesting depth changes. */
export function searchScopes(path: readonly string[]) {
  const frames = [...new Set([...path].reverse())].slice(0, 9);
  return [...frames.map((key, index) => ({ key, level: index + 1 })), { key: "workspace", level: 10 }];
}
export function searchScope(path: readonly string[], level: number) {
  const scopes = searchScopes(path);
  return scopes.find(scope => scope.level >= level) ?? scopes[scopes.length - 1];
}

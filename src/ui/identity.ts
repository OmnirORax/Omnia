/** Stable presentation IDs never depend on editable display names. */
export function stableUIHash(value: string): string {
  let result = 14695981039346656037n;
  for (const char of value)
    result = BigInt.asUintN(64, (result ^ BigInt(char.codePointAt(0)!)) * 1099511628211n);
  return result.toString(36);
}

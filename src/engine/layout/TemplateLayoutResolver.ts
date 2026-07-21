/**
 * Splits a selection of matches into batches whose sizes are declared by the
 * template's own variants — no fixed rules. The algorithm greedily takes the
 * largest available variant that still fits the remaining matches.
 *
 * Examples:
 *   variants [1,2,3,4], 10 matches → [4, 4, 2]
 *   variants [1],        9 matches → [1, 1, 1, 1, 1, 1, 1, 1, 1]
 */
export class TemplateLayoutResolver {
  static resolve(variantSizes: readonly number[], total: number): number[] {
    const sizes = [...new Set(variantSizes)].filter((size) => size > 0).sort((a, b) => b - a);
    if (sizes.length === 0 || total <= 0) return [];

    const smallest = sizes[sizes.length - 1];
    const batches: number[] = [];
    let remaining = total;

    while (remaining > 0) {
      const size = sizes.find((candidate) => candidate <= remaining) ?? smallest;
      batches.push(size);
      remaining -= size;
    }

    return batches;
  }
}

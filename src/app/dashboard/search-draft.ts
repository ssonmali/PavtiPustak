/**
 * Whether a term arriving from the URL should replace what is in the box.
 *
 * Pure and separate because the naive answer ("the URL changed, so adopt it")
 * is a bug: the search pushes debounced, so a term sent 300ms ago arrives as a
 * prop mid-typing. Type "sanket", backspace, and the echo puts the letters
 * back.
 *
 * `observed` (the term this field last saw the URL carry) is the pivot. A draft
 * still equal to it means nothing was typed since the box and URL agreed — the
 * only case where replacing is safe. Trailing whitespace is not divergence,
 * since the pushed term is trimmed.
 */
export function shouldAdoptTerm(
  incoming: string,
  observed: string,
  draft: string,
) {
  if (incoming === observed) return false;
  return draft.trim() === observed;
}

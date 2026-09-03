/**
 * Whether a search term arriving from the URL should replace what is in the
 * search box.
 *
 * Its own module, and pure, because the naive answer ("the URL changed, so
 * adopt it") is a bug that is hard to see in review and easy to reintroduce.
 * The receipts search pushes its term debounced, and the navigation that
 * follows is a server round trip, so a term sent 300ms ago comes back as a
 * prop while the volunteer is still typing. Adopting it then re-applies a
 * stale value over live edits: type "sanket", start backspacing, and the echo
 * of "sanket" lands mid-edit and puts the deleted letters back.
 *
 * @param incoming the term the URL now carries
 * @param observed the term this field last saw the URL carry
 * @param draft    what is in the box right now
 *
 * `observed` is the pivot. A draft still equal to it means nothing has been
 * typed since the last time the URL and the box agreed, which is the only
 * case where replacing the box's contents cannot destroy anything. A draft
 * that has diverged is either ahead of the URL (mid-edit) or the echo of its
 * own push, and both want leaving alone — the field's debounce reconciles
 * them by pushing the draft again.
 *
 * Trailing whitespace is not divergence: the pushed term is trimmed, so a
 * draft of "sanket " against an observed "sanket" is the same search.
 */
export function shouldAdoptTerm(
  incoming: string,
  observed: string,
  draft: string,
) {
  if (incoming === observed) return false;
  return draft.trim() === observed;
}

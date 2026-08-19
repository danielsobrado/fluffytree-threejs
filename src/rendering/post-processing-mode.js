/**
 * Whether the graded post chain should run.
 *
 * Off under QA unless asked for by name: every gate that reads pixels was
 * calibrated against the ungraded image, and a bloom is exactly the kind of
 * change that would move a solidity or coverage measurement without moving the
 * geometry those gates exist to measure. `?post=on` forces it back on, which is
 * how a QA run captures what the grade actually looks like.
 *
 * Kept apart from the pipeline itself so it can be tested without a renderer.
 */
export function isPostProcessingEnabled(search) {
  const query =
    search ??
    (typeof window === 'undefined' ? '' : window.location?.search ?? '');
  const parameters = new URLSearchParams(query);
  const requested = parameters.get('post');

  if (requested === 'on' || requested === '1' || requested === 'true') {
    return true;
  }
  if (requested === 'off' || requested === '0' || requested === 'false') {
    return false;
  }
  return !parameters.has('qa');
}

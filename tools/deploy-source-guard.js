function requireCommitSha(value, label) {
  const sha = String(value ?? '').trim();
  if (sha === '') throw new Error(`${label} commit SHA cannot be empty.`);
  return sha;
}

export function assertDeploySourceMatchesCheckout({
  sourceSha,
  headSha,
  workingTreeStatus,
}) {
  const source = requireCommitSha(sourceSha, 'Remote source');
  const head = requireCommitSha(headSha, 'Local HEAD');

  if (String(workingTreeStatus ?? '').trim() !== '') {
    throw new Error(
      'Deployment requires a clean working tree so the deployment tooling matches the source being published.',
    );
  }

  if (head !== source) {
    throw new Error(
      `Deployment requires local HEAD ${head} to match fetched source ${source}. Update the checkout before publishing.`,
    );
  }
}

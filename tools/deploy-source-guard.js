export const ALLOW_UNVERIFIED_SOURCE_FLAG = '--allow-unverified-source';

function requireCommitSha(value, label) {
  const sha = String(value ?? '').trim();
  if (sha === '') throw new Error(`${label} commit SHA cannot be empty.`);
  return sha;
}

export function parseDeployOptions(args = []) {
  const unknown = args.filter((arg) => arg !== ALLOW_UNVERIFIED_SOURCE_FLAG);
  if (unknown.length > 0) {
    throw new Error(`Unknown deployment option: ${unknown.join(', ')}`);
  }

  return Object.freeze({
    requireVerifiedSource: !args.includes(ALLOW_UNVERIFIED_SOURCE_FLAG),
  });
}

export function assertVerifiedDeploySource({
  sourceSha,
  headSha,
  workingTreeStatus,
}) {
  const source = requireCommitSha(sourceSha, 'Remote source');
  const head = requireCommitSha(headSha, 'Local HEAD');

  if (String(workingTreeStatus ?? '').trim() !== '') {
    throw new Error(
      'Verified deployment requires a clean working tree. Commit or discard local changes, run verification again, then deploy.',
    );
  }

  if (head !== source) {
    throw new Error(
      `Verified deployment requires local HEAD ${head} to match fetched source ${source}. Update the checkout, run verification again, then deploy.`,
    );
  }
}

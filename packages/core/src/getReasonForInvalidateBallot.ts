import type { BallotFileFormat, VoteFileFormat } from "./parser";

export function getReasonForInvalidateBallot(
  ballotFile: BallotFileFormat,
  voteFile: VoteFileFormat,
  author?: string,
): null | {
  invalidChecksum?: { expected: string; actual: string };
  missingAuthor?: true;
  missingCandidates?: VoteFileFormat["candidates"];
  candidatesWithInvalidScores?: BallotFileFormat["preferences"];
} {
  let reason = null;
  if (ballotFile.poolChecksum !== voteFile.checksum) {
    (reason ??= {}).invalidChecksum = {
      expected: voteFile.checksum,
      actual: ballotFile.poolChecksum,
    };
  }
  if (!author && !ballotFile.author) {
    (reason ??= {}).missingAuthor = true;
  }
  const missingCandidates = voteFile.candidates.filter(
    candidate =>
      !ballotFile.preferences.some(
        preference => candidate === preference.title,
      ),
  );
  if (missingCandidates.length) {
    (reason ??= {}).missingCandidates = missingCandidates;
  }
  const candidatesWithInvalidScores = ballotFile.preferences.filter(
    preference =>
      !Number.isSafeInteger(preference.score),
  );
  if (candidatesWithInvalidScores.length) {
    (reason ??= {}).candidatesWithInvalidScores = candidatesWithInvalidScores;
  }
  return reason;
}

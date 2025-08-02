import * as yaml from "js-yaml";
import {
  getSummarizedBallot as _getSummarizedBallot,
  summarizeCondorcetBallotForVoter,
} from "@node-core/caritat/summary/condorcet";
import {
  getReasonForInvalidateBallot,
} from "@node-core/caritat/getReasonForInvalidateBallot";
import type { BallotFileFormat, VoteFileFormat } from "@node-core/caritat/parser";

export function getSummarizedBallot(ballotStr: string, voteFileString?: string) {
  const ballot = yaml.load(ballotStr) as { preferences: Array<{ title: string; score: number }> };
  if (!Array.isArray(ballot?.preferences)) {
    throw new Error("Ballot does not contain a list of preferences");
  }
  const invalidityReason = voteFileString && getReasonForInvalidateBallot(ballot as BallotFileFormat, yaml.load(voteFileString) as VoteFileFormat);
  return [summarizeCondorcetBallotForVoter(
    _getSummarizedBallot({
      voter: {},
      preferences: ballot.preferences.map(({ title, score }) => [title, score]),
    }),
  ), invalidityReason];
}

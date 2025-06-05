import * as yaml from "js-yaml";
import {
  getSummarizedBallot as _getSummarizedBallot,
  summarizeCondorcetBallotForVoter,
} from "@node-core/caritat/summary/condorcet";

export function getSummarizedBallot(ballotStr: string) {
  const ballot = yaml.load(ballotStr) as { preferences: Array<{title: string, score: number}> };
  return summarizeCondorcetBallotForVoter(
    _getSummarizedBallot({
      voter: {},
      preferences: ballot.preferences.map(({title, score}) => [title, score]),
    })
  );
}

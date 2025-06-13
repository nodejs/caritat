import type { ElectionSummaryOptions } from "../summary/electionSummary.ts";
import type { Actor, Ballot, VoteCandidate } from "../vote.ts";
import VoteResult from "./VoteResult.ts";
import type { CandidateScores } from "./VotingMethodImplementation.ts";

export default class SingleRoundResult extends VoteResult {
  #result: CandidateScores;

  constructor(
    authorizedVoters: Actor[],
    candidates: VoteCandidate[],
    subject: string,
    votes: Ballot[],
    options: Partial<ElectionSummaryOptions>
  ) {
    super(authorizedVoters, candidates, subject, votes, options);

    this.#result = new Map(
      candidates.map((candidate) => [
        candidate,
        votes.filter(
          (ballot) =>
            Math.max(...ballot.preferences.values()) ===
            ballot.preferences.get(candidate)
        ).length,
      ])
    );
  }
  get result() {
    return this.#result;
  }
}

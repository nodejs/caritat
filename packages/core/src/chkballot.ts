import { loadYmlFile } from "./parser.js";
import { getReasonForInvalidateBallot } from "./getReasonForInvalidateBallot.js";
import type { BallotFileFormat, VoteFileFormat } from "./parser";

function main(argv: string[]): void {
  const ballotPath = argv[2];
  const votePath = argv[3];

  const voteFile = loadYmlFile<VoteFileFormat>(votePath);

  const ballotFile: BallotFileFormat = loadYmlFile<BallotFileFormat>(ballotPath);
  if (getReasonForInvalidateBallot(ballotFile, voteFile) == null) {
    console.log("valid");
    process.exit(0);
  } else {
    console.log("invalid");
    process.exit(-1);
  }
}

main(process.argv);

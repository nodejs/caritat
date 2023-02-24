#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";

import runChildProcessAsync from "./utils/runChildProcessAsync.js";
import streamChildProcessStdout from "./utils/streamChildProcessStdout.js";
 
import decryptData from "@aduh95/caritat-crypto/decrypt";
import reconstructSplitKey from "@aduh95/caritat-crypto/reconstructSplitKey";
import type { VoteCommit } from "./vote.js";
import Vote from "./vote.js";
import { DiscardedCommit } from "./summary/electionSummary.js";
import type VoteResult from "./votingMethods/VoteResult.js";

// TODO To avoid lf/crlf issues:
//  get the current values
//    git config --global --get core.eol
//    git config --global --get core.autocrlf
//  set to lf only
//    git config --global core.eol lf
//    git config --global core.autocrlf false
//  then reset to the current values


async function openSummaryFile(root) {
  const date = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
    try {
      // TODO: `votes/` path should not be hardcoded.
      const filepath = path.join(root, "votes", `${date}-${i}.json`);
      const fd = await fs.open(filepath, "wx");
      return { fd, filepath };
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  }

  throw new Error("Could not create summary file");
}



async function readFileAtRevision(
  GIT_BIN: string,
  revision: string,
  filePath: string,
  spawnArgs: any
) {
  return await runChildProcessAsync(
    GIT_BIN,
    ["--no-pager", "show", `${revision}:${filePath}`],
    { captureStdout: true, spawnArgs }
  );
}

export default async function countFromGit({
  GIT_BIN,
  cwd,
  repoUrl,
  branch,
  subPath,
  privateKey,
  keyParts,
  firstCommitSha,
  mailmap,
  commitJsonSummary,
  doNotCleanTempFiles,
}): Promise<{ result: VoteResult; privateKey: Buffer }> {
  const spawnArgs = { cwd };

  console.error("Cloning remote repository...");
  await runChildProcessAsync(
    GIT_BIN,
    ["clone", "--branch", branch, "--no-tags", "--single-branch", repoUrl, "."],
    { spawnArgs }
  );

  const hasVoteFilesBeenTampered = await runChildProcessAsync(
    GIT_BIN,
    [
      "--no-pager",
      "log",
      "--format=%%",
      `${firstCommitSha}..HEAD`,
      "--",
      path.join(subPath, "vote.yml"),
      path.join(subPath, "ballot.yml"),
      path.join(subPath, "public.yml"),
    ],
    { captureStdout: true, spawnArgs }
  );

  if (hasVoteFilesBeenTampered) {
    // TODO: add flag to ignore this exception.
    throw new Error(
      "Some magic files have been tampered with since start of the vote"
    );
  }

  const vote = new Vote();
  vote.loadFromFile(path.join(cwd, subPath, "vote.yml"));

  if (!privateKey) {
    privateKey = await reconstructSplitKey(
      Buffer.from(vote.voteFileData.encryptedPrivateKey, "base64"),
      keyParts?.map((part: string | BufferSource) =>
        typeof part === "string" ? Buffer.from(part, "base64") : part
      )
    );
  }

  if (mailmap != null) {
    await fs.cp(mailmap, path.join(cwd, ".mailmap"));
  }

  const gitLog = streamChildProcessStdout(
    GIT_BIN,
    [
      "--no-pager",
      "log",
      `${firstCommitSha}..HEAD`,
      "--format=///%H %G? %aN <%aE>",
      "--name-only",
    ],
    spawnArgs
  );

  let currentCommit: VoteCommit;
  const discardedCommits: DiscardedCommit[] = [];
  function countCurrentCommit() {
    if (currentCommit == null) return;

    const reason = vote.reasonToDiscardCommit(currentCommit);
    if (reason == null) {
      const { sha, author } = currentCommit;
      decryptPromises.push(
        readFileAtRevision(GIT_BIN, sha, currentCommit.files[0], spawnArgs)
          .then((fileContents) => {
            const { encryptedSecret, data } = JSON.parse(fileContents);
            if (!data || !encryptedSecret) {
              console.warn(
                "Vote file looks invalid, it's probably going to crash",
                {
                  commitInfo: { sha, author },
                  fileContents,
                }
              );
            }
            return decryptData(
              Buffer.from(data, "base64"),
              Buffer.from(encryptedSecret, "base64"),
              privateKey
            );
          })
          .then((data: BufferSource) => {
            vote.addBallotFromBufferSource(data, author);
          })
      );
    } else {
      const discardedCommit = {
        commitInfo: currentCommit,
        reason,
      };
      console.warn("Discarding commit", discardedCommit);
      discardedCommits.push(discardedCommit);
    }
  }

  const decryptPromises = [];
  for await (const line of gitLog) {
    if (line.startsWith("///")) {
      countCurrentCommit();
      currentCommit = {
        sha: line.substr(3, 40),
        signatureStatus: line.charAt(44),
        author: line.slice(46),
        files: [],
      };
    } else if (line !== "") {
      currentCommit?.files.push(line);
    }
  }
  countCurrentCommit();

  await Promise.all(decryptPromises);

  const result = vote.count({ discardedCommits });

  if (commitJsonSummary != null) {
    const signCommits = true; // TODO: make this configurable.

    const { fd, filepath } = await openSummaryFile(cwd);
    try {
      await fd.writeFile(
        JSON.stringify(
          { ...result.toJSON(), ...commitJsonSummary },
          undefined,
          2
        ) + "\n"
      );
    } finally {
      await fd.close();
    }
    await runChildProcessAsync(GIT_BIN, ["add", filepath], { spawnArgs });

    // Remove all vote related files.
    await runChildProcessAsync(GIT_BIN, ["rm", "-rf", subPath], { spawnArgs });

    await runChildProcessAsync(
      GIT_BIN,
      [
        "commit",
        ...(signCommits ? ["-S"] : []),
        "-m",
        `close vote and aggregate results`,
      ],
      {
        spawnArgs,
      }
    );

    console.log("Pushing to the remote repository...");
    try {
      await runChildProcessAsync(GIT_BIN, ["push", repoUrl, `HEAD:${branch}`], {
        spawnArgs,
      });
    } catch {
      console.log(
        "Pushing failed, maybe because the local branch is outdated. Attempting a rebase..."
      );
      await runChildProcessAsync(GIT_BIN, ["fetch", repoUrl, branch], {
        spawnArgs,
      });
      await runChildProcessAsync(GIT_BIN, ["reset", "--hard"], {
        spawnArgs,
      });
      await runChildProcessAsync(
        GIT_BIN,
        ["rebase", "FETCH_HEAD", ...(signCommits ? ["-S"] : []), "--quiet"],
        {
          spawnArgs,
        }
      );

      console.log("Pushing to the remote repository...");
      await runChildProcessAsync(GIT_BIN, ["push", repoUrl, `HEAD:${branch}`], {
        spawnArgs,
      });
    }
  }

  if (doNotCleanTempFiles) {
    console.info("The temp folder was not removed from the file system", cwd);
  } else {
    await fs.rm(cwd, { recursive: true, force: true });
  }

  return { result, privateKey };
}

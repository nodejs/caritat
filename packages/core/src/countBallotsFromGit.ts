#!/usr/bin/env node

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { SpawnOptions } from "child_process";

import runChildProcessAsync from "./utils/runChildProcessAsync.js";
import streamChildProcessStdout from "./utils/streamChildProcessStdout.js";

import decryptData from "@node-core/caritat-crypto/decrypt";
import reconstructSplitKey from "@node-core/caritat-crypto/reconstructSplitKey";
import type { VoteCommit } from "./vote.js";
import Vote from "./vote.js";
import type { DiscardedCommit } from "./summary/electionSummary.js";
import type VoteResult from "./votingMethods/VoteResult.js";
import { getGPGSignGitFlag } from "./utils/gpgSign.js";

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
  spawnArgs: SpawnOptions,
) {
  return await runChildProcessAsync(
    GIT_BIN,
    ["--no-pager", "show", `${revision}:${filePath}`],
    { captureStdout: true, spawnArgs },
  );
}

interface countFromGitArgs<T extends BufferSource> {
  GIT_BIN?: string;
  cwd: string;
  repoURL: string;
  branch: string;
  subPath: string;
  privateKey?: T;
  keyParts: string[];
  firstCommitRef: string;
  lastCommitRef?: string;
  mailmap: string;
  commitJsonSummary: { refs: string[] } | null;
  pushToRemote?: boolean;
  gpgSign?: boolean | string;
  doNotCleanTempFiles: boolean;
}

export default async function countFromGit<T extends BufferSource = BufferSource>({
  GIT_BIN = "git",
  cwd,
  repoURL,
  branch,
  subPath,
  privateKey,
  keyParts,
  firstCommitRef,
  lastCommitRef = "HEAD",
  mailmap,
  commitJsonSummary,
  pushToRemote = true,
  gpgSign,
  doNotCleanTempFiles,
}: countFromGitArgs<T>): Promise<{
    result: VoteResult;
    privateKey: T;
    readonly privateKeyAsArmoredString: string;
  }> {
  const spawnArgs = { cwd };

  let hasCreatedTempFiles = false;
  if (!existsSync(path.join(cwd, ".git"))) {
    console.error("Cloning remote repository...");
    await runChildProcessAsync(
      GIT_BIN,
      [
        "clone",
        "--branch",
        branch,
        "--no-tags",
        "--single-branch",
        repoURL,
        ".",
      ],
      { spawnArgs },
    );
    hasCreatedTempFiles = true;
  }

  const voteFile = path.join(subPath, "vote.yml");
  const hasVoteFilesBeenTampered = await runChildProcessAsync(
    GIT_BIN,
    [
      "--no-pager",
      "log",
      "--format=%%",
      `${firstCommitRef}..${lastCommitRef}`,
      "--",
      voteFile,
      path.join(subPath, "ballot.yml"),
      path.join(subPath, "public.yml"),
    ],
    { captureStdout: true, spawnArgs },
  );

  if (hasVoteFilesBeenTampered) {
    // TODO: add flag to ignore this exception.
    throw new Error(
      "Some magic files have been tampered with since start of the vote",
    );
  }

  const vote = new Vote();
  vote.loadFromString(
    await runChildProcessAsync(
      GIT_BIN,
      ["show", `${firstCommitRef}:${voteFile}`],
      { captureStdout: true, trimOutput: false, spawnArgs },
    ),
  );

  if (!privateKey) {
    privateKey = await reconstructSplitKey(
      Buffer.from(vote.voteFileData.encryptedPrivateKey, "base64"),
      keyParts?.map((part: string | BufferSource) =>
        typeof part === "string" ? Buffer.from(part, "base64") : part,
      ),
    ) as T;
  }

  if (mailmap != null) {
    const target = path.join(cwd, ".mailmap");
    if (existsSync(target)) {
      await fs.appendFile(target, await fs.readFile(mailmap));
    } else {
      await fs.cp(mailmap, target);
    }
  }

  const gitLog = streamChildProcessStdout(
    GIT_BIN,
    [
      "--no-pager",
      "log",
      `${firstCommitRef}..${lastCommitRef}`,
      "--format=///%H %G? %aN <%aE>",
      "--name-only",
    ],
    spawnArgs,
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
                },
              );
            }
            return decryptData(
              Buffer.from(data, "base64"),
              Buffer.from(encryptedSecret, "base64"),
              privateKey,
            );
          })
          .then((data: BufferSource) => {
            vote.addBallotFromBufferSource(data, author);
          }),
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

  const result = vote.count({ discardedCommits, keepOnlyFirstLineInSummary: vote.voteFileData.keepOnlyFirstLineInSummary });

  if (commitJsonSummary != null) {
    if (lastCommitRef !== "HEAD") {
      const refs = Promise.all([
        runChildProcessAsync(GIT_BIN, ["rev-parse", "HEAD"], {
          spawnArgs,
          captureStdout: true,
        }),
        runChildProcessAsync(GIT_BIN, ["rev-parse", lastCommitRef], {
          spawnArgs,
          captureStdout: true,
        }),
      ]);
      if (refs[0] !== refs[1]) {
        throw new Error(
          "Cannot commit JSON summary if not on top of the vote branch",
        );
      }
    }

    const { fd, filepath } = await openSummaryFile(cwd);
    try {
      await fd.writeFile(
        JSON.stringify(
          { ...result.toJSON(), ...commitJsonSummary },
          undefined,
          2,
        ) + "\n",
      );
    } finally {
      await fd.close();
    }

    // Remove all vote related files.
    await runChildProcessAsync(
      GIT_BIN,
      [
        "restore",
        "--source",
        `${firstCommitRef}^`,
        "--staged",
        "--worktree",
        "--",
        ".",
      ],
      { spawnArgs },
    );

    await runChildProcessAsync(GIT_BIN, ["add", filepath], { spawnArgs });

    await runChildProcessAsync(
      GIT_BIN,
      [
        "commit",
        "-n",
        ...getGPGSignGitFlag(gpgSign),
        "-m",
        `close vote and aggregate results`,
      ],
      {
        spawnArgs,
      },
    );

    if (pushToRemote) {
      console.log("Pushing to the remote repository...");
      try {
        await runChildProcessAsync(
          GIT_BIN,
          ["push", repoURL, `HEAD:${branch}`],
          {
            spawnArgs,
          },
        );
      } catch {
        console.log(
          "Pushing failed, maybe because the local branch is outdated. Attempting a rebase...",
        );
        await runChildProcessAsync(GIT_BIN, ["fetch", repoURL, branch], {
          spawnArgs,
        });
        await runChildProcessAsync(GIT_BIN, ["reset", "--hard"], {
          spawnArgs,
        });
        await runChildProcessAsync(
          GIT_BIN,
          ["rebase", "FETCH_HEAD", ...getGPGSignGitFlag(gpgSign), "--quiet"],
          { spawnArgs },
        );

        console.log("Pushing to the remote repository...");
        await runChildProcessAsync(
          GIT_BIN,
          ["push", repoURL, `HEAD:${branch}`],
          { spawnArgs },
        );
      }
    }
  }

  if (hasCreatedTempFiles && doNotCleanTempFiles) {
    console.info("The temp folder was not removed from the file system", cwd);
  } else if (hasCreatedTempFiles) {
    await fs.rm(cwd, { recursive: true, force: true });
  }

  return {
    result,
    privateKey,
    get privateKeyAsArmoredString() {
      const base64Key = Buffer.from(privateKey as ArrayBuffer).toString("base64");
      let key = "-----BEGIN PRIVATE KEY-----\n";
      for (let i = 0; i < base64Key.length; i += 64) {
        key += base64Key.slice(i, i + 60) + "\n";
      }
      return key + "-----END PRIVATE KEY-----";
    },
  };
}

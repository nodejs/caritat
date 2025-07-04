const githubPRUrlPattern = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;
const startCandidateList = /\npreferences:[^\n\S]*(#[^\n]*)?\n/;

const fetch2JSON = (response: Awaited<ReturnType<typeof fetch>>) =>
  response.ok
    ? response.json()
    : Promise.reject(
        new Error(`Fetch error: ${response.status} ${response.statusText}`, {
          cause: response,
        }),
      );

const branchInfoCache = new Map();
async function fetchVoteFilesInfo(
  url: string | URL,
  fetchOptions: Parameters<typeof fetch>[1],
) {
  const prUrl = new URL(url as string);
  if (prUrl.origin !== "https://github.com") {
    throw new Error(
      "Only GitHub PR URLs are supported on the web UI. Use the CLI instead.",
    );
  }
  const prUrlMatch = githubPRUrlPattern.exec(prUrl.pathname);
  if (prUrlMatch == null) {
    throw new Error(
      "Only GitHub PR URLs are supported on the web UI. Use the CLI instead.",
    );
  }
  const [, owner, repo, number] = prUrlMatch;

  let data;
  // @ts-expect-error `headers` is provided by us as an object
  if (fetchOptions?.headers?.Authorization) {
    const graphQLData = await fetch(`https://api.github.com/graphql`, {
      ...fetchOptions,
      method: "POST",
      body: JSON.stringify({
        variables: { prid: Number(number), owner, repo },
        query: `query PR($prid: Int!, $owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prid) {
            commits(first: 1) {
              nodes {
                commit {
                  oid
                }
              }
            }
            headRef {
              name
              repository { url }
            }
            closed
            merged
          }
        }
      }\n`,
      }),
    }).then(fetch2JSON);

    if (graphQLData.error) {
      throw new Error("Unable to get required information for the vote PR", {
        cause: graphQLData.error,
      });
    }

    data = graphQLData.data.repository.pullRequest;
  } else {
    // GraphQL requires authenticated calls, we have to fallback to the REST API:
    const restData = await Promise.all([
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        fetchOptions,
      ).then(fetch2JSON),
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/commits?per_page=1`,
        fetchOptions,
      ).then(fetch2JSON),
    ]);

    data = {
      closed: restData[0].state === "closed",
      merged: restData[0].state === "merged",
      headRef: {
        name: restData[0].head.ref,
        repository: { url: restData[0].head.repo.html_url },
      },
      commits: { nodes: [{ commit: { oid: restData[1][0].sha } }] },
    };
  }

  const { closed, merged, commits, headRef } = data;

  if (closed) {
    throw new Error("The PR is marked as closed");
  }

  if (merged) {
    throw new Error("The PR is marked as merged");
  }

  const { oid: initVoteCommit } = commits.nodes[0].commit;
  const {
    name: headRefName,
    repository: { url: headRefURL },
  } = headRef;

  const { files } = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${initVoteCommit}`,
    fetchOptions,
  ).then(fetch2JSON);

  if (files?.length !== 3) {
    throw new Error("That PR does not look like a vote PR");
  }

  const voteFile = files.find(
    file =>
      file.filename === "vote.yml" || file.filename.endsWith("/vote.yml"),
  );
  const ballotFile = files.find(
    file =>
      file.filename
      === voteFile.filename.slice(0, -"vote.yml".length) + "ballot.yml",
  );
  const publicKeyFile = files.find(
    file =>
      file.filename
      === voteFile.filename.slice(0, -"vote.yml".length) + "public.pem",
  );

  if (!voteFile || !ballotFile || !publicKeyFile) {
    throw new Error("That PR does not look like a vote PR");
  }

  branchInfoCache.set(
    url,
    // Any where in the tree would do, but sticking to the same subfolder as the
    // vote.yml file is "cleaner".
    `${headRefURL}/new/${headRefName}/${voteFile.filename.replace(
      /vote\.yml$/,
      "",
    )}`,
  );

  return { voteFile, ballotFile, publicKeyFile };
}

export function fetchNewVoteFileURL(url: string | URL) {
  return branchInfoCache.get(url);
}

/** * Fisher-Yates shuffle */
function shuffle<T>(array: Array<T>): Array<T> {
  let currentIndex = array.length,
    randomIndex: number;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

async function act(
  url: string | URL,
  fetchOptions?: Parameters<typeof fetch>[1],
) {
  const contentsFetchOptions = {
    ...fetchOptions,
    headers: {
      ...fetchOptions?.headers,
      Accept: "application/vnd.github.raw",
    },
  };
  try {
    const { voteFile, ballotFile, publicKeyFile } = await fetchVoteFilesInfo(
      url as string,
      fetchOptions,
    );

    // This won't catch all the cases (if the PR modifies an existing file
    // rather than creating a new one, or if the YAML is formatted differently),
    // but it saves us from doing another request so deemed worth it.
    const shouldShuffleCandidates = /^\+canShuffleCandidates:\s*true$/m.test(
      voteFile.patch,
    );

    return [
      fetch(ballotFile.contents_url, contentsFetchOptions)
        .then(response =>
          response.ok
            ? response.text()
            : Promise.reject(
                new Error(
                  `Fetch error: ${response.status} ${response.statusText}`,
                ),
              ),
        )
        .then(
          shouldShuffleCandidates
            ? (ballotData) => {
                const match = startCandidateList.exec(ballotData);
                if (match == null) {
                  console.warn(
                    "Cannot find the list of candidates to shuffle, ignoring...",
                  );
                  return ballotData;
                }
                const headerEnd = match.index + match[0].length - 1;

                const candidates = [];
                let currentCandidate: string;
                let lineStart;
                let lineEnd = headerEnd;
                for (;;) {
                  lineStart = lineEnd + 1;
                  lineEnd = ballotData.indexOf("\n", lineStart);
                  if (lineEnd === lineStart) {
                    currentCandidate += "\n";
                    continue;
                  }
                  if (lineEnd === -1) {
                    if (lineStart !== ballotData.length) {
                      currentCandidate += ballotData.slice(lineStart - 1);
                    }
                    break;
                  }
                  if (
                    ballotData[lineStart] !== " "
                    || ballotData[lineStart + 1] !== " "
                  )
                    break;
                  if (ballotData[lineStart + 2] === "-") {
                    if (currentCandidate) candidates.push(currentCandidate);
                    currentCandidate = "";
                  }
                  currentCandidate += ballotData.slice(lineStart - 1, lineEnd);
                }
                if (currentCandidate) candidates.push(currentCandidate);
                return (
                  ballotData.slice(0, headerEnd)
                  + shuffle(candidates).join("")
                  + "\n"
                  + ballotData.slice(lineStart)
                );
              }
            : undefined,
        ),
      fetch(publicKeyFile.contents_url, contentsFetchOptions).then(response =>
        response.ok
          ? response.arrayBuffer()
          : Promise.reject(
              new Error(
                `Fetch error: ${response.status} ${response.statusText}`,
              ),
            ),
      ),
    ] as [Promise<string>, Promise<ArrayBuffer>];
  } catch (err) {
    const error = Promise.reject(err);
    return [error, error] as [never, never];
  }
}

let previousURL: string | null;
export default function fetchFromGitHub(
  { url, username, token }: { url: string; username?: string; token?: string },
  callback: (
    errOfResult: [Promise<string>, Promise<ArrayBuffer>]
  ) => void | Promise<void>,
) {
  const options
    = username && token
      ? {
          headers: {
            Authorization: `Basic ${btoa(`${username}:${token}`)}`,
          },
        }
      : undefined;
  const serializedURL = url + options?.headers.Authorization;
  if (previousURL === serializedURL) return;
  previousURL = serializedURL;

  act(url, options).then(callback, (err) => {
    previousURL = null;
    return callback(err);
  });
}

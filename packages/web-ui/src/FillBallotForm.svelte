<script lang="ts">
  import { beforeUpdate } from "svelte";

  import encryptData from "@node-core/caritat-crypto/encrypt";
  import uint8ArrayToBase64 from "./uint8ArrayToBase64.ts";
  import fetchFromGitHub from "./fetchDataFromGitHub.ts";

  import type { VoteFileFormat } from "@node-core/caritat/parser";
  import { templateBallot } from "@node-core/caritat/parser";
  import {
    getSummarizedBallot,
    summarizeCondorcetBallotForVoter,
  } from "@node-core/caritat/summary/condorcet";

  export let url, username, token, registerEncryptedBallot;

  let fetchedVoteConfig: Promise<VoteFileFormat>;

  const textEncoder =
    typeof TextEncoder === "undefined" ? { encode() {} } : new TextEncoder();

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();
    registerEncryptedBallot(
      (async () => {
        const voteConfig = await fetchedVoteConfig;
        const preferences = new Map(
          voteConfig.candidates.map((candidate) => [
            candidate,
            Number(
              (this.elements.namedItem(candidate) as HTMLInputElement).value
            ),
          ])
        );
        const ballot = templateBallot(voteConfig, undefined, preferences);
        const summary = summarizeCondorcetBallotForVoter(
          getSummarizedBallot({ voter: {}, preferences })
        );

        if (!confirm(summary)) throw new Error("Aborted by user");

        const { encryptedSecret, saltedCiphertext } = await encryptData(
          textEncoder.encode(ballot) as Uint8Array,
          voteConfig.publicKey
        );
        return JSON.stringify({
          encryptedSecret: uint8ArrayToBase64(new Uint8Array(encryptedSecret)),
          data: uint8ArrayToBase64(saltedCiphertext),
        });
      })()
    );
  }

  fetchedVoteConfig = Promise.reject("no data");
  beforeUpdate(() => {
    fetchFromGitHub({ url, username, token }, (errOfResult) => {
      fetchedVoteConfig = errOfResult;
    });
  });
</script>

<summary>Fill in ballot</summary>

{#await fetchedVoteConfig}
  <p>...loading as {username || "anonymous"}</p>
{:then voteConfig}
  <form on:submit={onSubmit}>
    <ul>
      {#each voteConfig.imageCandidates ?? [] as candidate}
        <li>
          <img src={candidate.src} alt={candidate.alt} /><label
            >Score: <input
              type="number"
              value="0"
              name={candidate.raw}
            /></label
          >
        </li>
      {/each}
    </ul>
    <button type="submit">Generate ballot</button>
  </form>
{:catch error}
  <p>
    An error occurred: {error?.message ?? error}
  </p>

  {#if !token || !username}
    <p>
      Maybe consider providing an access token, authenticated API calls are more
      likely to succeed.
    </p>
  {/if}
{/await}

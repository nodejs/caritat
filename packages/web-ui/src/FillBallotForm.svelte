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

  function onClick(this: HTMLImageElement, event: MouseEvent) {
    (this.nextElementSibling.lastElementChild as HTMLInputElement).focus();
  }
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
          getSummarizedBallot({
            voter: {},
            preferences: new Map(
              voteConfig.imageCandidates.map((c) =>
                typeof c === "string"
                  ? [c, preferences.get(c)]
                  : [c.alt, preferences.get(c.raw)]
              )
            ),
          })
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
      {#each voteConfig.imageCandidates ?? voteConfig.candidates ?? [] as candidate}
        <li>
          {#if typeof candidate === "string"}
            {candidate}
          {:else}
            <img src={candidate.src} alt={candidate.alt} on:click={onClick} />
          {/if}
          <label
            >Score: <input
              type="number"
              value="0"
              name={typeof candidate === "string" ? candidate : candidate.raw}
            /></label
          >
        </li>
      {/each}
    </ul>
    <button type="submit">Generate encrypted ballot</button>
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

<style>
  ul {
    display: flex;
    list-style: none;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0;
    margin: 0 0 1rem;
  }

  ul > li {
    max-width: 240px;
    display: flex;
    flex-direction: column;
  }
</style>

<script lang="ts">
  import { beforeUpdate } from "svelte";

  import fetchFromGitHub from "./fetchDataFromGitHub.ts";

  export let url, username, token, registerBallot;

  let fetchedBallot: Promise<string>, fetchedPublicKey;

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();
    const textarea = this.elements.namedItem("ballot") as HTMLInputElement;
    registerBallot(textarea.value, fetchedPublicKey);
  }

  fetchedBallot = fetchedPublicKey = Promise.reject("no data");
  beforeUpdate(() => {
    fetchFromGitHub({ url, username, token }, (errOfResult) => {
      [fetchedBallot, fetchedPublicKey] = errOfResult;
    });
  });
</script>

<summary>Fill in ballot</summary>

{#await fetchedBallot}
  <p>...loading as {username || "anonymous"}</p>
{:then ballotPlainText}
  <form on:submit={onSubmit}>
    <textarea name="ballot">{ballotPlainText}</textarea>
    {#await fetchedPublicKey}
      <button type="submit" disabled>Loading public key…</button>
    {:then}
      <button type="submit">Encrypt ballot</button>
    {/await}
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

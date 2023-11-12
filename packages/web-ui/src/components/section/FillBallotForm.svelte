<script lang="ts">
  import { beforeUpdate } from "svelte";
  import TextBox from "../common/textbox/index.svelte";
  import Button from "../common/button/index.svelte";

  import encryptData from "@node-core/caritat-crypto/encrypt";
  import uint8ArrayToBase64 from "../../uint8ArrayToBase64.ts";
  import fetchFromGitHub from "../../fetchDataFromGitHub.ts";

  export let url, username, token, registerEncryptedBallot;

  let fetchedBallot: Promise<string>, fetchedPublicKey;

  const textEncoder =
    typeof TextEncoder === "undefined" ? { encode() {} } : new TextEncoder();

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();
    const textarea = this.elements.namedItem("ballot") as HTMLInputElement;
    registerEncryptedBallot(
      (async () => {
        const { encryptedSecret, saltedCiphertext } = await encryptData(
          textEncoder.encode(textarea.value) as Uint8Array,
          await fetchedPublicKey
        );
        return JSON.stringify({
          encryptedSecret: uint8ArrayToBase64(new Uint8Array(encryptedSecret)),
          data: uint8ArrayToBase64(saltedCiphertext),
        });
      })()
    );
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
  <TextBox>
    ...loading as {username || "anonymous"}
  </TextBox>
{:then ballotPlainText}
  <form class="flex flex-row justify-between items-center p-2">
    <textarea name="ballot">{ballotPlainText}</textarea>
    {#await fetchedPublicKey}
      <Button onClick={onSubmit} type="submit" disabled>Loading public key…</Button>
    {:then}
      <Button onClick={onSubmit}  type="submit">Encrypt ballot</Button>
    {/await}
  </form>
{:catch error}
  <TextBox variant="error">
    An error occurred: {error?.message ?? error}
  </TextBox>
  {#if !token || !username}
    <TextBox variant="info">
      Maybe consider providing an access token, authenticated API calls are more
      likely to succeed.
    </TextBox>
  {/if}
{/await}

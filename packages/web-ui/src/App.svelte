<script lang="ts">
  import BallotSummary from "./BallotSummary.svelte";
  import CopyEncryptedBallotForm from "./CopyEncryptedBallotForm.svelte";
  import FillBallotForm from "./FillBallotForm.svelte";
  import GitHubCredentials from "./GitHubCredentials.svelte";
  import FindPrForm from "./FindPRForm.svelte";

  import encryptData from "@node-core/caritat-crypto/encrypt";
  import uint8ArrayToBase64 from "./uint8ArrayToBase64.ts";
  const textEncoder =
    typeof TextEncoder === "undefined" ? { encode() {} } : new TextEncoder();

  let ballot: string | undefined;
  let encryptDataPromise = new Promise<never>(() => {});
  let shouldSummarize = false;
  let ballotSummary = new Promise<never>(() => {});

  let url = globalThis.location?.hash.slice(1);

  let username = "",
    token = "";
  function updateAuth(u: string, t: string) {
    username = u;
    token = t;
  }

  let step = url ? 1 : 0;

  addEventListener("hashchange", () => {
    url = globalThis.location?.hash.slice(1);

    step = url ? Math.max(step, 1) : 0;
  });

  function maybeUpdateSummary() {
    ballotSummary = shouldSummarize && ballot ? (async () => {
      // Lazy-loading as the summary is only a nice-to-have.
      const { getSummarizedBallot } = await import("./ballotSummary.ts");
      return getSummarizedBallot(ballot);
    })() : new Promise<never>(() => {});
  }
  function registerBallot(ballotContent, publicKey) {
    encryptDataPromise = (async () => {
        const { encryptedSecret, saltedCiphertext } = await encryptData(
          textEncoder.encode(ballotContent) as Uint8Array,
          await publicKey
        );
        return JSON.stringify({
          encryptedSecret: uint8ArrayToBase64(new Uint8Array(encryptedSecret)),
          data: uint8ArrayToBase64(saltedCiphertext),
        });
      })();
    ballot = ballotContent;
    step = 2;
    maybeUpdateSummary();
  }

  function onSummaryToggle(e) {
    shouldSummarize = e.newState === 'open';
    maybeUpdateSummary();
  }
</script>

<h1>Caritat</h1>

<details>
  <GitHubCredentials {updateAuth} {username} {token} />
</details>

<hr />

<details open={step === 0}>
  <FindPrForm {url} />
</details>
<details open={step === 1}>
  <FillBallotForm {url} {username} {token} {registerBallot} />
</details>
<details open={shouldSummarize} on:toggle={onSummaryToggle}>
  <BallotSummary {ballotSummary} />
</details>
<details open={step === 2}>
  <CopyEncryptedBallotForm {ballot} {encryptDataPromise} {url} />
</details>

<script lang="ts">
  import CopyEncryptedBallotForm from "./CopyEncryptedBallotForm.svelte";
  import FillBallotForm from "./FillBallotForm.svelte";
  import GitHubCredentials from "./GitHubCredentials.svelte";
  import FindPrForm from "./FindPRForm.svelte";

  let encryptDataPromise = new Promise(() => {}) as Promise<never>;

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

  function registerEncryptedBallot(promise) {
    encryptDataPromise = promise;
    promise.then(
      () => {
        step = 2;
      },
      () => {
        step = Math.min(step, 1);
      }
    );
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
  <FillBallotForm {url} {username} {token} {registerEncryptedBallot} />
</details>
<details open={step === 2}>
  <CopyEncryptedBallotForm {encryptDataPromise} {url} />
</details>

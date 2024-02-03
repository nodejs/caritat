<script lang="ts">
  import Button from "../common/button/index.svelte";

  export let updateAuth, username, token;

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();

    updateAuth(this.username.value, this.token.value);
  }
</script>

<summary>GitHub credentials</summary>

<div class="p-2">
<p>
  If you are trying to vote on a private repository, or hitting GitHub API rate
  limits, you can supply a token for the API calls.
</p>

<form class="flex flex-row justify-between items-center">
    <label class="flex flex-row items-center gap-1">
      Username:
      <input
        class="border border-neutral-400 dark:border-neutral-800 rounded-md p-1"
        name="username"
        value={username}
      />
    </label>
    <label class="flex flex-row items-center gap-1">
      Token:
      <input
        class="border border-neutral-400 dark:border-neutral-800 rounded-md p-1"
        name="token"
        value={token}
        type="password"
        placeholder="gho_…"
      />
    </label>
    <Button onClick={onSubmit} type="submit">Save</Button>
</form>

<p>The token should have at least the <code>repo</code> permissions.</p>

</div>

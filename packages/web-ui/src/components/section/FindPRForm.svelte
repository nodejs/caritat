<script lang="ts">
  import Button from "../common/button/index.svelte"
  export let url;

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();
    globalThis.location.hash = (
      this.elements.namedItem("url") as HTMLInputElement
    ).value;
  }
</script>

<summary>Get URL to load the data</summary>

<form class="flex flex-row justify-between items-center p-2">
    <label class="flex flex-row items-center gap-4">
      URL:
      <input
        class="border border-neutral-400 dark:border-neutral-800 rounded-md p-1"
        type="url"
        value={url}
        name="url"
        />
    </label>
    <Button onClick={onSubmit} type="submit">Load data</Button>
</form>

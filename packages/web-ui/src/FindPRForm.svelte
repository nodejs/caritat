<script lang="ts">
  export let url;

  function onSubmit(this: HTMLFormElement, event: SubmitEvent) {
    event.preventDefault();
    globalThis.location.hash = (
      this.elements.namedItem("url") as HTMLInputElement
    ).value;
  }
</script>

<summary>Get URL to load the data</summary>

<form on:submit={onSubmit}>
    <label
      >URL:
      <input type="url" value={url} name="url" /></label
    >
    <input type="submit" value="Load data" />
</form>

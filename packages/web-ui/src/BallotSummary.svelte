<script lang="ts">
  export let ballotSummary: Promise<string | never>;
</script>

<summary>Ballot summary (requires downloading YAML parser)</summary>

{#await ballotSummary}
  <textarea readonly>Getting summary… </textarea>
{:then data}
  <textarea readonly>{data}</textarea>
{:catch error}
  An error occurred: {error?.message ?? error}
{/await}


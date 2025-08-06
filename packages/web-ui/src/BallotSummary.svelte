<script lang="ts">
  export let ballotSummary: Promise<[string, {
    missingCandidates?: VoteFileFormat["candidates"];
    candidatesWithInvalidScores?: BallotFileFormat["preferences"];
  } | null] | never>;
</script>

<summary>Ballot summary (requires downloading YAML parser)</summary>

{#await ballotSummary}
  <textarea readonly>Getting summary… </textarea>
{:then data}
  {#if data[1]}
  {#if data[1].missingCandidates?.length}
    <details open><summary>Your ballot is missing some candidates</summary>
      <ul>
        {#each data[1].missingCandidates as candidate}
          <li>{candidate}</li>
        {/each}
      </ul>
      <p>Only ballots setting scores for all candidates will be taken into account.</p>
      <p><em>Hint: it could be due to a typo or a failed copy-pasting.</em></p>
      <hr/>
    </details>
  {/if}
  {#if data[1].candidatesWithInvalidScores?.length}
    <details open><summary>Your ballot contains invalid scores</summary>
      <ul>
        {#each data[1].candidatesWithInvalidScores as { title, score }}
          <li>{score} for {title}</li>
        {/each}
      </ul>
      <p>Use only "safe" integers, i.e. values that can be represented as an IEEE-754 double precision number.</p>
      <hr/>
    </details>
  {/if}
  {:else}
      <details open><summary>We failed to check your ballot</summary>
      <p>Something wrong happened when trying to check the ballot validity; it doesn't mean your ballot is invalid, we just can't tell.</p>
      <p><em>Hint: authenticated API calls are more likely to succeed.</em></p>
      <hr/>
    </details>
  {/if}
  <pre>{data[0]}</pre>
{:catch error}
  An error occurred: {console.log(error) ?? error?.message ?? error}
{/await}

<style>
details, pre {
  margin-left: 1rem;
}

details > summary::before {
  content: "⚠️";
}
pre {
  border: 1px solid currentColor;
  padding: 1ch;
}
</style>


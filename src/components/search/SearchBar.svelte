<script lang="ts">
  import { query } from '@/stores/searchStore';

  function handleSubmit(e: Event) {
    e.preventDefault();
    // Re-setting the same value still fires the page-reset listener; the
    // effect is a "re-run this search" signal.
    query.set(query.get());
  }

  function onInput(e: Event) {
    query.set((e.currentTarget as HTMLInputElement).value);
  }

  function clear() {
    query.set('');
  }
</script>

<form class="usa-search usa-search--big" role="search" onsubmit={handleSubmit}>
  <label class="usa-sr-only" for="search-field">Search grant opportunities</label>
  <input
    class="usa-input"
    id="search-field"
    type="search"
    name="search"
    value={$query}
    oninput={onInput}
    placeholder="Search opportunities..."
  />
  {#if $query}
    <button type="button" class="usa-button usa-button--unstyled clear-btn" onclick={clear}>
      Clear
    </button>
  {/if}
  <button class="usa-button" type="submit">
    <span class="usa-search__submit-text">Search</span>
  </button>
</form>

<style>
  .clear-btn {
    margin-right: 0.5rem;
  }
</style>

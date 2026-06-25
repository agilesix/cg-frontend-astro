<script lang="ts">
  import { query } from '@/stores/searchStore';

  // Each query change refetches every source (auto-paginating up to maxItems),
  // so debounce typing instead of firing on every keystroke. The input shows
  // the local value immediately; the store (and thus the fetch) updates after a
  // short pause. Submit and clear apply immediately.
  //
  // Writable $derived: tracks the store (URL hydration, back-nav, clear-all)
  // but can be locally overridden while the user types until the next debounce
  // flushes the value back into the store.
  let value = $derived($query);
  let pending: ReturnType<typeof setTimeout> | undefined;

  function commit(v: string) {
    clearTimeout(pending);
    query.set(v);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    // Re-setting the same value still fires the page-reset listener; the
    // effect is a "re-run this search" signal.
    commit(value);
  }

  function onInput(e: Event) {
    value = (e.currentTarget as HTMLInputElement).value;
    clearTimeout(pending);
    pending = setTimeout(() => query.set(value), 350);
  }

  function clear() {
    value = '';
    commit('');
  }
</script>

<form class="usa-search usa-search--big" role="search" onsubmit={handleSubmit}>
  <label class="usa-sr-only" for="search-field">Search grant opportunities</label>
  <input
    class="usa-input"
    id="search-field"
    type="search"
    name="search"
    {value}
    oninput={onInput}
    placeholder="Search opportunities..."
  />
  {#if value}
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

<script lang="ts">
  interface Props {
    idPrefix: string;
    startLabel?: string;
    endLabel?: string;
    start?: string;
    end?: string;
    onStartChange?: (value: string) => void;
    onEndChange?: (value: string) => void;
  }

  let {
    idPrefix,
    startLabel = 'From',
    endLabel = 'To',
    start = '',
    end = '',
    onStartChange,
    onEndChange,
  }: Props = $props();
</script>

<div class="usa-form-group date-range">
  <div class="date-range__field">
    <label class="usa-label" for="{idPrefix}-start">{startLabel}</label>
    <input
      class="usa-input"
      type="date"
      id="{idPrefix}-start"
      value={start}
      oninput={(e) => onStartChange?.((e.currentTarget as HTMLInputElement).value)}
    />
  </div>
  <div class="date-range__field">
    <label class="usa-label" for="{idPrefix}-end">{endLabel}</label>
    <input
      class="usa-input"
      type="date"
      id="{idPrefix}-end"
      value={end}
      oninput={(e) => onEndChange?.((e.currentTarget as HTMLInputElement).value)}
    />
  </div>
</div>

<style>
  .date-range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
</style>

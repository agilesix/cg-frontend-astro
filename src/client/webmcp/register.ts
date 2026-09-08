export interface SiteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
}
export interface ModelContext {
  registerTool(tool: SiteTool): void | Promise<void>;
  unregisterTool?(name: string): void;
}
export function modelContext(): ModelContext | undefined {
  if (typeof document === 'undefined' || window.top !== window) return undefined;
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  return typeof context?.registerTool === 'function' ? context : undefined;
}
/** Unsupported browsers and failed registration retain normal website functionality. */
export async function registerTools(context: ModelContext | undefined, tools: SiteTool[]) {
  const registered: string[] = [];
  const cleanup = () => {
    for (const name of registered.splice(0)) {
      try {
        context?.unregisterTool?.(name);
      } catch {
        /* Page is being disposed. */
      }
    }
  };
  if (!context) return cleanup;
  try {
    for (const tool of tools) {
      await context.registerTool(tool);
      registered.push(tool.name);
    }
  } catch {
    cleanup();
    console.warn('Site tools unavailable; normal grant search remains available.');
  }
  return cleanup;
}

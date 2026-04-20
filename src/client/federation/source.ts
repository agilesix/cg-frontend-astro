import type { Client } from '@common-grants/sdk/client';
import type { z } from 'zod';

export type SourceId = 'pa' | 'federal';

export interface Source {
  id: SourceId;
  label: string;
  client: Client;
  schema: z.ZodTypeAny;
  enabled: boolean;
}

export type Tagged<T> = T & { _source: SourceId };

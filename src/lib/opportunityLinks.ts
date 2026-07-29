import { asHttpUrl, getByPath } from './format';

export interface OpportunityAttachment {
  href: string;
  label: string;
}

export function getOpportunitySourceUrl(opportunity: unknown): string | null {
  for (const candidate of [
    getByPath(opportunity, 'customFields.waApplicationLinkUrl.value'),
    getByPath(opportunity, 'source'),
  ]) {
    const url = asHttpUrl(candidate);
    if (url) return url;
  }
  return null;
}

export function getOpportunityAttachments(opportunity: unknown): OpportunityAttachment[] {
  const raw =
    getByPath(opportunity, 'customFields.attachments.value') ??
    getByPath(opportunity, 'customFields.paAdditionalResources.value');
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((attachment) => {
    if (attachment == null || typeof attachment !== 'object') return [];
    const value = attachment as Record<string, unknown>;
    const href = asHttpUrl(value.downloadUrl) ?? asHttpUrl(value.url);
    if (!href) return [];
    const label =
      (typeof value.name === 'string' && value.name) ||
      (typeof value.title === 'string' && value.title) ||
      'Attachment';
    return [{ href, label }];
  });
}

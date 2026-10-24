import { createMockGoogleBusinessAdapter } from './googleBusiness.js';
import { createMockWebsiteAdapter } from './website.js';
import { createMockInstagramAdapter } from './instagram.js';

export { createMockGoogleBusinessAdapter, createMockWebsiteAdapter, createMockInstagramAdapter };

export function createMockAdapters() {
  return [createMockGoogleBusinessAdapter(), createMockWebsiteAdapter(), createMockInstagramAdapter()];
}

// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Protocols a link built from dashboard content may use. Everything else (javascript:, data:, vbscript:, ...) is refused.
const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Whether a URL can be used as the href of a link built from dashboard content (dashboard/panel links, table data links).
 * That content can be written by other users than the viewer, and browsers run `javascript:` URLs when the link is clicked
 * (React 18 does not block them). Relative URLs are allowed.
 */
export function isSafeLinkUrl(url: string | undefined): url is string {
  // Persisted dashboards are not validated at runtime, so refuse anything that is not a string instead of throwing.
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  try {
    // The URL parser normalizes the scheme (case, tabs and newlines), like browsers do.
    const { protocol } = new URL(url.trim(), 'http://perses.invalid');
    return SAFE_LINK_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
}

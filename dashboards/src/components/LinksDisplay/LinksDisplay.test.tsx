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

import type * as PluginSystemModule from '@perses-dev/plugin-system';
import type { Link } from '@perses-dev/spec';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LinksDisplay } from './LinksDisplay';

vi.mock('@perses-dev/plugin-system', async (importOriginal) => ({
  ...(await importOriginal<typeof PluginSystemModule>()),
  useReplaceVariablesInString: vi.fn((s: string | undefined) => s),
  useReplaceVariablesInUrl: vi.fn((s: string | undefined) => s),
}));

const safeLinks: Link[] = [{ url: 'https://example.com', name: 'Docs' }];
const unsafeLinks: Link[] = [{ url: 'javascript:void(0)', name: 'Bad' }];
const relativeLinks: Link[] = [{ url: '/projects/p', name: 'Project' }];
const mixedLinks: Link[] = [...safeLinks, ...unsafeLinks];

describe('LinksDisplay', () => {
  describe('dashboard variant', () => {
    it('keeps the href of a safe link', () => {
      render(<LinksDisplay links={safeLinks} variant="dashboard" />);
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com');
    });

    it('renders an unsafe link without its href', () => {
      const { container } = render(<LinksDisplay links={unsafeLinks} variant="dashboard" />);
      expect(screen.getByText('Bad')).toBeInTheDocument();
      expect(container.querySelector('[href^="javascript"]')).toBeNull();
    });
  });

  describe('panel variant', () => {
    it('renders an unsafe single link without any href', () => {
      const { container } = render(<LinksDisplay links={unsafeLinks} variant="panel" />);
      expect(screen.getByRole('button', { name: 'Bad' })).toBeInTheDocument();
      expect(container.querySelector('[href]')).toBeNull();
    });

    it('keeps the href of a relative single link', () => {
      const { container } = render(<LinksDisplay links={relativeLinks} variant="panel" />);
      expect(container.querySelector('a[href="/projects/p"]')).not.toBeNull();
    });
  });

  describe('links menu', () => {
    it('only keeps the href of safe links', async () => {
      render(<LinksDisplay links={mixedLinks} variant="panel" />);
      userEvent.click(screen.getByRole('button', { name: 'Panel-links' }));

      expect(await screen.findByRole('menuitem', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com');
      expect(screen.getByRole('menuitem', { name: 'Bad' })).not.toHaveAttribute('href');
    });
  });
});

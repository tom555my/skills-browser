import { describe, expect, it } from 'bun:test';

import {
  parseSkillFrontmatterAttributes,
  parseSkillMarkdownDocument,
  renderSkillMarkdownToHtml,
} from './skill-markdown';

describe('skill markdown rendering', () => {
  it('renders markdown with Shiki-highlighted code blocks', async () => {
    const html = await renderSkillMarkdownToHtml(
      '# Find Skills\n\n```ts\nconst skill = true;\n```'
    );

    expect(html).toContain('<h1>Find Skills</h1>');
    expect(html).toContain('class="shiki shiki-themes github-light-default github-dark-default"');
    expect(html).toContain('class="language-ts"');
  });

  it('escapes embedded html from skill markdown', async () => {
    const html = await renderSkillMarkdownToHtml('<script>alert("xss")</script>');

    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('splits YAML frontmatter from markdown instructions', () => {
    const document = parseSkillMarkdownDocument(
      '---\nname: find-skills\ndescription: Find installable skills.\n---\n# Find Skills\n\nUse this skill.'
    );

    expect(document).toEqual({
      frontmatter: 'name: find-skills\ndescription: Find installable skills.',
      markdown: '# Find Skills\n\nUse this skill.',
    });
  });

  it('keeps markdown untouched when no frontmatter block is present', () => {
    const document = parseSkillMarkdownDocument('# Find Skills\n\nUse this skill.');

    expect(document).toEqual({
      frontmatter: null,
      markdown: '# Find Skills\n\nUse this skill.',
    });
  });

  it('parses frontmatter attributes for UI display', () => {
    const attributes = parseSkillFrontmatterAttributes(
      [
        'name: find-skills',
        'description: "Find installable skills."',
        'metadata:',
        '  category: discovery',
        '  priority: high',
        'allowed-tools: Bash Read',
      ].join('\n')
    );

    expect(attributes).toEqual([
      {
        name: 'name',
        value: 'find-skills',
      },
      {
        name: 'description',
        value: 'Find installable skills.',
      },
      {
        name: 'metadata',
        value: {
          category: 'discovery',
          priority: 'high',
        },
      },
      {
        name: 'allowed-tools',
        value: 'Bash Read',
      },
    ]);
  });

  it('parses block scalar frontmatter values as their own value', () => {
    const attributes = parseSkillFrontmatterAttributes(
      ['description: |', '  Line one.', '  Line two.'].join('\n')
    );

    expect(attributes).toEqual([
      {
        name: 'description',
        value: 'Line one.\nLine two.',
      },
    ]);
  });

  it('parses arrays of frontmatter objects for table display', () => {
    const attributes = parseSkillFrontmatterAttributes(
      [
        'examples:',
        '  - name: Search',
        '    description: Find matching skills.',
        '  - name: Install',
        '    description: Install selected skills.',
      ].join('\n')
    );

    expect(attributes).toEqual([
      {
        name: 'examples',
        value: [
          {
            name: 'Search',
            description: 'Find matching skills.',
          },
          {
            name: 'Install',
            description: 'Install selected skills.',
          },
        ],
      },
    ]);
  });
});

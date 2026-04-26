import { describe, expect, it } from 'bun:test';

import {
  getSkillsShDetailUrl,
  loadSkillDetailsState,
  parseSkillDetailsHtml,
} from './skill-details-state';

const createHtml = () => {
  return `
    <html>
      <head>
        <meta name="description" content="Install the find-skills skill."/>
        <link rel="canonical" href="https://skills.sh/vercel-labs/skills/find-skills"/>
      </head>
      <body>
        <h1 class="text-4xl">find-skills</h1>
        <code class="truncate"><span>$</span> npx skills add https://github.com/vercel-labs/skills --skill find-skills</code>
        <div>Summary</div><div class="mb-8 rounded-lg"><div><div><p><strong>Find skills.</strong></p><ul><li>Search the ecosystem</li></ul></div></div></div><div class="bg-background">
        <span>SKILL.md</span></div><div><h1>Find Skills</h1><p>Read <a href="https://skills.sh/">more</a>.</p><script>alert(1)</script></div></div></div><div class=" lg:col-span-3">
        <span>Weekly Installs</span></div><div>1.2M</div>
        <span>Repository</span><a href="https://github.com/vercel-labs/skills" title="vercel-labs/skills">vercel-labs/skills</a>
        <span>GitHub Stars</span></div><div><span>16.0K</span></div>
        <span>First Seen</span></div><div>Today</div>
        <a href="/vercel-labs/skills/find-skills/security/socket"><span>Socket</span><span>Pass</span></a>
      </body>
    </html>
  `;
};

describe('skill details parser', () => {
  it('normalizes skills.sh detail URLs', () => {
    expect(getSkillsShDetailUrl('https://skills.sh/vercel-labs/skills/find-skills?x=1#top')).toBe(
      'https://skills.sh/vercel-labs/skills/find-skills'
    );
    expect(getSkillsShDetailUrl('https://example.com/vercel-labs/skills/find-skills')).toBeNull();
    expect(getSkillsShDetailUrl('https://skills.sh/vercel-labs/skills')).toBeNull();
  });

  it('extracts page metadata and sanitizes rendered sections', () => {
    const details = parseSkillDetailsHtml(
      createHtml(),
      'https://skills.sh/vercel-labs/skills/find-skills',
      () => new Date('2026-01-01T00:00:00.000Z')
    );

    expect(details.title).toBe('find-skills');
    expect(details.description).toBe('Install the find-skills skill.');
    expect(details.installCommand).toBe(
      'npx skills add https://github.com/vercel-labs/skills --skill find-skills'
    );
    expect(details.summaryHtml).toContain('<strong>Find skills.</strong>');
    expect(details.readmeHtml).toContain('<h1>Find Skills</h1>');
    expect(details.readmeHtml).not.toContain('<script>');
    expect(details.weeklyInstalls).toBe('1.2M');
    expect(details.repository).toBe('vercel-labs/skills');
    expect(details.repositoryUrl).toBe('https://github.com/vercel-labs/skills');
    expect(details.githubStars).toBe('16.0K');
    expect(details.firstSeen).toBe('Today');
    expect(details.audits).toEqual([
      {
        name: 'Socket',
        status: 'Pass',
        url: 'https://skills.sh/vercel-labs/skills/find-skills/security/socket',
      },
    ]);
  });

  it('loads details through an injected fetcher', async () => {
    const details = await loadSkillDetailsState(
      'https://skills.sh/vercel-labs/skills/find-skills',
      {
        fetcher: async () => new Response(createHtml()),
        now: () => new Date('2026-01-01T00:00:00.000Z'),
      }
    );

    expect(details.title).toBe('find-skills');
  });
});

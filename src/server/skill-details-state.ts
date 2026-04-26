import type { SkillAuditResult, SkillDetailsState } from '../features/skills/state';

type LoadSkillDetailsStateOptions = {
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
};

const SKILLS_SH_ORIGIN = 'https://skills.sh';
const MAX_SECTION_LENGTH = 60_000;
const TAG_ALLOWLIST = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const ATTRIBUTE_ALLOWLIST = new Set(['href', 'rel', 'target']);

const decodeHtml = (value: string): string => {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

const stripTags = (value: string): string => {
  return decodeHtml(
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

const sanitizeUrl = (value: string): string | null => {
  const decoded = decodeHtml(value).trim();

  if (decoded.startsWith('/')) {
    return `${SKILLS_SH_ORIGIN}${decoded}`;
  }

  try {
    const url = new URL(decoded);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
};

const sanitizeAttributes = (tagName: string, rawAttributes: string): string => {
  const attributes: string[] = [];
  const attributePattern = /([a-zA-Z:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of rawAttributes.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (!ATTRIBUTE_ALLOWLIST.has(name)) {
      continue;
    }

    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (name === 'href') {
      const url = sanitizeUrl(rawValue);
      if (!url) {
        continue;
      }

      attributes.push(`href="${url}"`);
      continue;
    }

    if (tagName === 'a' && name === 'target') {
      attributes.push('target="_blank"');
      continue;
    }

    if (tagName === 'a' && name === 'rel') {
      attributes.push('rel="noreferrer"');
    }
  }

  if (tagName === 'a') {
    if (!attributes.some((attribute) => attribute.startsWith('target='))) {
      attributes.push('target="_blank"');
    }
    if (!attributes.some((attribute) => attribute.startsWith('rel='))) {
      attributes.push('rel="noreferrer"');
    }
  }

  return attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
};

const sanitizeHtml = (value: string): string => {
  return value
    .slice(0, MAX_SECTION_LENGTH)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (tag, rawName: string, rawAttributes: string) => {
      const name = rawName.toLowerCase();
      if (!TAG_ALLOWLIST.has(name)) {
        return '';
      }

      if (tag.startsWith('</')) {
        return `</${name}>`;
      }

      return `<${name}${sanitizeAttributes(name, rawAttributes)}>`;
    });
};

const getMetaContent = (html: string, key: string, value: string): string | null => {
  const pattern = new RegExp(
    `<meta\\s+[^>]*${key}=["']${value}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const reversePattern = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*${key}=["']${value}["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern) ?? html.match(reversePattern);

  return match ? decodeHtml(match[1]) : null;
};

const getCanonicalUrl = (html: string, fallbackUrl: string): string => {
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeHtml(match[1]) : fallbackUrl;
};

const getTitle = (html: string, fallbackUrl: string): string => {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (match) {
    return stripTags(match[1]);
  }

  return new URL(fallbackUrl).pathname.split('/').filter(Boolean).at(-1) ?? 'Skill';
};

const getInstallCommand = (html: string): string | null => {
  const match = html.match(/<code class="truncate">([\s\S]*?)<\/code>/i);
  if (!match) {
    return null;
  }

  const command = stripTags(match[1]).replace(/^\$\s*/, '');
  return command.length > 0 ? command : null;
};

const extractBetween = (html: string, startPattern: RegExp, endPattern: RegExp): string | null => {
  const startMatch = startPattern.exec(html);
  if (!startMatch) {
    return null;
  }

  const startIndex = startMatch.index + startMatch[0].length;
  const rest = html.slice(startIndex);
  const endMatch = endPattern.exec(rest);
  if (!endMatch) {
    return null;
  }

  return rest.slice(0, endMatch.index);
};

const getSummaryHtml = (html: string): string | null => {
  const section = extractBetween(
    html,
    />Summary<\/div><div class="mb-8[^"]*"><div[^>]*><div[^>]*>/i,
    /<\/div><\/div><\/div><div class="bg-background">/i
  );

  return section ? sanitizeHtml(section).trim() : null;
};

const getReadmeHtml = (html: string): string | null => {
  const section = extractBetween(
    html,
    />SKILL\.md<\/span><\/div><div[^>]*>/i,
    /<\/div><\/div><\/div><div class=" lg:col-span-3">/i
  );

  return section ? sanitizeHtml(section).trim() : null;
};

const getStatValue = (html: string, label: string): string | null => {
  const pattern = new RegExp(`<span>${label}</span>[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
  const match = html.match(pattern);

  return match ? stripTags(match[1]) : null;
};

const getRepository = (
  html: string
): { repository: string | null; repositoryUrl: string | null } => {
  const match = html.match(
    /<a href="(https:\/\/github\.com\/[^"]+)"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/a>/i
  );

  if (!match) {
    return {
      repository: null,
      repositoryUrl: null,
    };
  }

  return {
    repository: decodeHtml(match[2]),
    repositoryUrl: decodeHtml(match[1]),
  };
};

const getAudits = (html: string, canonicalUrl: string): SkillAuditResult[] => {
  const audits: SkillAuditResult[] = [];
  const pattern =
    /<a[^>]*href="([^"]*\/security\/[^"]+)"[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const url = sanitizeUrl(match[1]);
    if (!url || !url.startsWith(canonicalUrl)) {
      continue;
    }

    audits.push({
      name: decodeHtml(match[2]),
      status: decodeHtml(match[3]),
      url,
    });
  }

  return audits;
};

export const parseSkillDetailsHtml = (
  html: string,
  sourceUrl: string,
  now: () => Date = () => new Date()
): SkillDetailsState => {
  const canonicalUrl = getCanonicalUrl(html, sourceUrl);
  const repository = getRepository(html);

  return {
    title: getTitle(html, sourceUrl),
    description:
      getMetaContent(html, 'name', 'description') ??
      getMetaContent(html, 'property', 'og:description'),
    canonicalUrl,
    installCommand: getInstallCommand(html),
    summaryHtml: getSummaryHtml(html),
    readmeHtml: getReadmeHtml(html),
    weeklyInstalls: getStatValue(html, 'Weekly Installs'),
    repository: repository.repository,
    repositoryUrl: repository.repositoryUrl,
    githubStars: getStatValue(html, 'GitHub Stars'),
    firstSeen: getStatValue(html, 'First Seen'),
    audits: getAudits(html, canonicalUrl),
    fetchedAt: now().toISOString(),
  };
};

export const getSkillsShDetailUrl = (value: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.origin !== SKILLS_SH_ORIGIN) {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length !== 3) {
    return null;
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
};

export const loadSkillDetailsState = async (
  url: string,
  options: LoadSkillDetailsStateOptions = {}
): Promise<SkillDetailsState> => {
  const detailUrl = getSkillsShDetailUrl(url);
  if (!detailUrl) {
    throw new Error('Skill details URL must be a skills.sh skill page.');
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(detailUrl, {
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load skill details (${response.status} ${response.statusText}).`);
  }

  return parseSkillDetailsHtml(await response.text(), detailUrl, options.now);
};

import Shiki from '@shikijs/markdown-exit';
import { useEffect, useMemo, useState } from 'react';
import { createMarkdownExit } from 'markdown-exit';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Node } from 'yaml';

const markdownExit = createMarkdownExit({
  html: false,
  linkify: true,
  typographer: true,
});

markdownExit.use(
  Shiki({
    themes: {
      light: 'github-light-default',
      dark: 'github-dark-default',
    },
  })
);

export const renderSkillMarkdownToHtml = (markdown: string): Promise<string> => {
  return markdownExit.renderAsync(markdown);
};

type RenderState =
  | {
      status: 'pending';
      html: null;
      error: null;
    }
  | {
      status: 'resolved';
      html: string;
      error: null;
    }
  | {
      status: 'rejected';
      html: null;
      error: string;
    };

export type SkillMarkdownDocument = {
  frontmatter: string | null;
  markdown: string;
};

export type SkillFrontmatterValue =
  | string
  | number
  | boolean
  | null
  | SkillFrontmatterValue[]
  | {
      [key: string]: SkillFrontmatterValue;
    };

export type SkillFrontmatterAttribute = {
  name: string;
  value: SkillFrontmatterValue;
};

export const parseSkillMarkdownDocument = (source: string): SkillMarkdownDocument => {
  const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);

  if (!frontmatterMatch) {
    return {
      frontmatter: null,
      markdown: source,
    };
  }

  return {
    frontmatter: frontmatterMatch[1].trimEnd(),
    markdown: frontmatterMatch[2],
  };
};

const normalizeYamlScalar = (value: string): string => {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const toFrontmatterScalar = (value: unknown): string | number | boolean | null => {
  if (typeof value === 'string') {
    return value.trimEnd();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  return String(value);
};

const getYamlKeyName = (node: unknown): string => {
  if (isScalar(node)) {
    return String(node.value);
  }

  return String(node);
};

const yamlNodeToFrontmatterValue = (node: Node | null | undefined): SkillFrontmatterValue => {
  if (node === null || node === undefined) {
    return null;
  }

  if (isScalar(node)) {
    return toFrontmatterScalar(node.value);
  }

  if (isSeq(node)) {
    return node.items.map((item) => yamlNodeToFrontmatterValue(item as Node | null | undefined));
  }

  if (isMap(node)) {
    return Object.fromEntries(
      node.items.map((item) => [
        getYamlKeyName(item.key),
        yamlNodeToFrontmatterValue(item.value as Node | null | undefined),
      ])
    );
  }

  return String(node);
};

export const parseSkillFrontmatterAttributes = (
  frontmatter: string
): SkillFrontmatterAttribute[] => {
  const document = parseDocument(frontmatter);

  if (document.errors.length === 0 && isMap(document.contents)) {
    return document.contents.items.map((item) => ({
      name: getYamlKeyName(item.key),
      value: yamlNodeToFrontmatterValue(item.value as Node | null | undefined),
    }));
  }

  const attributes: SkillFrontmatterAttribute[] = [];
  let currentName: string | null = null;
  let currentValue = '';
  let nestedLines: string[] = [];

  const pushCurrent = () => {
    if (currentName === null) {
      return;
    }

    const nestedValue = nestedLines.join('\n').trim();
    const value = normalizeYamlScalar(currentValue);
    const renderedValue =
      value === '|' || value === '>'
        ? nestedValue
        : [value, nestedValue].filter((item) => item.length > 0).join('\n');

    attributes.push({
      name: currentName,
      value: renderedValue,
    });
  };

  for (const line of frontmatter.split(/\r?\n/)) {
    const fieldMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);

    if (fieldMatch) {
      pushCurrent();
      currentName = fieldMatch[1];
      currentValue = fieldMatch[2] ?? '';
      nestedLines = [];
      continue;
    }

    if (currentName !== null) {
      nestedLines.push(line.replace(/^\s{2}/, ''));
    }
  }

  pushCurrent();

  return attributes;
};

export function SkillMarkdown({ markdown }: { markdown: string }) {
  const [state, setState] = useState<RenderState>({
    status: 'pending',
    html: null,
    error: null,
  });

  useEffect(() => {
    let isCurrent = true;
    setState({
      status: 'pending',
      html: null,
      error: null,
    });

    renderSkillMarkdownToHtml(markdown)
      .then((html) => {
        if (isCurrent) {
          setState({
            status: 'resolved',
            html,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({
            status: 'rejected',
            html: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [markdown]);

  const plainTextFallback = useMemo(() => markdown.trimEnd(), [markdown]);

  if (plainTextFallback.length === 0) {
    return <p className="text-sm text-muted-foreground">No markdown instructions provided.</p>;
  }

  if (state.status === 'pending') {
    return (
      <pre className="min-w-0 overflow-x-auto rounded-lg border bg-muted/40 p-5 font-mono text-sm leading-6 whitespace-pre-wrap text-foreground">
        {plainTextFallback}
      </pre>
    );
  }

  if (state.status === 'rejected') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">Unable to render markdown: {state.error}</p>
        <pre className="min-w-0 overflow-x-auto rounded-lg border bg-muted/40 p-5 font-mono text-sm leading-6 whitespace-pre-wrap text-foreground">
          {plainTextFallback}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="skill-markdown min-w-0"
      dangerouslySetInnerHTML={{
        __html: state.html,
      }}
    />
  );
}

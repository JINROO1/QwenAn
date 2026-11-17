import { Fragment, type ReactNode } from 'react';

/**
 * Renderizador Markdown seguro, sin HTML crudo: solo genera elementos React.
 * Cubre lo que el agente usa habitualmente: encabezados, listas, citas,
 * bloques de código, código en línea, negrita, cursiva y enlaces http(s).
 */
export function Markdown({ text }: { text: string }) {
  return <div className="md">{renderBlocks(text)}</div>;
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de código delimitado por ```
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // cierre
      out.push(
        <pre key={key++} className="md-code" data-lang={lang || undefined}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${Math.min(level + 2, 6)}`) as 'h3';
      out.push(
        <Tag key={key++} className="md-h">
          {renderInline(heading[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={key++} className="md-list">
          {items.map((item, n) => (
            <li key={n}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      out.push(
        <ol key={key++} className="md-list">
          {items.map((item, n) => (
            <li key={n}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote key={key++} className="md-quote">
          {renderInline(quoted.join(' '))}
        </blockquote>,
      );
      continue;
    }

    // Párrafo: une líneas consecutivas hasta una línea en blanco o un bloque nuevo.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length === 0) {
      // Línea que no encaja en ningún bloque: se muestra tal cual para no perder contenido.
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} className="md-p">
        {renderInline(para.join('\n'))}
      </p>,
    );
  }

  return out;
}

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>);
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={key++} className="md-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const label = /^\[([^\]]+)\]/.exec(token)![1];
      const href = /\((https?:\/\/[^\s)]+)\)$/.exec(token)![1];
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

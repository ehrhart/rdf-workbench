import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import sparql from 'shiki/langs/sparql.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'

type SparqlHighlighter = Awaited<ReturnType<typeof createHighlighterCore>>

let highlighterPromise: Promise<SparqlHighlighter | null> | null = null

function getHighlighter(): Promise<SparqlHighlighter | null> {
  highlighterPromise ??= createHighlighterCore({
    langs: [sparql],
    themes: [githubDark],
    engine: createJavaScriptRegexEngine()
  }).catch(() => null)
  return highlighterPromise
}

export interface HighlightedQuery {
  /** Shiki's `<code>` markup, with its `<pre>` wrapper stripped. */
  html: string
  /** Theme background, applied to the host `<pre>` so tokens stay readable. */
  background: string
  /** Theme default text color. */
  foreground: string
}

/**
 * Highlights SPARQL with the fixed github-dark theme.
 * Returns null when shiki cannot load or the grammar fails, so callers
 * can fall back to rendering the plain text.
 */
export async function highlightSparql(
  query: string
): Promise<HighlightedQuery | null> {
  const highlighter = await getHighlighter()
  if (!highlighter) return null
  try {
    const html = highlighter.codeToHtml(query, {
      lang: 'sparql',
      theme: 'github-dark'
    })
    const style = /<pre[^>]* style="([^"]*)"/.exec(html)?.[1] ?? ''
    let background = '#24292e'
    let foreground = '#e1e4e8'
    for (const declaration of style.split(';')) {
      const [name, value] = declaration.split(':')
      if (name?.trim() === 'background-color' && value) {
        background = value.trim()
      }
      if (name?.trim() === 'color' && value) {
        foreground = value.trim()
      }
    }
    return {
      html: html.replace(/^<pre[^>]*>/, '').replace(/<\/pre>\s*$/, ''),
      background,
      foreground
    }
  } catch {
    return null
  }
}

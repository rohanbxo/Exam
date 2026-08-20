import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface MarkdownRendererProps {
  text: string
  className?: string
}

export default function MarkdownRenderer({ text, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    const rawHtml = marked.parse(text, { breaks: true, gfm: true }) as string
    return DOMPurify.sanitize(rawHtml)
  }, [text])

  const classes = ['markdown-body', className].filter(Boolean).join(' ')

  // eslint-disable-next-line react/no-danger
  return <div className={classes} dangerouslySetInnerHTML={{ __html: html }} />
}

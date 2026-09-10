import type { ReactNode } from 'react'

export function Group({
  title,
  children,
  open = true,
}: {
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details className="group" open={open}>
      <summary>{title}</summary>
      <div className="body">{children}</div>
    </details>
  )
}

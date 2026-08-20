interface LoadingProps {
  variant?: 'light' | 'dark'
}

export default function Loading({ variant = 'light' }: LoadingProps) {
  return <span className={`loading-spinner${variant === 'dark' ? ' dark' : ''}`} aria-hidden="true" />
}

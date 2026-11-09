export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'md' | 'lg'

/** Class của Button — dùng lại cho `<Link>` trông như nút. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string): string {
  return ['btn', `btn--${variant}`, `btn--${size}`, extra].filter(Boolean).join(' ')
}

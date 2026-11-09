import type { ComponentPropsWithRef } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass'
import './Button.css'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}

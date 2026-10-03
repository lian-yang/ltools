/**
 * LTools UI Kit — 基础原语
 *
 * 依赖 styles.css 中的设计 token 与组件类。
 * 规则:能用 kit 就不要手写按钮/输入框/卡片;图标统一用 <Icon name="..." />;
 * 颜色只用 token(bg-surface-2、text-text-2、text-accent-text 等),禁止裸 hex。
 */
import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../Icon'

/* ==================== Button ==================== */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-solid'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  loading?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  'danger-solid': 'btn-danger-solid',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', icon, loading, children, className = '', disabled, ...rest },
    ref
  ) => {
    const sizeClass = size === 'md' ? '' : `btn-${size}`
    return (
      <button
        ref={ref}
        className={`btn ${variantClass[variant]} ${sizeClass} ${className}`}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <Spinner size={12} />
        ) : (
          icon && <Icon name={icon} size={size === 'sm' ? 13 : 14} />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

/* ==================== IconButton ==================== */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  name: IconName
  label: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'danger' | 'accent'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ name, label, size = 'md', tone = 'default', className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`icon-btn ${size === 'sm' ? 'icon-btn-sm' : ''} ${className}`}
      title={label}
      aria-label={label}
      style={tone === 'danger' ? { color: 'var(--color-error-text)' } : undefined}
      {...rest}
    >
      <Icon name={name} size={size === 'sm' ? 13 : 15} />
    </button>
  )
)

IconButton.displayName = 'IconButton'

/* ==================== Card ==================== */

export function Card({
  children,
  className = '',
  inset,
  hover,
  ...rest
}: {
  children?: ReactNode
  className?: string
  inset?: boolean
  hover?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`${inset ? 'card-inset' : 'card'} ${hover ? 'card-hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ==================== PageHeader ==================== */

export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`page-header ${className}`}>
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

/* ==================== SectionTitle ==================== */

export function SectionTitle({
  title,
  action,
  className = '',
}: {
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h3 className="section-title" style={{ marginBottom: 0 }}>
        {title}
      </h3>
      {action}
    </div>
  )
}

/* ==================== Input / Textarea ==================== */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input ref={ref} className={`input ${className}`} {...rest} />
  )
)

Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea ref={ref} className={`input ${className}`} {...rest} />
  )
)

Textarea.displayName = 'Textarea'

export function Field({
  label,
  hint,
  children,
  horizontal,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  horizontal?: boolean
  className?: string
}) {
  if (horizontal) {
    return (
      <div className={`flex items-center justify-between gap-6 py-3 ${className}`}>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-text-1">{label}</div>
          {hint && <div className="text-[11.5px] text-text-3 mt-0.5">{hint}</div>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    )
  }
  return (
    <div className={className}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

/* ==================== Toggle ==================== */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-40"
      style={{
        background: checked ? 'var(--color-accent)' : 'rgba(255,255,255,0.14)',
      }}
    >
      <span
        className="inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-150"
        style={{
          transform: checked ? 'translateX(16px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

/* ==================== Badge ==================== */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error'

const badgeClass: Record<BadgeTone, string> = {
  neutral: 'badge-neutral',
  accent: 'badge-accent',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return <span className={`badge ${badgeClass[tone]} ${className}`}>{children}</span>
}

/* ==================== KeyCap ==================== */

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

/* ==================== Segmented ==================== */

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-[7px] border p-0.5 ${className}`}
      style={{
        background: 'var(--color-surface-1)',
        borderColor: 'var(--color-hairline)',
      }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="h-[24px] rounded-[5px] px-2.5 text-[12px] font-medium transition-colors duration-150"
            style={{
              background: active ? 'var(--color-surface-4)' : 'transparent',
              color: active ? 'var(--color-text-1)' : 'var(--color-text-3)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ==================== Modal ==================== */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 420,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="scrim fixed inset-0 z-[999] flex items-center justify-center p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="glass-heavy animate-scale-in w-full overflow-hidden"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="hairline-b px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-text-1">{title}</h2>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="hairline-t flex items-center justify-end gap-2 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ==================== EmptyState ==================== */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon: IconName
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ==================== Spinner / Skeleton / Progress ==================== */

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 8) }}
    />
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

export function ProgressBar({
  value,
  tone = 'accent',
  className = '',
}: {
  value: number
  tone?: 'accent' | 'success' | 'warning' | 'error'
  className?: string
}) {
  const colors: Record<string, string> = {
    accent: 'var(--color-accent)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  }
  return (
    <div className={`progress ${className}`}>
      <div
        className="progress-bar"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: colors[tone] }}
      />
    </div>
  )
}

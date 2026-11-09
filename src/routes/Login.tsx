import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, Info } from 'lucide-react'
import { Button } from '../components/Button'
import { buttonClass } from '../components/buttonClass'
import { Field } from '../components/Field'
import { PageTitle } from '../components/PageTitle'
import { Spinner } from '../components/Spinner'
import { APP_NAME, usePageTitle } from '../hooks/usePageTitle'
import { RepoError, SEND_LINK_ERROR_MESSAGE } from '../repo/errors'
import { consumeLoginNext, safeNext, saveLoginNext } from '../router'
import { useAuth } from '../state/useAuth'
import './Login.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60
const VERIFY_TIMEOUT_MS = 5000

const EMAIL_ERROR = 'Email chưa đúng. Kiểm tra lại giúp mình nhé.'
const LINK_EXPIRED = 'Liên kết không còn hiệu lực. Hãy yêu cầu liên kết mới.'
const LINK_PKCE = 'Hãy mở liên kết trên cùng trình duyệt bạn đã dùng để yêu cầu.'

interface UrlInfo {
  error: string | null
  /** có `code` PKCE trong query */
  hasCode: boolean
  /** có token trong hash */
  hasToken: boolean
}

/** Đọc lỗi / token từ hash + query khi quay về từ email (không side-effect). */
function readUrl(): UrlInfo {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const get = (k: string) => hash.get(k) ?? query.get(k)
  const hasError = get('error') || get('error_code') || get('error_description')
  let error: string | null = null
  if (hasError) {
    const desc = `${get('error_description') ?? ''} ${get('error') ?? ''}`
    error = /code verifier|pkce/i.test(desc) ? LINK_PKCE : LINK_EXPIRED
  }
  return {
    error,
    hasCode: !error && query.has('code'),
    hasToken: !error && (hash.has('access_token') || hash.has('refresh_token')),
  }
}

type Phase = 'idle' | 'sending' | 'sent'

export default function Login() {
  usePageTitle('Đăng nhập')
  const { mode, user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [urlInfo] = useState<UrlInfo>(readUrl)
  const [tokenWaiting, setTokenWaiting] = useState(urlInfo.hasToken)
  const [sendError, setSendError] = useState<string | null | undefined>(undefined)
  // `code` PKCE còn trong URL mà không có session: supabase-js đã khởi tạo xong → chắc chắn thất bại
  const pkceFail = urlInfo.hasCode && !loading && !user
  const blockError = sendError !== undefined ? sendError : (urlInfo.error ?? (pkceFail ? LINK_PKCE : null))
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [resending, setResending] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [sentAt, setSentAt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const sentTitleRef = useRef<HTMLParagraphElement>(null)
  const focusInput = useRef(false)

  const supabase = mode === 'supabase'
  const verifying = tokenWaiting || (urlInfo.hasCode && loading)

  // Dọn lỗi/code khỏi URL (giữ `next`); lỗi trong hash thì xoá cả hash
  useEffect(() => {
    if (!urlInfo.error && !urlInfo.hasCode && !urlInfo.hasToken) return
    const q = new URLSearchParams(window.location.search)
    ;['error', 'error_code', 'error_description', 'code'].forEach((k) => q.delete(k))
    const qs = q.toString()
    // hash chứa lỗi hoặc token thì xoá luôn; `verifying` đã nằm trong state
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [urlInfo])

  // Đã có session → chuyển đi (ưu tiên `next` đã lưu trước khi gửi liên kết)
  useEffect(() => {
    if (!supabase || !user) return
    const stored = consumeLoginNext()
    navigate(stored ?? next, { replace: true })
  }, [supabase, user, next, navigate])

  // Token trong hash mà mãi không có session → báo lỗi liên kết (timeout ngắn)
  useEffect(() => {
    if (!urlInfo.hasToken || !tokenWaiting || user) return
    const t = window.setTimeout(() => {
      setTokenWaiting(false)
      setSendError(LINK_EXPIRED)
    }, VERIFY_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [urlInfo, tokenWaiting, user])

  // Đếm ngược gửi lại, reset theo lần gửi thành công (sentAt)
  useEffect(() => {
    if (phase !== 'sent') return
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000)))
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [phase, sentAt])

  // Focus: vào tiêu đề khối sent; quay lại form thì vào input
  useEffect(() => {
    if (phase === 'sent') sentTitleRef.current?.focus()
    if (phase === 'idle' && focusInput.current) {
      focusInput.current = false
      inputRef.current?.focus()
    }
  }, [phase])

  async function send(address: string, resend: boolean) {
    if (resend) setResending(true)
    else setPhase('sending')
    setSendError(null)
    saveLoginNext(next !== '/' ? next : null)
    try {
      await signIn(address)
      setSentTo(address)
      setSentAt(Date.now())
      setSecondsLeft(RESEND_SECONDS)
      setPhase('sent')
    } catch (e) {
      setSendError(e instanceof RepoError ? e.message : SEND_LINK_ERROR_MESSAGE)
      setPhase(resend ? 'sent' : 'idle')
    } finally {
      setResending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase === 'sending') return
    const value = email.trim().toLowerCase()
    if (value.length > 254 || !EMAIL_RE.test(value)) {
      setFieldError(EMAIL_ERROR)
      inputRef.current?.focus()
      return
    }
    setFieldError(null)
    void send(value, false)
  }

  const errorBlock = blockError && (
    <p className="login-error" role="alert">
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{blockError}</span>
    </p>
  )

  let body
  if (mode === 'local') {
    body = (
      <div className="login-block">
        <p className="login-info-title">
          <Info size={20} strokeWidth={1.75} aria-hidden="true" />
          Chưa cấu hình tài khoản.
        </p>
        <p className="login-text">
          Dữ liệu sẽ lưu trên trình duyệt này và không đồng bộ sang thiết bị khác. Để đồng bộ, xem hướng dẫn trong{' '}
          <span lang="en">README</span>.
        </p>
        <Link to="/" className={buttonClass('primary', 'lg')}>
          Vào học
        </Link>
      </div>
    )
  } else if (loading || verifying || user) {
    body = (
      <div className="login-block">
        <Spinner label="Đang đăng nhập…" />
      </div>
    )
  } else if (phase === 'sent') {
    body = (
      <div className="login-block">
        {errorBlock}
        <div className="login-status">
          <p className="login-sent-title" ref={sentTitleRef} tabIndex={-1}>
            Đã gửi liên kết đến <strong>{sentTo}</strong>.
          </p>
          <p className="login-text">Mở email và bấm vào liên kết để đăng nhập. Liên kết có hiệu lực trong 1 giờ.</p>
        </div>
        <div className="login-actions">
          <Button variant="ghost" disabled={secondsLeft > 0 || resending} onClick={() => void send(sentTo, true)}>
            {resending ? (
              <Spinner label="Đang gửi…" />
            ) : secondsLeft > 0 ? (
              `Gửi lại sau ${secondsLeft}s`
            ) : (
              'Gửi lại'
            )}
          </Button>
          <Button
            variant="ghost"
            disabled={resending}
            onClick={() => {
              focusInput.current = true
              setPhase('idle')
              setSendError(null)
              setEmail('')
            }}
          >
            Dùng email khác
          </Button>
        </div>
      </div>
    )
  } else {
    const sending = phase === 'sending'
    body = (
      <form className="login-block" onSubmit={onSubmit} noValidate>
        {errorBlock}
        <Field
          ref={inputRef}
          label="Email"
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ban@vidu.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          disabled={sending}
        />
        <Button type="submit" size="lg" disabled={sending}>
          {sending ? <Spinner label="Đang gửi…" /> : 'Gửi liên kết đăng nhập'}
        </Button>
        <p className="login-note">Không cần mật khẩu. Mỗi tài khoản chỉ thấy dữ liệu của mình.</p>
      </form>
    )
  }

  return (
    <main id="main" tabIndex={-1} className="login">
      <div className="login-panel">
        <header className="login-head">
          <PageTitle>{APP_NAME}</PageTitle>
          <p className="login-sub">Học lại ngoại ngữ giao tiếp, mỗi ngày một ít.</p>
        </header>
        {body}
      </div>
    </main>
  )
}

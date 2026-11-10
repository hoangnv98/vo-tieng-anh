import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, Info } from 'lucide-react'
import { Button } from '../components/Button'
import { buttonClass } from '../components/buttonClass'
import { Field } from '../components/Field'
import { PageTitle } from '../components/PageTitle'
import { PasswordField } from '../components/PasswordField'
import { Segmented } from '../components/Segmented'
import { Spinner } from '../components/Spinner'
import { PASSWORD_ERROR_TEXT, isValidEmail, validatePasswordLogin, type PasswordLoginError } from '../domain/password'
import { APP_NAME, usePageTitle } from '../hooks/usePageTitle'
import { readLoginMode, writeLoginMode, type LoginMode } from '../lib/loginMode'
import { PASSWORD_SIGN_IN_ERROR_MESSAGE, RepoError, SEND_LINK_ERROR_MESSAGE } from '../repo/errors'
import { consumeLoginNext, safeNext, saveLoginNext } from '../router'
import { useAuth } from '../state/useAuth'
import './Login.css'

const RESEND_SECONDS = 60
const VERIFY_TIMEOUT_MS = 5000

const PW_ERROR_ID = 'login-pw-error'
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
type PwPhase = 'idle' | 'signing-in'

const LOGIN_MODES: { value: LoginMode; label: string }[] = [
  { value: 'link', label: 'Liên kết email' },
  { value: 'password', label: 'Mật khẩu' },
]

export default function Login() {
  usePageTitle('Đăng nhập')
  const { mode, user, loading, signIn, signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [urlInfo] = useState<UrlInfo>(readUrl)
  const [tokenWaiting, setTokenWaiting] = useState(urlInfo.hasToken)
  // lỗi liên kết (URL / hết thời gian chờ token) — hiện ở cả hai chế độ
  const [sendError, setSendError] = useState<string | null | undefined>(undefined)
  // lỗi gửi liên kết (API) — thuộc chế độ "Liên kết email"
  const [sendFail, setSendFail] = useState<string | null>(null)
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

  // (T21) chế độ mật khẩu — mật khẩu chỉ sống trong state này, xoá khi đổi chế độ / gửi lỗi
  const [loginMode, setLoginMode] = useState<LoginMode>(readLoginMode)
  const [password, setPassword] = useState('')
  const [pwPhase, setPwPhase] = useState<PwPhase>('idle')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwFieldErrors, setPwFieldErrors] = useState<PasswordLoginError | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const focusAfterSwitch = useRef(false)
  const focusPasswordAfterFail = useRef(false)

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

  // "Quên mật khẩu? Dùng liên kết email" → focus ô Email của chế độ liên kết sau khi render
  useEffect(() => {
    if (!focusAfterSwitch.current) return
    focusAfterSwitch.current = false
    if (loginMode !== 'link') return
    // tab liên kết đang ở khối "đã gửi" → không có ô Email, focus tiêu đề khối
    if (phase === 'sent') sentTitleRef.current?.focus()
    else inputRef.current?.focus()
  }, [loginMode, phase])

  // Đăng nhập mật khẩu lỗi → focus ô mật khẩu (đã xoá) sau khi ô hết disabled
  useEffect(() => {
    if (pwPhase !== 'idle' || !focusPasswordAfterFail.current) return
    focusPasswordAfterFail.current = false
    passwordRef.current?.focus()
  }, [pwPhase])

  async function send(address: string, resend: boolean) {
    if (resend) setResending(true)
    else setPhase('sending')
    setSendError(null)
    setSendFail(null)
    saveLoginNext(next !== '/' ? next : null)
    try {
      await signIn(address)
      writeLoginMode('link')
      setSentTo(address)
      setSentAt(Date.now())
      setSecondsLeft(RESEND_SECONDS)
      setPhase('sent')
    } catch (e) {
      setSendFail(e instanceof RepoError ? e.message : SEND_LINK_ERROR_MESSAGE)
      setPhase(resend ? 'sent' : 'idle')
    } finally {
      setResending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (phase === 'sending') return
    const value = email.trim().toLowerCase()
    if (!isValidEmail(value)) {
      setFieldError(PASSWORD_ERROR_TEXT.invalid)
      inputRef.current?.focus()
      return
    }
    setFieldError(null)
    void send(value, false)
  }

  /** Đổi chế độ: giữ `email`, xoá mật khẩu và lỗi của cả hai chế độ (trừ lỗi liên kết từ URL). */
  function switchMode(m: LoginMode) {
    if (m === loginMode) return
    setLoginMode(m)
    setPassword('')
    setPwError(null)
    setPwFieldErrors(null)
    setFieldError(null)
    setSendFail(null)
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (pwPhase === 'signing-in') return
    const address = email.trim().toLowerCase()
    const errs = validatePasswordLogin(address, password)
    setPwError(null)
    if (errs) {
      setPwFieldErrors(errs)
      if (errs.email) inputRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }
    setPwFieldErrors(null)
    // bỏ `next` cũ còn sót từ lần gửi liên kết trước → effect điều hướng dùng `next` trên URL
    saveLoginNext(null)
    setPwPhase('signing-in')
    try {
      await signInWithPassword(address, password)
      writeLoginMode('password')
      // supabase-js phát SIGNED_IN trước khi resolve → effect phía trên đã/sắp điều hướng
    } catch (err) {
      setPassword('')
      setPwError(err instanceof RepoError ? err.message : PASSWORD_SIGN_IN_ERROR_MESSAGE)
      focusPasswordAfterFail.current = true
    } finally {
      setPwPhase('idle')
    }
  }

  const errorText = (msg: string, id?: string) => (
    <p className="error-block" role="alert" id={id}>
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{msg}</span>
    </p>
  )
  const errorBlock = blockError ? errorText(blockError) : null
  const sendFailBlock = sendFail ? errorText(sendFail) : null
  const busy = phase === 'sending' || resending || pwPhase === 'signing-in'
  const modePicker = (
    <Segmented
      label="Cách đăng nhập"
      value={loginMode}
      options={LOGIN_MODES}
      onChange={switchMode}
      disabled={busy}
      fill
    />
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
  } else {
    // Segmented nằm ngoài phần đổi theo chế độ để không bị mount lại (giữ focus khi bấm mũi tên)
    let content
    if (loginMode === 'password') {
      const signingIn = pwPhase === 'signing-in'
      content = (
        <form className="login-form" onSubmit={(e) => void onPasswordSubmit(e)} noValidate>
          {pwError && errorText(pwError, PW_ERROR_ID)}
          <Field
            ref={inputRef}
            id="login-email"
            label="Email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="ban@vidu.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={pwFieldErrors?.email ? PASSWORD_ERROR_TEXT.invalid : null}
            disabled={signingIn}
          />
          <PasswordField
            ref={passwordRef}
            id="login-password"
            label="Mật khẩu"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            error={pwFieldErrors?.password ? PASSWORD_ERROR_TEXT.required : null}
            describedBy={pwError ? PW_ERROR_ID : undefined}
            disabled={signingIn}
          />
          <Button type="submit" size="lg" disabled={signingIn}>
            {signingIn ? <Spinner label="Đang đăng nhập…" /> : 'Đăng nhập'}
          </Button>
          <Button
            variant="ghost"
            className="login-forgot"
            disabled={signingIn}
            onClick={() => {
              focusAfterSwitch.current = true
              switchMode('link')
            }}
          >
            Quên mật khẩu? Dùng liên kết email
          </Button>
          <p className="login-note">Mật khẩu không được lưu trong app. Trình duyệt có thể đề nghị lưu giúp bạn.</p>
          <p className="visually-hidden" role="status" aria-live="polite">
            {signingIn ? 'Đang đăng nhập…' : ''}
          </p>
        </form>
      )
    } else if (phase === 'sent') {
      content = (
        <div className="login-form">
          {sendFailBlock}
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
                setSendFail(null)
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
      content = (
        <form className="login-form" onSubmit={onSubmit} noValidate>
          {sendFailBlock}
          <Field
            ref={inputRef}
            id="login-email"
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
          <p className="login-note">
            Mỗi tài khoản chỉ thấy dữ liệu của mình. Sau khi vào, bạn có thể đặt mật khẩu trong Cài đặt để lần sau
            đăng nhập nhanh hơn.
          </p>
        </form>
      )
    }
    body = (
      <div className="login-block">
        {errorBlock}
        {modePicker}
        {content}
      </div>
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

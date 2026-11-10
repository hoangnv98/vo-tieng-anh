import { CircleAlert, Download, Info, KeyRound, LogOut, Minus, Plus, Trash2, Upload, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field } from '../components/Field'
import { PageTitle } from '../components/PageTitle'
import { PasswordField } from '../components/PasswordField'
import { Spinner } from '../components/Spinner'
import { TtsUnsupportedNote } from '../components/SpeakButton'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTts, useVoices } from '../hooks/useTts'
import { NO_SESSION_MESSAGE, PASSWORD_SAVE_ERROR_MESSAGE, RepoError, SIGN_OUT_ERROR_MESSAGE } from '../repo/errors'
import { PASSWORD_ERROR_TEXT, validateNewPassword, type NewPasswordError } from '../domain/password'
import { writeLoginMode } from '../lib/loginMode'
import { localDay } from '../lib/dates'
import { shouldSyncField } from '../lib/settingsSync'
import { speak as speakDevice } from '../lib/speech'
import { cancel as cancelTts, subscribe as subscribeTts, webSpeech } from '../lib/tts'
import { readTtsConfig, writeTtsConfig, type TtsConfig } from '../lib/ttsConfig'
import { useAuth } from '../state/useAuth'
import { useData } from '../state/useData'
import { STUDY_LANGUAGES, type Settings as SettingsData, type StudyLanguageFilter } from '../domain/types'
import { asStudyLanguage, STUDY_LANGUAGE_LABELS } from '../domain/language'
import { voiceStatusLine } from '../domain/languageUi'
import { GOAL, NAME_MAX, NEW_CARDS } from '../domain/settingsLimits'
import {
  IMPORT_ERROR_MESSAGES,
  IMPORT_MAX_BYTES,
  isEmptyPlan,
  planImport,
  validateImportFile,
  type ImportFile,
  type ImportPlan,
} from '../domain/importSnapshot'
import { IMPORT_BLOCKED_MESSAGE } from '../state/dataContext'
import { TtsServerFields } from './settings/TtsServerFields'
import { leaveLostSession } from './settings/sessionLost'
import './Settings.css'

const DEBOUNCE_MS = 600

function parseIntInRange(raw: string, r: { min: number; max: number; step: number }): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  const n = Number(raw)
  if (n < r.min || n > r.max || (n - r.min) % r.step !== 0) return null
  return n
}

interface StepperProps {
  label: string
  name: string
  description: string
  error: string | null
  value: string
  range: { min: number; max: number; step: number }
  onChange(v: string): void
  onBlur(): void
}

function Stepper({ label, name, description, error, value, range, onChange, onBlur }: StepperProps) {
  const n = Number(value)
  const valid = /^\d+$/.test(value.trim())
  const bump = (dir: 1 | -1) => {
    const base = valid ? n : dir === 1 ? range.min - range.step : range.max + range.step
    const next = Math.min(range.max, Math.max(range.min, base + dir * range.step))
    onChange(String(next))
  }
  return (
    <div className="stepper">
      <Field
        label={label}
        description={description}
        error={error}
        name={name}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="stepper-input"
      />
      <div className="stepper-btns">
        <Button
          variant="secondary"
          className="stepper-btn"
          aria-label={`Giảm ${label.toLowerCase()}`}
          disabled={valid && n <= range.min}
          onClick={() => bump(-1)}
        >
          <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          className="stepper-btn"
          aria-label={`Tăng ${label.toLowerCase()}`}
          disabled={valid && n >= range.max}
          onClick={() => bump(1)}
        >
          <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

const getViDevice = () => webSpeech.supports('vi')

/** Trình duyệt chọn và đọc được tệp (`File` + `Blob.prototype.text`). */
const canReadFiles = () =>
  typeof File !== 'undefined' && typeof Blob !== 'undefined' && typeof Blob.prototype.text === 'function'

type ImportStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'preview'; plan: ImportPlan; file: ImportFile }

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange(v: boolean): void
}) {
  return (
    <label className="switch-row">
      <input
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      <span className="switch-text">
        <span id={`${id}-label`} className="switch-label">{label}</span>
        <span id={`${id}-desc`} className="settings-mute">{description}</span>
      </span>
    </label>
  )
}

/**
 * (T21) Mục "Mật khẩu" trong khối Tài khoản (6.15 (2)-A, (4)-B) — chỉ render ở mode supabase.
 * Mật khẩu chỉ sống trong state khi form mở; xoá khi lưu xong / huỷ.
 */
function PasswordSection({
  email,
  hasPassword,
  setPassword,
  notify,
  onSessionLost,
}: {
  email: string
  hasPassword: boolean
  setPassword(password: string): Promise<void>
  notify(message: string, tone?: 'error'): void
  onSessionLost(): Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: NewPasswordError; confirm?: NewPasswordError } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const newRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (open) newRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const close = () => {
    setOpen(false)
    setPw('')
    setConfirm('')
    setFieldErrors(null)
    setError(null)
    toggleRef.current?.focus()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    const errs = validateNewPassword(pw, confirm)
    setFieldErrors(errs)
    if (errs) {
      if (errs.password) newRef.current?.focus()
      else confirmRef.current?.focus()
      return
    }
    const first = !hasPassword
    setSaving(true)
    try {
      await setPassword(pw)
      writeLoginMode('password')
      close()
      notify(first ? 'Đã đặt mật khẩu. Lần sau bạn có thể đăng nhập bằng email và mật khẩu.' : 'Đã đổi mật khẩu.')
    } catch (err) {
      if (err instanceof RepoError && err.code === 'no_session') {
        setError(NO_SESSION_MESSAGE)
        notify(NO_SESSION_MESSAGE, 'error')
        void onSessionLost()
      } else {
        setError(err instanceof RepoError ? err.message : PASSWORD_SAVE_ERROR_MESSAGE)
      }
    } finally {
      setSaving(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Escape' || saving) return
    e.preventDefault()
    close()
  }

  return (
    <div className="settings-password">
      <h3>Mật khẩu</h3>
      <p className="settings-mute">
        {hasPassword
          ? 'Đã đặt mật khẩu. Bạn có thể vào bằng email và mật khẩu trên mọi thiết bị.'
          : 'Chưa đặt mật khẩu. Bạn đang vào bằng liên kết email.'}
      </p>
      <Button
        ref={toggleRef}
        variant="secondary"
        className="settings-password-toggle"
        aria-expanded={open}
        aria-controls="st-password-form"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <KeyRound size={20} strokeWidth={1.75} aria-hidden="true" />
        {hasPassword ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
      </Button>
      {open && (
        <form
          id="st-password-form"
          className="settings-password-form"
          onSubmit={(e) => void onSubmit(e)}
          onKeyDown={onKeyDown}
          noValidate
        >
          {/* tên đăng nhập ẩn để trình quản lý mật khẩu biết lưu cho tài khoản nào (khuyến nghị Chrome/Safari) */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            className="visually-hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <PasswordField
            ref={newRef}
            id="st-password-new"
            name="new-password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            description="Ít nhất 8 ký tự. Nên dùng một cụm từ bạn dễ nhớ nhưng người khác khó đoán."
            value={pw}
            onChange={setPw}
            error={fieldErrors?.password ? PASSWORD_ERROR_TEXT[fieldErrors.password] : null}
            disabled={saving}
          />
          <PasswordField
            ref={confirmRef}
            id="st-password-confirm"
            name="confirm-password"
            label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            error={fieldErrors?.confirm ? PASSWORD_ERROR_TEXT[fieldErrors.confirm] : null}
            disabled={saving}
          />
          {error && (
            <p ref={errorRef} className="error-block" role="alert" tabIndex={-1}>
              <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}
          <div className="settings-password-actions">
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner label="Đang lưu…" /> : 'Lưu mật khẩu'}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={close}>
              Huỷ
            </Button>
          </div>
          <p className="visually-hidden" role="status" aria-live="polite">
            {saving ? 'Đang lưu…' : ''}
          </p>
        </form>
      )}
    </div>
  )
}

export default function Settings() {
  usePageTitle('Cài đặt')
  const navigate = useNavigate()
  const { mode, user, signOut, setPassword } = useAuth()
  const { snapshot, pending, online, saveSettings, importSnapshot, notify } = useData()
  const { supported, voices, loaded } = useVoices()
  const { speakable } = useTts()
  const [ttsCfg, setTtsCfg] = useState<TtsConfig>(readTtsConfig)
  const viDevice = useSyncExternalStore(subscribeTts, getViDevice, () => false)
  const saveTts = useCallback((fn: (c: TtsConfig) => TtsConfig) => {
    const next = fn(readTtsConfig())
    writeTtsConfig(next)
    setTtsCfg(next)
  }, [])

  const settings = snapshot?.settings ?? null
  const latest = useRef<SettingsData | null>(settings)
  useEffect(() => {
    latest.current = settings
  }, [settings])

  const [name, setName] = useState(settings?.display_name ?? '')
  const [goal, setGoal] = useState(String(settings?.daily_goal_min ?? 15))
  const [newCards, setNewCards] = useState(String(settings?.new_cards_per_day ?? 15))
  const timers = useRef<Record<string, { id: number; fn: () => void }>>({})

  const [signOutOpen, setSignOutOpen] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeText, setWipeText] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: 'idle' })
  const [includeSettings, setIncludeSettings] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileSupported] = useState(canReadFiles)

  const persist = useCallback(
    (patch: Partial<SettingsData>) => {
      const base = latest.current
      if (!base) return
      const next = { ...base, ...patch }
      latest.current = next
      saveSettings(next).then(
        () => notify('Đã lưu.'),
        () => {
          /* lỗi ghi đã báo bằng toast chung; giá trị vẫn giữ trên UI */
        },
      )
    },
    [saveSettings, notify],
  )

  const schedule = useCallback((key: string, fn: () => void) => {
    window.clearTimeout(timers.current[key]?.id)
    const id = window.setTimeout(() => {
      delete timers.current[key]
      fn()
    }, DEBOUNCE_MS)
    timers.current[key] = { id, fn }
  }, [])

  const cancelTimer = useCallback((key: string) => {
    window.clearTimeout(timers.current[key]?.id)
    delete timers.current[key]
  }, [])

  const flush = useCallback((key?: string) => {
    const t = timers.current
    for (const k of key ? [key] : Object.keys(t)) {
      const e = t[k]
      if (!e) continue
      window.clearTimeout(e.id)
      delete t[k]
      e.fn()
    }
  }, [])

  useEffect(() => {
    return () => flush()
  }, [flush])

  // Đồng bộ lại ô nhập khi settings đổi từ nền, trừ ô đang có thay đổi chưa lưu.
  useEffect(() => {
    if (!settings) return
    const numNorm = (r: { min: number; max: number; step: number }) => (v: string) => {
      const n = parseIntInRange(v, r)
      return n === null ? v : String(n)
    }
    // Ô đang focus (người dùng đang gõ) cũng giữ nguyên; giá trị sẽ khớp lại khi blur/lưu.
    const active = document.activeElement
    const focused = active instanceof HTMLInputElement ? active.name : null
    const sync = (key: string, saved: string, norm: (v: string) => string) => (cur: string) =>
      !timers.current[key] && focused !== key && shouldSyncField(cur, saved, norm) ? saved : cur
    setName(sync('name', settings.display_name, (v) => v.trim()))
    setGoal(sync('goal', String(settings.daily_goal_min), numNorm(GOAL)))
    setNewCards(sync('new', String(settings.new_cards_per_day), numNorm(NEW_CARDS)))
  }, [settings])

  const nameTrim = name.trim()
  const nameError = nameTrim.length > NAME_MAX ? 'Tối đa 40 ký tự.' : null
  const goalValue = parseIntInRange(goal, GOAL)
  const goalError = goalValue === null ? 'Mục tiêu từ 5 đến 120 phút.' : null
  const newValue = parseIntInRange(newCards, NEW_CARDS)
  const newError = newValue === null ? 'Từ 5 đến 30 thẻ.' : null

  const onName = (v: string) => {
    setName(v)
    const t = v.trim()
    if (t.length > NAME_MAX) {
      cancelTimer('name')
      return
    }
    schedule('name', () => persist({ display_name: t }))
  }
  const onGoal = (v: string) => {
    setGoal(v)
    const n = parseIntInRange(v, GOAL)
    if (n === null) cancelTimer('goal')
    else schedule('goal', () => persist({ daily_goal_min: n }))
  }
  const onNew = (v: string) => {
    setNewCards(v)
    const n = parseIntInRange(v, NEW_CARDS)
    if (n === null) cancelTimer('new')
    else schedule('new', () => persist({ new_cards_per_day: n }))
  }

  const voiceNames = useMemo(() => new Set(voices.map((v) => v.name)), [voices])
  const savedVoice = settings?.voice_name ?? ''
  const voiceValue = voiceNames.has(savedVoice) ? savedVoice : ''

  const exportData = () => {
    if (!snapshot) return
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vo-ngoai-ngu-${localDay(new Date())}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    notify('Đã tải tệp dữ liệu.')
  }

  const onPickFile = async (input: HTMLInputElement) => {
    const picked = input.files?.[0] ?? null
    // reset để chọn lại cùng tệp vẫn kích hoạt `change`
    input.value = ''
    if (!picked || !snapshot) return
    if (picked.size > IMPORT_MAX_BYTES) {
      setImportStatus({ kind: 'error', message: IMPORT_ERROR_MESSAGES['too-large'] })
      return
    }
    setImportStatus({ kind: 'reading' })
    let json: unknown
    try {
      json = JSON.parse(await picked.text())
    } catch {
      setImportStatus({ kind: 'error', message: IMPORT_ERROR_MESSAGES['not-json'] })
      return
    }
    const checked = validateImportFile(json)
    if (!checked.ok) {
      setImportStatus({ kind: 'error', message: IMPORT_ERROR_MESSAGES[checked.error] })
      return
    }
    const plan = planImport(checked.file, snapshot, user?.id ?? snapshot.settings.user_id, localDay(new Date()))
    setIncludeSettings(false)
    setImportStatus({ kind: 'preview', plan, file: checked.file })
  }

  const confirmImport = async () => {
    if (importStatus.kind !== 'preview' || importing) return
    setImporting(true)
    try {
      const r = await importSnapshot(importStatus.file, { includeSettings })
      setImportStatus({ kind: 'idle' })
      const lessons = r.lessons.add + r.lessons.update
      const items = r.items.add + r.items.update
      const cards = r.cards.add + r.cards.update
      const nothing = lessons + items + cards + r.studyDays === 0
      notify(
        nothing && r.settings
          ? 'Đã cập nhật cài đặt.'
          : `Đã nhập ${lessons} buổi, ${items} mục, ${cards} thẻ.` + (r.settings ? ' Đã cập nhật cài đặt.' : ''),
      )
    } catch (e) {
      setImportStatus({ kind: 'idle' })
      notify(e instanceof Error && e.message ? e.message : IMPORT_BLOCKED_MESSAGE, 'error')
    } finally {
      setImporting(false)
    }
  }

  const confirmSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
      setSignOutOpen(false)
      navigate('/login', { replace: true })
    } catch {
      setSignOutOpen(false)
      notify(SIGN_OUT_ERROR_MESSAGE, 'error')
    } finally {
      setSigningOut(false)
    }
  }

  const wipe = () => {
    if (wipeText.trim().toUpperCase() !== 'XOA') return
    Object.keys(localStorage)
      .filter((k) => k.startsWith('vta:v1:'))
      .forEach((k) => localStorage.removeItem(k))
    window.location.reload()
  }

  if (!settings) return null

  const pendingCount = pending.size
  const importBlocked = mode === 'supabase' && (!online || pendingCount > 0)
  const preview = importStatus.kind === 'preview' ? importStatus.plan : null
  const signOutDesc =
    (user?.hasPassword
      ? 'Bạn có thể vào lại bằng email và mật khẩu, hoặc bằng liên kết email.'
      : 'Bạn sẽ cần liên kết email mới để vào lại.') +
    (pendingCount > 0
      ? ` Có ${pendingCount} thay đổi chưa đồng bộ. Đăng xuất bây giờ, chúng sẽ được gửi khi bạn đăng nhập lại trên trình duyệt này.`
      : '')

  return (
    <div className="settings">
      <PageTitle>Cài đặt</PageTitle>

      <section className="settings-group" aria-labelledby="st-account">
        <h2 id="st-account">Tài khoản</h2>
        <p className="settings-mute">
          {mode === 'supabase'
            ? `Đăng nhập bằng ${user?.email ?? ''}`
            : 'Chế độ cục bộ · dữ liệu chỉ nằm trên trình duyệt này'}
        </p>
        <Field
          label="Tên hiển thị"
          name="name"
          value={name}
          maxLength={80}
          autoComplete="nickname"
          error={nameError}
          onChange={(e) => onName(e.target.value)}
          onBlur={() => flush('name')}
        />
        {mode === 'supabase' && user && (
          <PasswordSection
            email={user.email ?? ''}
            hasPassword={user.hasPassword}
            setPassword={setPassword}
            notify={notify}
            onSessionLost={() => leaveLostSession(signOut, () => navigate('/login', { replace: true }))}
          />
        )}
        {mode === 'supabase' && (
          <div className="settings-after-rule">
            <Button variant="secondary" onClick={() => setSignOutOpen(true)}>
              <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
              Đăng xuất
            </Button>
          </div>
        )}
      </section>

      <section className="settings-group" aria-labelledby="st-language">
        <h2 id="st-language">Ngôn ngữ</h2>
        <Field
          as="select"
          label="Ngôn ngữ đang học"
          name="study_language"
          className="settings-language"
          description="Lọc thẻ ôn, shadowing, kho mẫu câu và thống kê thẻ theo một ngôn ngữ. Nhật ký buổi học, chuỗi ngày và phút học luôn tính chung."
          value={asStudyLanguage(settings.study_language)}
          onChange={(e) => persist({ study_language: asStudyLanguage(e.target.value as StudyLanguageFilter) })}
        >
          {STUDY_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {STUDY_LANGUAGE_LABELS[l]}
            </option>
          ))}
        </Field>
        <p className="settings-mute">{voiceStatusLine(speakable, supported)}</p>
      </section>

      <section className="settings-group" aria-labelledby="st-goal">
        <h2 id="st-goal">Mục tiêu</h2>
        <Stepper
          label="Mục tiêu mỗi ngày"
          name="goal"
          description="15 phút là vừa với người bận. Học 1 phút đã được tính vào chuỗi."
          error={goalError}
          value={goal}
          range={GOAL}
          onChange={onGoal}
          onBlur={() => flush('goal')}
        />
        <Stepper
          label="Thẻ mới mỗi ngày"
          name="new"
          description="Thẻ đến hạn không bị giới hạn."
          error={newError}
          value={newCards}
          range={NEW_CARDS}
          onChange={onNew}
          onBlur={() => flush('new')}
        />
      </section>

      <section className="settings-group" aria-labelledby="st-voice">
        <h2 id="st-voice">Giọng đọc</h2>

        <div className="voice-part">
          <h3>Tiếng Anh</h3>
          {!supported ? (
            <TtsUnsupportedNote>Trình duyệt này không hỗ trợ đọc tiếng Anh. Hãy thử Chrome hoặc Edge.</TtsUnsupportedNote>
          ) : (
            <>
              {loaded && voices.length === 0 ? (
                <p className="settings-mute">Thiết bị chưa cài giọng tiếng Anh.</p>
              ) : (
                <div className="voice-row">
                  <Field
                    as="select"
                    label="Giọng trình duyệt"
                    lang="en"
                    value={loaded ? voiceValue : ''}
                    disabled={!loaded}
                    onChange={(e) => persist({ voice_name: e.target.value || null })}
                  >
                    {!loaded ? (
                      <option value="">Đang tải giọng…</option>
                    ) : (
                      <>
                        <option value="">Tự động</option>
                        {voices.map((v) => (
                          <option key={`${v.name}-${v.lang}`} value={v.name}>
                            {v.name} · {v.lang}
                          </option>
                        ))}
                      </>
                    )}
                  </Field>
                  <Button
                    variant="secondary"
                    disabled={!loaded}
                    onClick={() => {
                      cancelTts()
                      speakDevice({ text: 'Nice to meet you.', voiceName: settings.voice_name }).catch(() => {})
                    }}
                  >
                    <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
                    Nghe thử
                  </Button>
                </div>
              )}
              <SwitchRow
                id="auto-speak"
                label="Tự phát âm sau khi lật thẻ"
                description="Tắt nếu bạn hay học ở nơi yên tĩnh."
                checked={settings.auto_speak}
                onChange={(v) => persist({ auto_speak: v })}
              />
              <p className="settings-mute">Giọng phụ thuộc vào thiết bị; trên máy khác có thể khác.</p>
            </>
          )}
          <SwitchRow
            id="en-server"
            label="Dùng server local cho tiếng Anh"
            description="Dành cho server như Kokoro. Giọng từ model tiếng Việt có thể không chuẩn tiếng Anh."
            checked={ttsCfg.en.useServer}
            onChange={(v) => saveTts((c) => ({ ...c, en: { ...c.en, useServer: v } }))}
          />
          {ttsCfg.en.useServer && (
            <TtsServerFields
              lang="en"
              values={{ baseUrl: ttsCfg.en.baseUrl, voice: ttsCfg.en.voice }}
              onChange={(p) => saveTts((c) => ({ ...c, en: { ...c.en, ...p } }))}
            />
          )}
        </div>

        <div className="voice-part voice-part-rule">
          <h3>Tiếng Việt</h3>
          <SwitchRow
            id="vi-server"
            label="Đọc tiếng Việt bằng server local"
            description="Đọc nghĩa, lưu ý phát âm và phần hỏi giáo viên bằng giọng Việt tự nhiên. Cần một máy tính đang chạy VieNeu-TTS."
            checked={ttsCfg.vi.enabled}
            onChange={(v) => saveTts((c) => ({ ...c, vi: { ...c.vi, enabled: v } }))}
          />
          {ttsCfg.vi.enabled && (
            <TtsServerFields
              lang="vi"
              values={{ baseUrl: ttsCfg.vi.baseUrl, voice: ttsCfg.vi.voice, speed: ttsCfg.vi.speed }}
              onChange={(p) => saveTts((c) => ({ ...c, vi: { ...c.vi, ...p } }))}
            />
          )}
          {viDevice && (
            <SwitchRow
              id="vi-device"
              label="Khi không có server, dùng giọng tiếng Việt của thiết bị"
              description="Chất lượng thường kém hơn nhiều."
              checked={ttsCfg.vi.deviceFallback}
              onChange={(v) => saveTts((c) => ({ ...c, vi: { ...c.vi, deviceFallback: v } }))}
            />
          )}
          <details className="voice-guide">
            <summary>Cài VieNeu-TTS trên máy tính (3 lệnh)</summary>
            <pre lang="en">
              <code>{`git clone https://github.com/pnnbao97/VieNeu-TTS.git && cd VieNeu-TTS
uv sync
uv run python -m apps.openai_speech`}</code>
            </pre>
            <p className="settings-mute">
              Cần cài uv trước (xem README của VieNeu-TTS). Server chạy ở <code lang="en">http://localhost:8000</code>. Chỉ dùng
              được khi máy tính đang bật server; điện thoại phải cùng Wi-Fi và dùng địa chỉ IP của máy tính thay cho localhost.
            </p>
            <p className="settings-mute">
              Muốn dùng ngoài nhà hoặc trên trang https, cho server chạy qua https (Tailscale hoặc Cloudflare Tunnel) rồi dán địa
              chỉ https vào ô trên.
            </p>
            <p className="settings-mute">
              Miễn phí, mã nguồn mở (Apache-2.0); chạy được trên CPU, câu ngắn mất khoảng 1–3 giây.
            </p>
          </details>
        </div>

        <p className="settings-mute voice-privacy">
          <Info size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>Chỉ câu đang học được gửi tới server bạn tự cấu hình. Không gửi API key, không gửi dữ liệu khác.</span>
        </p>
      </section>

      <section className="settings-group" aria-labelledby="st-data">
        <h2 id="st-data">Dữ liệu</h2>
        <div className="data-actions">
          <Button variant="secondary" onClick={exportData}>
            <Download size={20} strokeWidth={1.75} aria-hidden="true" />
            Xuất dữ liệu (JSON)
          </Button>
          {fileSupported && (
            <Button
              variant="secondary"
              disabled={importBlocked || importStatus.kind === 'reading' || importing}
              aria-describedby={importBlocked ? 'import-blocked' : undefined}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={20} strokeWidth={1.75} aria-hidden="true" />
              Nhập dữ liệu (JSON)
            </Button>
          )}
        </div>
        {fileSupported && (
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onPickFile(e.currentTarget)}
          />
        )}
        <p className="settings-mute">
          Tệp gồm buổi học, mục, thẻ và lịch sử ngày học của bạn. Nhập tệp đã xuất để khôi phục hoặc gộp vào dữ liệu hiện có.
        </p>
        {!fileSupported && (
          <p className="data-note">
            <Info size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>Trình duyệt này không chọn được tệp. Hãy thử Chrome, Edge hoặc Safari mới.</span>
          </p>
        )}
        {fileSupported && importBlocked && (
          <p id="import-blocked" className="settings-mute">
            {IMPORT_BLOCKED_MESSAGE}
          </p>
        )}
        <div aria-live="polite" className="data-status">
          {importStatus.kind === 'reading' && <Spinner label="Đang đọc tệp…" />}
        </div>
        {importStatus.kind === 'error' && (
          <p role="alert" className="data-error">
            {importStatus.message}
          </p>
        )}
        {mode === 'local' && (
          <div className="settings-danger">
            <Button
              variant="danger"
              onClick={() => {
                setWipeText('')
                setWipeOpen(true)
              }}
            >
              <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
              Xoá toàn bộ dữ liệu trên thiết bị này
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={preview !== null}
        title="Nhập dữ liệu từ tệp?"
        description={
          preview && isEmptyPlan(preview)
            ? 'Không có gì mới để nhập. Dữ liệu trong tệp đã có sẵn.'
            : 'Dữ liệu hiện có được giữ nguyên. Bản ghi trùng id sẽ được cập nhật theo tệp.'
        }
        confirmLabel={importing ? 'Đang nhập…' : 'Nhập'}
        confirmVariant="primary"
        confirmDisabled={importing || (preview !== null && isEmptyPlan(preview) && !(includeSettings && preview.settings))}
        onConfirm={() => void confirmImport()}
        onCancel={() => {
          if (!importing) setImportStatus({ kind: 'idle' })
        }}
      >
        {preview && (
          <>
            <ul className="import-summary">
              <li>
                Buổi học: thêm {preview.counts.lessons.add}, cập nhật {preview.counts.lessons.update}
              </li>
              <li>
                Mục: thêm {preview.counts.items.add}, cập nhật {preview.counts.items.update}
              </li>
              <li>
                Thẻ ôn: thêm {preview.counts.cards.add}, cập nhật {preview.counts.cards.update}
              </li>
              <li>Ngày học: cộng thêm cho {preview.counts.studyDays} ngày</li>
              {preview.counts.skipped > 0 && (
                <li className="import-skipped">Bỏ qua {preview.counts.skipped} bản ghi không hợp lệ hoặc trùng.</li>
              )}
            </ul>
            {preview.settings && (
              <label className="import-check">
                <input
                  type="checkbox"
                  checked={includeSettings}
                  disabled={importing}
                  aria-describedby="import-settings-desc"
                  onChange={(e) => setIncludeSettings(e.target.checked)}
                />
                <span className="import-check-text">
                  <span className="import-check-label">Nhập cả cài đặt</span>
                  <span id="import-settings-desc" className="settings-mute">
                    Tên hiển thị, mục tiêu mỗi ngày, thẻ mới mỗi ngày, giọng đọc, tự phát âm, ngôn ngữ đang học.
                  </span>
                </span>
              </label>
            )}
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={signOutOpen}
        title="Đăng xuất?"
        description={signOutDesc}
        confirmLabel="Đăng xuất"
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setSignOutOpen(false)}
      />

      <ConfirmDialog
        open={wipeOpen}
        title="Xoá toàn bộ dữ liệu?"
        description="Mọi buổi học, thẻ và lịch sử trên trình duyệt này sẽ mất. Gõ XOA để xác nhận."
        confirmLabel="Xoá hết"
        confirmDisabled={wipeText.trim().toUpperCase() !== 'XOA'}
        onConfirm={wipe}
        onCancel={() => setWipeOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            wipe()
          }}
        >
          <Field
            label="Gõ XOA để xác nhận"
            value={wipeText}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(e) => setWipeText(e.target.value)}
          />
        </form>
      </ConfirmDialog>
    </div>
  )
}

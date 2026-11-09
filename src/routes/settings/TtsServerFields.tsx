import { Check, CircleAlert, Info, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Spinner } from '../../components/Spinner'
import { useTts } from '../../hooks/useTts'
import { getHealth, listVoices, probe, resetServer, subscribe, TtsError, type TtsLang, type TtsVoice } from '../../lib/tts'
import { classifyHost, isMixedContentBlocked, normalizeBaseUrl, VI_SPEEDS } from '../../lib/ttsConfig'
import './TtsServerFields.css'

const URL_DEBOUNCE_MS = 600

export interface ServerValues {
  baseUrl: string
  voice: string
  speed?: number
}

interface Props {
  lang: TtsLang
  values: ServerValues
  onChange(patch: Partial<ServerValues>): void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; ms: number; voices: number | null }
  | { kind: 'error'; error: TtsError }

const COPY = {
  en: { urlPlaceholder: 'http://localhost:8880', voicePlaceholder: 'af_heart', sample: 'Nice to meet you.' },
  vi: { urlPlaceholder: 'http://localhost:8000', voicePlaceholder: 'Hải Đăng', sample: 'Rất vui được gặp bạn.' },
} as const

const MIXED_MESSAGE =
  'Trang này mở bằng HTTPS nên trình duyệt chặn kết nối http tới địa chỉ mạng nội bộ. Mở app qua http trên cùng mạng, hoặc chạy server qua https.'

function errorMessage(e: TtsError): ReactNode {
  switch (e.kind) {
    case 'timeout':
      return 'Quá 4 giây không phản hồi. Server có đang chạy không?'
    case 'blocked':
      return MIXED_MESSAGE
    case 'http':
      return `Server trả lỗi ${e.status ?? ''}.`.replace(' .', '.')
    case 'busy':
      return 'Server đang bận. Thử lại sau vài giây.'
    case 'network':
      return (
        <>
          Không kết nối được. Kiểm tra server đã chạy và địa chỉ đúng chưa. Nếu server đang chạy trên máy khác, khởi động với{' '}
          <code lang="en">--host 0.0.0.0</code> và cho phép CORS từ <code lang="en">{window.location.origin}</code>.
        </>
      )
    default:
      return 'Không phát được giọng đọc. Kiểm tra cấu hình server.'
  }
}

/** Nhóm trường cấu hình server TTS (dùng chung cho tiếng Anh và tiếng Việt). Lưu ngay vào ttsConfig qua `onChange`. */
export function TtsServerFields({ lang, values, onChange }: Props) {
  const copy = COPY[lang]
  const tts = useTts()
  const health = useSyncExternalStore(
    subscribe,
    () => getHealth(lang),
    () => 'unknown' as const,
  )

  const [url, setUrl] = useState(values.baseUrl)
  const [urlHint, setUrlHint] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [voices, setVoices] = useState<TtsVoice[] | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef({ values, onChange, url })
  const abort = useRef<AbortController | null>(null)
  useEffect(() => {
    latest.current = { values, onChange, url }
  })

  const normalized = normalizeBaseUrl(url)
  const urlError = normalized.ok ? null : normalized.error
  const mixed = normalized.ok && isMixedContentBlocked(normalized.value)
  const urlInvalid = !normalized.ok || mixed
  const host = normalized.ok ? classifyHost(normalized.value) : null

  const commitUrl = useCallback(
    (raw: string): string | null => {
      window.clearTimeout(timer.current)
      timer.current = undefined
      const n = normalizeBaseUrl(raw)
      if (!n.ok) return null
      setUrlHint(n.hint ?? null)
      if (n.value !== latest.current.values.baseUrl) {
        latest.current.onChange({ baseUrl: n.value })
        abort.current?.abort()
        setStatus({ kind: 'idle' })
        setVoices(null)
      }
      return n.value
    },
    [],
  )

  const onUrl = (raw: string) => {
    setUrl(raw)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => commitUrl(raw), URL_DEBOUNCE_MS)
  }
  const onUrlBlur = () => {
    const v = commitUrl(url)
    if (v) setUrl(v)
  }

  useEffect(
    () => () => {
      // Rời trang: lưu nốt địa chỉ đang gõ dở, huỷ kiểm tra đang chạy.
      if (timer.current !== undefined) commitUrl(latest.current.url)
      abort.current?.abort()
    },
    [commitUrl],
  )

  const check = async () => {
    const committed = commitUrl(url)
    if (committed === null) return
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setStatus({ kind: 'checking' })
    const r = await probe(lang, ac.signal)
    if (ac.signal.aborted) return
    if (!r.ok) {
      setStatus({ kind: 'error', error: r.error })
      return
    }
    setStatus({ kind: 'ok', ms: r.ms, voices: r.voices })
    try {
      const list = await listVoices(lang, ac.signal)
      if (!ac.signal.aborted && list.length > 0) setVoices(list)
    } catch {
      /* giữ ô text */
    }
  }

  const listen = () => {
    if (commitUrl(url) === null) return
    resetServer(lang)
    tts.speak(copy.sample, { lang }).catch((e: unknown) => {
      if (e instanceof TtsError && e.kind !== 'cancelled') setStatus({ kind: 'error', error: e })
    })
  }

  const voiceValue = values.voice
  const voiceList = voices && voiceValue && !voices.some((v) => v.id === voiceValue) ? [{ id: voiceValue, label: voiceValue }, ...voices] : voices
  const checking = status.kind === 'checking'

  return (
    <div className="tts-fields">
      <div className="tts-field-url">
        <Field
          label="Địa chỉ server"
          name={`tts-${lang}-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={copy.urlPlaceholder}
          lang="en"
          value={url}
          error={urlError ?? (mixed ? MIXED_MESSAGE : null)}
          description={urlHint ?? undefined}
          onChange={(e) => onUrl(e.target.value)}
          onBlur={onUrlBlur}
        />
        {host === 'public' && (
          <p className="tts-note">
            <Info size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>Địa chỉ này không thuộc mạng nội bộ. Server đó sẽ nhận nội dung bạn học.</span>
          </p>
        )}
      </div>

      {voiceList ? (
        <Field
          as="select"
          label="Giọng"
          lang={lang === 'en' ? 'en' : undefined}
          value={voiceValue}
          onChange={(e) => {
            onChange({ voice: e.target.value })
          }}
        >
          <option value="">Mặc định của server</option>
          {voiceList.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Field>
      ) : (
        <Field
          label="Giọng"
          name={`tts-${lang}-voice`}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          placeholder={copy.voicePlaceholder}
          value={voiceValue}
          onChange={(e) => {
            onChange({ voice: e.target.value })
          }}
        />
      )}

      {lang === 'vi' && values.speed !== undefined && (
        <Field
          as="select"
          label="Tốc độ"
          value={String(values.speed)}
          onChange={(e) => onChange({ speed: Number(e.target.value) })}
        >
          {VI_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s.toFixed(1).replace('.', ',')}x
            </option>
          ))}
        </Field>
      )}

      <div className="tts-actions">
        <Button variant="secondary" disabled={urlInvalid || checking} onClick={() => void check()}>
          Kiểm tra kết nối
        </Button>
        <Button variant="secondary" disabled={urlInvalid} onClick={listen}>
          <Volume2 size={20} strokeWidth={1.75} aria-hidden="true" />
          Nghe thử
        </Button>
      </div>

      <div className="tts-status" aria-live="polite">
        {status.kind === 'idle' && <p className="tts-status-line tts-mute">Chưa kiểm tra.</p>}
        {status.kind === 'checking' && (
          <p className="tts-status-line">
            <Spinner label="Đang kiểm tra…" />
          </p>
        )}
        {status.kind === 'ok' && (
          <p className="tts-status-line">
            <Check className="tts-icon-ok" size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Kết nối được · {status.ms} ms{status.voices !== null ? ` · ${status.voices} giọng` : ''}
            </span>
          </p>
        )}
        {status.kind === 'error' && (
          <p className="tts-status-line">
            <CircleAlert className="tts-icon-err" size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{errorMessage(status.error)}</span>
          </p>
        )}
      </div>

      {lang === 'en' && health === 'down' && (
        <p className="tts-mute tts-line">Đang tạm dùng giọng trình duyệt vì không kết nối được server.</p>
      )}
    </div>
  )
}

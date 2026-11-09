import { ClipboardPaste, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field } from '../components/Field'
import { PageTitle } from '../components/PageTitle'
import {
  duplicateRows,
  isBlankItem,
  nextLessonNumber,
  validateItem,
  validateLesson,
  type ItemField,
  type LessonField,
} from '../domain/lessons'
import { PASTE_MAX_LINES, parsePastedList } from '../domain/paste'
import { KIND_LABELS, KINDS, type Item, type Kind, type Lesson, type Snapshot } from '../domain/types'
import { usePageTitle } from '../hooks/usePageTitle'
import { addDays, localDay } from '../lib/dates'
import { newId } from '../lib/ids'
import { useAuth } from '../state/useAuth'
import { MSG_WRITE_ERROR } from '../state/messages'
import { useData } from '../state/useData'
import NotFound from './NotFound'
import './LessonEdit.css'

interface Row {
  key: string
  /** id item đã lưu; null = hàng mới. */
  itemId: string | null
  kind: Kind
  en: string
  vi: string
  ipa: string
  note: string
}

interface FormState {
  number: string
  date: string
  topic: string
  questions: string
  mistakes: string
  notes: string
  rows: Row[]
}

const LESSON_FIELDS: LessonField[] = ['number', 'date', 'topic']
const TAIL_FIELDS: LessonField[] = ['questions', 'mistakes', 'notes']
const ROW_FIELDS: ItemField[] = ['en', 'vi', 'ipa', 'note']

const emptyRow = (): Row => ({ key: newId(), itemId: null, kind: 'phrase', en: '', vi: '', ipa: '', note: '' })

function initialForm(snapshot: Snapshot, lesson: Lesson | undefined): FormState {
  if (!lesson) {
    return {
      number: String(nextLessonNumber(snapshot.lessons)),
      date: localDay(new Date()),
      topic: '',
      questions: '',
      mistakes: '',
      notes: '',
      rows: [emptyRow(), emptyRow(), emptyRow()],
    }
  }
  const items = snapshot.items
    .filter((i) => i.lesson_id === lesson.id)
    .sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : 1))
  return {
    number: String(lesson.number),
    date: lesson.date,
    topic: lesson.topic,
    questions: lesson.questions,
    mistakes: lesson.mistakes,
    notes: lesson.notes,
    rows: items.length
      ? items.map((i) => ({ key: i.id, itemId: i.id, kind: i.kind, en: i.en, vi: i.vi, ipa: i.ipa, note: i.note }))
      : [emptyRow()],
  }
}

/** So sánh nội dung (bỏ qua `key` của hàng mới trống). */
function serialize(f: FormState): string {
  const rows = f.rows
    .filter((r) => r.itemId || !isBlankItem(r))
    .map((r) => [r.itemId, r.kind, r.en, r.vi, r.ipa, r.note])
  return JSON.stringify([f.number, f.date, f.topic, f.questions, f.mistakes, f.notes, rows])
}

const fieldId = (name: string) => `lesson-${name}`
const rowFieldId = (key: string, field: string) => `row-${key}-${field}`

type Errors = Record<string, string>

export default function LessonEdit() {
  const { id } = useParams()
  const isNew = id === undefined
  const { snapshot } = useData()
  const lesson = id ? snapshot?.lessons.find((l) => l.id === id) : undefined

  if (!snapshot || (!isNew && !lesson)) return <NotFound />
  return <LessonForm key={id ?? 'new'} snapshot={snapshot} lesson={lesson} />
}

function LessonForm({ snapshot, lesson }: { snapshot: Snapshot; lesson: Lesson | undefined }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { createLesson, updateLesson, saveItems, deleteItem, notify } = useData()

  const [initial] = useState(() => initialForm(snapshot, lesson))
  const [today] = useState(() => localDay(new Date()))
  const [form, setForm] = useState<FormState>(initial)
  const [openExtras, setOpenExtras] = useState<Set<string>>(
    () => new Set(initial.rows.filter((r) => r.ipa || r.note).map((r) => r.key)),
  )
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removeKey, setRemoveKey] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const savedRef = useRef(false)
  const focusRef = useRef<string | null>(null)
  const pasteBtnRef = useRef<HTMLButtonElement>(null)

  const title = lesson ? `Sửa buổi ${lesson.number}` : 'Ghi buổi học'
  usePageTitle(title)

  const dirty = useMemo(() => serialize(form) !== serialize(initial), [form, initial])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !savedRef.current && dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!focusRef.current) return
    const el = document.getElementById(focusRef.current)
    focusRef.current = null
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'center' })
  }, [form.rows, openExtras])

  const cardsByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of snapshot.cards) m.set(c.item_id, Math.max(m.get(c.item_id) ?? 0, c.reps))
    return m
  }, [snapshot.cards])

  const parsed = useMemo(() => parsePastedList(pasteText), [pasteText])

  const dupes = useMemo(() => duplicateRows(form.rows), [form.rows])

  function validate(f: FormState): Errors {
    const out: Errors = {}
    const le = validateLesson(f, { lessons: snapshot.lessons, selfId: lesson?.id ?? null, today: localDay(new Date()) })
    for (const [k, v] of Object.entries(le)) out[fieldId(k)] = v
    for (const r of f.rows) {
      const ie = validateItem(r, { required: r.itemId !== null })
      for (const [k, v] of Object.entries(ie)) out[rowFieldId(r.key, k)] = v
    }
    return out
  }

  /** Thứ tự DOM của các trường để focus lỗi đầu tiên. */
  function fieldOrder(f: FormState): string[] {
    return [
      ...LESSON_FIELDS.map(fieldId),
      ...f.rows.flatMap((r) => ROW_FIELDS.map((k) => rowFieldId(r.key, k))),
      ...TAIL_FIELDS.map(fieldId),
    ]
  }

  function update(next: FormState) {
    setForm(next)
    if (submitted) setErrors(validate(next))
  }

  const setField = (name: Exclude<keyof FormState, 'rows'>, value: string) => update({ ...form, [name]: value })

  const setRow = (key: string, patch: Partial<Row>) =>
    update({ ...form, rows: form.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })

  function addRow() {
    const row = emptyRow()
    focusRef.current = rowFieldId(row.key, 'en')
    update({ ...form, rows: [...form.rows, row] })
  }

  function addPastedRows() {
    if (parsed.tooMany || parsed.rows.length === 0) return
    const fresh = parsed.rows.map((p) => ({
      ...emptyRow(),
      kind: p.kind,
      en: p.en,
      vi: p.vi,
      ipa: p.ipa,
      note: p.note,
    }))
    const kept = form.rows.filter((r) => !(r.itemId === null && isBlankItem(r)))
    setOpenExtras((s) => {
      const next = new Set(s)
      for (const r of fresh) if (r.ipa || r.note) next.add(r.key)
      return next
    })
    focusRef.current = rowFieldId(fresh[0].key, 'en')
    update({ ...form, rows: [...kept, ...fresh] })
    setPasteText('')
    setPasteOpen(false)
    notify(`Đã thêm ${fresh.length} mục. Kiểm tra rồi bấm Lưu.`)
  }

  function closePaste() {
    setPasteOpen(false)
    requestAnimationFrame(() => pasteBtnRef.current?.focus())
  }

  function onPasteKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      addPastedRows()
    }
  }

  function removeRow(key: string) {
    const rows = form.rows.filter((r) => r.key !== key)
    const idx = form.rows.findIndex((r) => r.key === key)
    const neighbour = rows[Math.min(idx, rows.length - 1)]
    if (neighbour) focusRef.current = rowFieldId(neighbour.key, 'en')
    update({ ...form, rows })
  }

  function requestRemove(row: Row) {
    if (row.itemId && (cardsByItem.get(row.itemId) ?? 0) > 0) setRemoveKey(row.key)
    else removeRow(row.key)
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    const t = e.target as HTMLElement
    if (!(t instanceof HTMLInputElement)) return
    e.preventDefault()
    const last = form.rows[form.rows.length - 1]
    if (last && t.id === rowFieldId(last.key, 'vi')) addRow()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSubmitted(true)
    const errs = validate(form)
    setErrors(errs)
    const first = fieldOrder(form).find((k) => errs[k])
    if (first) {
      // mở ô phụ nếu lỗi nằm ở IPA/ghi chú
      const row = form.rows.find((r) => first === rowFieldId(r.key, 'ipa') || first === rowFieldId(r.key, 'note'))
      if (row) setOpenExtras((s) => new Set(s).add(row.key))
      requestAnimationFrame(() => {
        const el = document.getElementById(first)
        el?.scrollIntoView({ block: 'center' })
        el?.focus({ preventScroll: true })
      })
      return
    }

    setSaving(true)
    const now = new Date().toISOString()
    const lessonId = lesson?.id ?? newId()
    const userId = lesson?.user_id ?? user?.id ?? snapshot.settings.user_id
    const number = Number(form.number.trim())
    const record: Lesson = {
      id: lessonId,
      user_id: userId,
      number,
      date: form.date,
      topic: form.topic.trim(),
      questions: form.questions.trim(),
      mistakes: form.mistakes.trim(),
      notes: form.notes.trim(),
      created_at: lesson?.created_at ?? now,
      updated_at: now,
    }

    const existing = new Map(snapshot.items.filter((i) => i.lesson_id === lessonId).map((i) => [i.id, i]))
    const kept = form.rows.filter((r) => r.itemId !== null || !isBlankItem(r))
    const changed: Item[] = []
    let created = 0
    kept.forEach((r, position) => {
      const prev = r.itemId ? existing.get(r.itemId) : undefined
      const next = {
        kind: r.kind,
        en: r.en.trim(),
        vi: r.vi.trim(),
        ipa: r.ipa.trim(),
        note: r.note.trim(),
        position,
      }
      if (prev) {
        const same = (Object.keys(next) as (keyof typeof next)[]).every((k) => prev[k] === next[k])
        if (!same) changed.push({ ...prev, ...next, updated_at: now })
      } else {
        created += 1
        changed.push({
          id: newId(),
          user_id: userId,
          lesson_id: lessonId,
          pattern_id: null,
          created_at: now,
          updated_at: now,
          ...next,
        })
      }
    })
    const keptIds = new Set(kept.map((r) => r.itemId).filter(Boolean))
    // chỉ xoá item mà form đã nạp lúc mở (không đụng item thiết bị khác vừa thêm)
    const initialIds = initial.rows.map((r) => r.itemId).filter((x): x is string => x !== null)
    const removed = initialIds.filter((itemId) => !keptIds.has(itemId) && existing.has(itemId))

    try {
      await (lesson ? updateLesson : createLesson)(record)
      for (const itemId of removed) await deleteItem(itemId)
      await saveItems(changed)
    } catch {
      setSaving(false)
      notify(MSG_WRITE_ERROR, 'error')
      return
    }

    savedRef.current = true
    notify(created > 0 ? `Đã lưu buổi ${number}. ${created} thẻ ôn mới.` : `Đã lưu buổi ${number}.`)
    navigate(`/lessons/${lessonId}`, { replace: !lesson })
  }

  const cancel = () => navigate(lesson ? `/lessons/${lesson.id}` : '/lessons')

  const errorCount = Object.keys(errors).length

  return (
    <section className="lesson-edit" aria-labelledby="lesson-edit-title">
      <PageTitle id="lesson-edit-title">{title}</PageTitle>

      <form className="card lesson-form" noValidate onSubmit={onSubmit} onKeyDown={onKeyDown}>
        {errorCount > 0 && (
          <p className="lesson-form-summary" role="alert">
            Có {errorCount} chỗ cần sửa.
          </p>
        )}

        <div className="lesson-form-head">
          <Field
            id={fieldId('number')}
            label="Buổi số"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            step={1}
            className="lesson-number"
            value={form.number}
            error={errors[fieldId('number')]}
            onChange={(e) => setField('number', e.target.value)}
          />
          <Field
            id={fieldId('date')}
            label="Ngày"
            type="date"
            max={addDays(today, 1)}
            value={form.date}
            error={errors[fieldId('date')]}
            onChange={(e) => setField('date', e.target.value)}
          />
        </div>
        <Field
          id={fieldId('topic')}
          label="Chủ đề"
          value={form.topic}
          error={errors[fieldId('topic')]}
          onChange={(e) => setField('topic', e.target.value)}
        />

        <section className="lesson-form-block" aria-labelledby="lesson-items-title">
          <h2 id="lesson-items-title" className="lesson-form-heading">
            Mục trong buổi
          </h2>
          <p className="lesson-form-desc">
            Mỗi mục sẽ thành một thẻ ôn Anh → Việt. Hai chiều còn lại mở sau khi bạn ôn thẻ đó ở hai ngày khác nhau.
          </p>

          <ol className="item-rows">
            {form.rows.map((r, i) => {
              const n = i + 1
              const open = openExtras.has(r.key)
              const dup = dupes.get(i)
              return (
                <li key={r.key} className="item-row-item">
                  <fieldset className="item-row-fields">
                    <legend className="visually-hidden">Mục {n}</legend>
                    <div className="item-row-main">
                      <Field
                        as="select"
                        id={rowFieldId(r.key, 'kind')}
                        label="Loại"
                        className="lesson-kind"
                        value={r.kind}
                        onChange={(e) => setRow(r.key, { kind: e.target.value as Kind })}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABELS[k]}
                          </option>
                        ))}
                      </Field>
                      <Field
                        id={rowFieldId(r.key, 'en')}
                        label="Tiếng Anh"
                        lang="en"
                        autoCapitalize="sentences"
                        spellCheck
                        placeholder="Can I have the bill, please?"
                        value={r.en}
                        description={dup !== undefined ? `Mục này trùng với dòng ${dup + 1}` : undefined}
                        error={errors[rowFieldId(r.key, 'en')]}
                        onChange={(e) => setRow(r.key, { en: e.target.value })}
                      />
                      <Field
                        id={rowFieldId(r.key, 'vi')}
                        label="Tiếng Việt"
                        placeholder="Cho tôi tính tiền"
                        value={r.vi}
                        error={errors[rowFieldId(r.key, 'vi')]}
                        onChange={(e) => setRow(r.key, { vi: e.target.value })}
                      />
                      <button
                        type="button"
                        className="item-row-remove"
                        aria-label={`Xoá mục ${n}`}
                        onClick={() => requestRemove(r)}
                      >
                        <X size={20} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>

                    {open ? (
                      <div className="item-row-extra">
                        <Field
                          id={rowFieldId(r.key, 'ipa')}
                          label="Phiên âm"
                          lang="en"
                          placeholder="/kæn aɪ hæv ðə bɪl/"
                          value={r.ipa}
                          error={errors[rowFieldId(r.key, 'ipa')]}
                          onChange={(e) => setRow(r.key, { ipa: e.target.value })}
                        />
                        <Field
                          id={rowFieldId(r.key, 'note')}
                          label="Ghi chú"
                          placeholder="Lỗi hay mắc, cách dùng…"
                          value={r.note}
                          error={errors[rowFieldId(r.key, 'note')]}
                          onChange={(e) => setRow(r.key, { note: e.target.value })}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className="item-row-more"
                        onClick={() => {
                          focusRef.current = rowFieldId(r.key, 'ipa')
                          setOpenExtras((s) => new Set(s).add(r.key))
                        }}
                      >
                        Thêm phiên âm / ghi chú
                      </Button>
                    )}
                  </fieldset>
                </li>
              )
            })}
          </ol>

          <div className="lesson-add-actions">
            <Button variant="ghost" className="lesson-add-row" onClick={addRow}>
              <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
              Thêm mục
            </Button>
            <Button
              variant="ghost"
              aria-expanded={pasteOpen}
              aria-controls="paste-panel"
              ref={pasteBtnRef}
              onClick={() => (pasteOpen ? closePaste() : setPasteOpen(true))}
            >
              <ClipboardPaste size={20} strokeWidth={1.75} aria-hidden="true" />
              Dán danh sách
            </Button>
          </div>

          {pasteOpen && (
            <div id="paste-panel" className="paste-panel">
              <Field
                as="textarea"
                id="lesson-paste"
                label="Dán mỗi dòng một mục"
                description="Tiếng Anh và tiếng Việt cách nhau bằng dấu gạch ngang, dấu | hoặc tab. Phần thứ ba, nếu có, là phiên âm /…/ hoặc ghi chú."
                rows={6}
                spellCheck={false}
                autoCapitalize="off"
                autoFocus
                placeholder={'Can I have the bill, please? - Cho tôi tính tiền\nbill - hoá đơn - /bɪl/'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                onKeyDown={onPasteKeyDown}
              />
              <div className="paste-status" aria-live="polite">
                {parsed.tooMany ? (
                  <p className="paste-error" role="alert">
                    Tối đa {PASTE_MAX_LINES} dòng mỗi lần dán. Hiện có {parsed.total} dòng.
                  </p>
                ) : (
                  parsed.rows.length > 0 && (
                    <p className="paste-summary">
                      {`${parsed.rows.length} mục sẽ được thêm${
                        parsed.missingVi > 0 ? ` · ${parsed.missingVi} dòng chưa có nghĩa tiếng Việt` : ''
                      }`}
                    </p>
                  )
                )}
              </div>
              {parsed.rows.length > 0 && (
                <ol className="paste-preview">
                  {parsed.rows.map((p) => (
                    <li key={p.line} className="paste-preview-row">
                      <span className="paste-en" lang="en">
                        {p.en}
                      </span>
                      <span className={p.vi ? 'paste-vi' : 'paste-vi paste-vi--missing'}>
                        {p.vi || 'chưa có nghĩa'}
                      </span>
                      {(p.ipa || p.note) && (
                        <span className="paste-extra">{[p.ipa, p.note].filter(Boolean).join(' · ')}</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <div className="paste-actions">
                <Button disabled={parsed.tooMany || parsed.rows.length === 0} onClick={addPastedRows}>
                  Thêm vào buổi
                </Button>
                <Button variant="ghost" onClick={closePaste}>
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </section>

        <div className="lesson-form-block">
          <Field
            as="textarea"
            id={fieldId('questions')}
            label="Hỏi giáo viên"
            rows={3}
            placeholder="Những gì chưa rõ, để hỏi buổi sau"
            value={form.questions}
            error={errors[fieldId('questions')]}
            onChange={(e) => setField('questions', e.target.value)}
          />
          <Field
            as="textarea"
            id={fieldId('mistakes')}
            label="Lỗi hay gặp"
            rows={2}
            className="lesson-mistakes-input"
            description="Bọc từ cần nhấn bằng dấu *, ví dụ: quên âm cuối /t/ trong *get*, *it*"
            value={form.mistakes}
            error={errors[fieldId('mistakes')]}
            onChange={(e) => setField('mistakes', e.target.value)}
          />
          <Field
            as="textarea"
            id={fieldId('notes')}
            label="Ghi chú"
            rows={3}
            value={form.notes}
            error={errors[fieldId('notes')]}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>

        <div className="lesson-form-actions">
          <Button variant="secondary" onClick={cancel}>
            Huỷ
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu…' : lesson ? 'Lưu' : 'Lưu buổi học'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Bỏ thay đổi?"
        description="Những gì bạn vừa nhập sẽ mất."
        cancelLabel="Ở lại"
        confirmLabel="Bỏ thay đổi"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
      <ConfirmDialog
        open={removeKey !== null}
        title="Xoá mục này?"
        description="Thẻ ôn và lịch sử của nó cũng bị xoá."
        confirmLabel="Xoá mục"
        onConfirm={() => {
          if (removeKey) removeRow(removeKey)
          setRemoveKey(null)
        }}
        onCancel={() => setRemoveKey(null)}
      />
    </section>
  )
}

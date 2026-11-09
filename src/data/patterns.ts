/**
 * Dữ liệu seed: 9 tình huống giao tiếp, mỗi tình huống 9–10 mẫu câu A1–A2.
 *
 * Quy ước:
 * - `en` / `vi` là mẫu câu có thể chứa ô trống dạng `{key}`. Mỗi `key` phải có
 *   một phần tử tương ứng trong `slots`.
 * - `ipa` là phiên âm (General American, giản lược) của câu đã điền ví dụ đầu tiên
 *   (`fillPattern(p, 0).en`).
 * - `note` là lưu ý phát âm cho người Việt (âm cuối, -s/-ed, trọng âm, nối âm).
 *   Trên giao diện, nhãn "Lưu ý phát âm" dùng chữ đỏ gạch chân mảnh — KHÔNG dùng
 *   viền trái màu dày.
 * - File này là TypeScript thuần, không import React. Không dùng `enum`
 *   (tsconfig bật `erasableSyntaxOnly`).
 */

export type Level = 'A1' | 'A2'

export interface SlotExample {
  en: string
  vi: string
}

export interface Slot {
  /** Tên ô trống, xuất hiện trong `en`/`vi` dưới dạng `{key}`. */
  key: string
  /** Gợi ý tiếng Việt hiển thị dưới ô trống, ví dụ "món ăn". */
  hint: string
  /** Ví dụ điền vào ô trống; phần tử đầu tiên dùng cho IPA, TTS và thẻ ôn. */
  examples: SlotExample[]
}

export interface Pattern {
  /** Định danh ổn định, dạng `<situationId>-<số thứ tự 2 chữ số>`. */
  id: string
  en: string
  vi: string
  ipa: string
  level: Level
  slots?: Slot[]
  /** Lưu ý phát âm cho người Việt. */
  note?: string
}

export interface Situation {
  id: string
  nameVi: string
  nameEn: string
  /** Tên icon trong lucide-react, ví dụ "Utensils". */
  icon: string
  /** 1–2 câu giới thiệu tình huống (tiếng Việt). */
  intro: string
  /** Điểm phát âm người Việt cần để ý trong tình huống này (tiếng Việt). */
  pronunciationFocus: string
  patterns: Pattern[]
}

/* ------------------------------------------------------------------ */
/* Hàm tiện ích thuần                                                   */
/* ------------------------------------------------------------------ */

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Điền ví dụ thứ `exampleIndex` của từng ô trống vào mẫu câu.
 * Nếu ô trống đứng đầu câu tiếng Việt, chữ cái đầu được viết hoa.
 */
export function fillPattern(p: Pattern, exampleIndex = 0): SlotExample {
  const slots = p.slots ?? []
  const pick = (key: string, lang: 'en' | 'vi'): string => {
    const slot = slots.find((s) => s.key === key)
    if (!slot) return `{${key}}`
    const ex = slot.examples[Math.min(exampleIndex, slot.examples.length - 1)]
    return ex ? ex[lang] : `{${key}}`
  }
  const en = p.en.replace(PLACEHOLDER, (_, key: string) => pick(key, 'en'))
  const viRaw = p.vi.replace(PLACEHOLDER, (_, key: string) => pick(key, 'vi'))
  const vi = p.vi.startsWith('{') ? capitalizeFirst(viRaw) : viRaw
  return { en, vi }
}

/** Thay mọi ô trống bằng "____" để hiển thị dạng điền khuyết. */
export function blankPattern(text: string): string {
  return text.replace(PLACEHOLDER, '____')
}

/**
 * Tách mẫu câu thành các đoạn để render: đoạn chữ thường và đoạn ô trống.
 * Dùng cho giao diện vẽ ô trống bằng gạch chân tím.
 */
export type PatternPart =
  | { type: 'text'; value: string }
  | { type: 'slot'; key: string }

export function splitPattern(text: string): PatternPart[] {
  const parts: PatternPart[] = []
  let last = 0
  for (const m of text.matchAll(PLACEHOLDER)) {
    const start = m.index ?? 0
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) })
    parts.push({ type: 'slot', key: m[1] })
    last = start + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

export function findPattern(id: string): Pattern | undefined {
  for (const s of SITUATIONS) {
    const p = s.patterns.find((x) => x.id === id)
    if (p) return p
  }
  return undefined
}

export function findSituation(id: string): Situation | undefined {
  return SITUATIONS.find((s) => s.id === id)
}

/* ------------------------------------------------------------------ */
/* Dữ liệu                                                              */
/* ------------------------------------------------------------------ */

export const SITUATIONS: Situation[] = [
  /* ---------------------------------------------------------------- */
  {
    id: 'greetings',
    nameVi: 'Chào hỏi',
    nameEn: 'Greetings',
    icon: 'Hand',
    intro: 'Chào, hỏi thăm và tạm biệt. Đây là những câu bạn sẽ nói nhiều nhất, nên tập cho tự nhiên.',
    pronunciationFocus:
      'Âm cuối /s/ /z/ /t/ /d/ trong "thanks", "how\'s", "meet", "good". Người Việt hay bỏ hẳn âm cuối; hãy chạm lưỡi dù phát ra rất nhẹ.',
    patterns: [
      {
        id: 'greetings-01',
        en: 'Hi, how are you?',
        vi: 'Chào, bạn khoẻ không?',
        ipa: '/haɪ, haʊ ɑr ju/',
        level: 'A1',
        note: '"are" khi nói nhanh đọc nhẹ thành /ər/.',
      },
      {
        id: 'greetings-02',
        en: "I'm fine, thanks. And you?",
        vi: 'Mình khoẻ, cảm ơn. Còn bạn?',
        ipa: '/aɪm faɪn, θæŋks. ænd ju/',
        level: 'A1',
        note: '"thanks" kết thúc bằng /ks/ — bật cả hai âm, đừng dừng ở "thank".',
      },
      {
        id: 'greetings-03',
        en: 'Good {time}!',
        vi: 'Chào buổi {time}!',
        ipa: '/ɡʊd ˈmɔrnɪŋ/',
        level: 'A1',
        slots: [
          {
            key: 'time',
            hint: 'buổi trong ngày',
            examples: [
              { en: 'morning', vi: 'sáng' },
              { en: 'afternoon', vi: 'chiều' },
              { en: 'evening', vi: 'tối' },
            ],
          },
        ],
        note: '/d/ cuối của "good" chỉ cần chạm lưỡi, nhưng phải có.',
      },
      {
        id: 'greetings-04',
        en: 'Nice to meet you.',
        vi: 'Rất vui được gặp bạn.',
        ipa: '/naɪs tə mit ju/',
        level: 'A1',
        note: '"meet you" nối thành /ˈmitʃu/.',
      },
      {
        id: 'greetings-05',
        en: "How's it going?",
        vi: 'Dạo này thế nào?',
        ipa: '/haʊz ɪt ˈɡoʊɪŋ/',
        level: 'A2',
        note: '"how\'s" có /z/ cuối; "going" kết thúc bằng /ŋ/ mũi.',
      },
      {
        id: 'greetings-06',
        en: 'Long time no see!',
        vi: 'Lâu quá không gặp!',
        ipa: '/lɔŋ taɪm noʊ si/',
        level: 'A2',
      },
      {
        id: 'greetings-07',
        en: 'See you {when}!',
        vi: 'Hẹn gặp lại {when}!',
        ipa: '/si ju təˈmɑroʊ/',
        level: 'A1',
        slots: [
          {
            key: 'when',
            hint: 'khi nào',
            examples: [
              { en: 'tomorrow', vi: 'ngày mai' },
              { en: 'later', vi: 'sau nhé' },
              { en: 'next week', vi: 'tuần sau' },
            ],
          },
        ],
      },
      {
        id: 'greetings-08',
        en: 'Have a nice day!',
        vi: 'Chúc một ngày tốt lành!',
        ipa: '/hæv ə naɪs deɪ/',
        level: 'A1',
        note: '"have a" nối thành /hævə/.',
      },
      {
        id: 'greetings-09',
        en: 'Take care. Bye!',
        vi: 'Giữ gìn sức khoẻ nhé. Tạm biệt!',
        ipa: '/teɪk kɛr. baɪ/',
        level: 'A1',
        note: '/k/ cuối của "take" rất nhẹ nhưng phải có.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'self-intro',
    nameVi: 'Giới thiệu bản thân',
    nameEn: 'Introducing yourself',
    icon: 'User',
    intro: 'Tên, tuổi, quê, công việc, gia đình, sở thích. Chuẩn bị sẵn 5–6 câu về mình để nói trôi chảy.',
    pronunciationFocus:
      'Âm /v/ trong "live", "have" (môi dưới chạm răng trên); /z/ cuối trong "is", "years"; đuôi -ing là /ɪŋ/, không phải /ɪn/.',
    patterns: [
      {
        id: 'self-intro-01',
        en: 'My name is {name}.',
        vi: 'Tôi tên là {name}.',
        ipa: '/maɪ neɪm ɪz læn/',
        level: 'A1',
        slots: [
          {
            key: 'name',
            hint: 'tên bạn',
            examples: [
              { en: 'Lan', vi: 'Lan' },
              { en: 'Minh', vi: 'Minh' },
              { en: 'Hung', vi: 'Hùng' },
            ],
          },
        ],
        note: '"is" đọc /ɪz/, có /z/ cuối.',
      },
      {
        id: 'self-intro-02',
        en: "I'm {age} years old.",
        vi: 'Tôi {age} tuổi.',
        ipa: '/aɪm ˈθɜrti jɪrz oʊld/',
        level: 'A1',
        slots: [
          {
            key: 'age',
            hint: 'tuổi',
            examples: [
              { en: 'thirty', vi: 'ba mươi' },
              { en: 'twenty-five', vi: 'hai mươi lăm' },
              { en: 'forty', vi: 'bốn mươi' },
            ],
          },
        ],
        note: '"years" có /z/ cuối; "old" kết thúc bằng /ld/.',
      },
      {
        id: 'self-intro-03',
        en: "I'm from {place}.",
        vi: 'Tôi đến từ {place}.',
        ipa: '/aɪm frʌm hæˈnɔɪ/',
        level: 'A1',
        slots: [
          {
            key: 'place',
            hint: 'quê / thành phố',
            examples: [
              { en: 'Hanoi', vi: 'Hà Nội' },
              { en: 'Ho Chi Minh City', vi: 'TP. Hồ Chí Minh' },
              { en: 'Da Nang', vi: 'Đà Nẵng' },
            ],
          },
        ],
      },
      {
        id: 'self-intro-04',
        en: 'I live in {place}.',
        vi: 'Tôi sống ở {place}.',
        ipa: '/aɪ lɪv ɪn ˈdɪstrɪkt ˈsɛvən/',
        level: 'A1',
        slots: [
          {
            key: 'place',
            hint: 'nơi ở',
            examples: [
              { en: 'District 7', vi: 'Quận 7' },
              { en: 'Hanoi', vi: 'Hà Nội' },
              { en: 'a small town', vi: 'một thị trấn nhỏ' },
            ],
          },
        ],
        note: '"live" /lɪv/ ngắn, khác "leave" /liv/ dài.',
      },
      {
        id: 'self-intro-05',
        en: 'I work as {job}.',
        vi: 'Tôi làm {job}.',
        ipa: '/aɪ wɜrk əz ən əˈkaʊntənt/',
        level: 'A1',
        slots: [
          {
            key: 'job',
            hint: 'nghề nghiệp',
            examples: [
              { en: 'an accountant', vi: 'kế toán' },
              { en: 'a teacher', vi: 'giáo viên' },
              { en: 'a nurse', vi: 'y tá' },
            ],
          },
        ],
        note: '"as an" nối thành /əzən/.',
      },
      {
        id: 'self-intro-06',
        en: 'I work for {company}.',
        vi: 'Tôi làm việc cho {company}.',
        ipa: '/aɪ wɜrk fər ə bæŋk/',
        level: 'A2',
        slots: [
          {
            key: 'company',
            hint: 'nơi làm việc',
            examples: [
              { en: 'a bank', vi: 'một ngân hàng' },
              { en: 'a small company', vi: 'một công ty nhỏ' },
              { en: 'the government', vi: 'nhà nước' },
            ],
          },
        ],
      },
      {
        id: 'self-intro-07',
        en: 'I have {family}.',
        vi: 'Tôi có {family}.',
        ipa: '/aɪ hæv tu kɪdz/',
        level: 'A1',
        slots: [
          {
            key: 'family',
            hint: 'gia đình',
            examples: [
              { en: 'two kids', vi: 'hai con' },
              { en: 'a son', vi: 'một con trai' },
              { en: 'a big family', vi: 'một gia đình đông người' },
            ],
          },
        ],
        note: '"kids" kết thúc bằng /dz/.',
      },
      {
        id: 'self-intro-08',
        en: 'I like {hobby} in my free time.',
        vi: 'Lúc rảnh tôi thích {hobby}.',
        ipa: '/aɪ laɪk ˈkʊkɪŋ ɪn maɪ fri taɪm/',
        level: 'A1',
        slots: [
          {
            key: 'hobby',
            hint: 'sở thích',
            examples: [
              { en: 'cooking', vi: 'nấu ăn' },
              { en: 'reading', vi: 'đọc sách' },
              { en: 'playing football', vi: 'đá bóng' },
            ],
          },
        ],
        note: 'Đuôi -ing đọc /ɪŋ/ (mũi), không phải /ɪn/.',
      },
      {
        id: 'self-intro-09',
        en: "I'm learning English because {reason}.",
        vi: 'Tôi học tiếng Anh vì {reason}.',
        ipa: '/aɪm ˈlɜrnɪŋ ˈɪŋɡlɪʃ bɪˈkɔz aɪ wɑnt tə ˈtrævəl/',
        level: 'A2',
        slots: [
          {
            key: 'reason',
            hint: 'lý do',
            examples: [
              { en: 'I want to travel', vi: 'tôi muốn đi du lịch' },
              { en: 'I need it for work', vi: 'tôi cần cho công việc' },
              { en: 'I want to talk to tourists', vi: 'tôi muốn nói chuyện với du khách' },
            ],
          },
        ],
        note: '"want to" nói nhanh thành /ˈwɑnə/; tập đọc đủ trước rồi mới rút gọn.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'ordering',
    nameVi: 'Gọi món',
    nameEn: 'Ordering food',
    icon: 'Utensils',
    intro: 'Đặt bàn, xem thực đơn, gọi món và đồ uống, tính tiền.',
    pronunciationFocus:
      'Âm /t/ cuối trong "get", "it", "want"; "please" kết thúc bằng /z/ chứ không phải "pờ-li".',
    patterns: [
      {
        id: 'ordering-01',
        en: 'A table for {number}, please.',
        vi: 'Cho tôi bàn {number} người.',
        ipa: '/ə ˈteɪbəl fər tu, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'number',
            hint: 'số người',
            examples: [
              { en: 'two', vi: 'hai' },
              { en: 'three', vi: 'ba' },
              { en: 'four', vi: 'bốn' },
            ],
          },
        ],
        note: '"please" kết thúc bằng /z/.',
      },
      {
        id: 'ordering-02',
        en: 'Can I have the menu, please?',
        vi: 'Cho tôi xem thực đơn được không?',
        ipa: '/kæn aɪ hæv ðə ˈmɛnju, pliz/',
        level: 'A1',
        note: '"Can I" nối thành /kənaɪ/.',
      },
      {
        id: 'ordering-03',
        en: "I'd like {dish}, please.",
        vi: 'Tôi muốn {dish}.',
        ipa: '/aɪd laɪk ðə ˈtʃɪkən ˈnudəl sup, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'dish',
            hint: 'món ăn',
            examples: [
              { en: 'the chicken noodle soup', vi: 'phở gà' },
              { en: 'a beef sandwich', vi: 'bánh mì bò' },
              { en: 'the fried rice', vi: 'cơm rang' },
            ],
          },
        ],
        note: '"I\'d" có /d/ cuối; "like" có /k/ cuối.',
      },
      {
        id: 'ordering-04',
        en: 'Can I have {drink}, please?',
        vi: 'Cho tôi {drink} được không?',
        ipa: '/kæn aɪ hæv ə ɡlæs əv ˈwɔtər, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'drink',
            hint: 'đồ uống',
            examples: [
              { en: 'a glass of water', vi: 'một ly nước' },
              { en: 'an iced coffee', vi: 'một cà phê đá' },
              { en: 'a coke', vi: 'một lon coca' },
            ],
          },
        ],
        note: '"glass of" nối thành /ɡlæsəv/.',
      },
      {
        id: 'ordering-05',
        en: 'What do you recommend?',
        vi: 'Bạn gợi ý món gì?',
        ipa: '/wʌt du ju ˌrɛkəˈmɛnd/',
        level: 'A2',
        note: 'Trọng âm rơi vào âm cuối: recom-MEND.',
      },
      {
        id: 'ordering-06',
        en: 'No {ingredient}, please.',
        vi: 'Không cho {ingredient} nhé.',
        ipa: '/noʊ ˈtʃɪli, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'ingredient',
            hint: 'nguyên liệu',
            examples: [
              { en: 'chili', vi: 'ớt' },
              { en: 'onions', vi: 'hành' },
              { en: 'ice', vi: 'đá' },
            ],
          },
        ],
      },
      {
        id: 'ordering-07',
        en: 'Could I get this to go?',
        vi: 'Mang đi được không?',
        ipa: '/kʊd aɪ ɡɛt ðɪs tə ɡoʊ/',
        level: 'A2',
        note: '/t/ cuối trong "get" — đừng nuốt; "Could I" nối thành /kʊdaɪ/.',
      },
      {
        id: 'ordering-08',
        en: 'Can I have the bill, please?',
        vi: 'Cho tôi tính tiền.',
        ipa: '/kæn aɪ hæv ðə bɪl, pliz/',
        level: 'A1',
        note: '"bill" có /ɪ/ ngắn và /l/ cuối (đầu lưỡi chạm lợi trên).',
      },
      {
        id: 'ordering-09',
        en: 'How much is it?',
        vi: 'Bao nhiêu tiền?',
        ipa: '/haʊ mʌtʃ ɪz ɪt/',
        level: 'A1',
        note: '"much" kết thúc bằng /tʃ/; "it" kết thúc bằng /t/.',
      },
      {
        id: 'ordering-10',
        en: 'It was delicious, thank you.',
        vi: 'Ngon lắm, cảm ơn.',
        ipa: '/ɪt wəz dɪˈlɪʃəs, θæŋk ju/',
        level: 'A2',
        note: '"delicious" trọng âm ở âm thứ hai: de-LI-cious.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'directions',
    nameVi: 'Hỏi đường',
    nameEn: 'Asking for directions',
    icon: 'MapPin',
    intro: 'Hỏi chỗ, hỏi cách đi, hiểu câu chỉ đường cơ bản: thẳng, trái, phải, cạnh.',
    pronunciationFocus:
      '"th" /ð/ trong "the", "there"; cụm /ft/ cuối trong "left"; /p/ cuối trong "stop", "map".',
    patterns: [
      {
        id: 'directions-01',
        en: 'Excuse me, where is {place}?',
        vi: 'Xin lỗi, {place} ở đâu?',
        ipa: '/ɪkˈskjuz mi, wɛr ɪz ðə bʌs stɑp/',
        level: 'A1',
        slots: [
          {
            key: 'place',
            hint: 'địa điểm',
            examples: [
              { en: 'the bus stop', vi: 'trạm xe buýt' },
              { en: 'the restroom', vi: 'nhà vệ sinh' },
              { en: 'the train station', vi: 'ga tàu' },
            ],
          },
        ],
        note: '"excuse" có /z/ ở giữa; "stop" có /p/ cuối.',
      },
      {
        id: 'directions-02',
        en: 'How do I get to {place}?',
        vi: 'Làm sao để đến {place}?',
        ipa: '/haʊ du aɪ ɡɛt tə ði ˈɛrpɔrt/',
        level: 'A1',
        slots: [
          {
            key: 'place',
            hint: 'nơi muốn đến',
            examples: [
              { en: 'the airport', vi: 'sân bay' },
              { en: 'the market', vi: 'chợ' },
              { en: 'Ben Thanh Market', vi: 'chợ Bến Thành' },
            ],
          },
        ],
      },
      {
        id: 'directions-03',
        en: 'Is it far from here?',
        vi: 'Có xa đây không?',
        ipa: '/ɪz ɪt fɑr frʌm hɪr/',
        level: 'A1',
      },
      {
        id: 'directions-04',
        en: 'Go straight ahead.',
        vi: 'Đi thẳng.',
        ipa: '/ɡoʊ streɪt əˈhɛd/',
        level: 'A1',
        note: '"straight" có 3 phụ âm đầu /str/ và /t/ cuối.',
      },
      {
        id: 'directions-05',
        en: 'Turn {direction} at the corner.',
        vi: 'Rẽ {direction} ở góc đường.',
        ipa: '/tɜrn lɛft æt ðə ˈkɔrnər/',
        level: 'A1',
        slots: [
          {
            key: 'direction',
            hint: 'hướng',
            examples: [
              { en: 'left', vi: 'trái' },
              { en: 'right', vi: 'phải' },
            ],
          },
        ],
        note: '"left" kết thúc bằng /ft/ — người Việt hay bỏ /t/.',
      },
      {
        id: 'directions-06',
        en: "It's on your {side}.",
        vi: 'Nó ở bên {side} bạn.',
        ipa: '/ɪts ɑn jʊr lɛft/',
        level: 'A1',
        slots: [
          {
            key: 'side',
            hint: 'bên nào',
            examples: [
              { en: 'left', vi: 'trái' },
              { en: 'right', vi: 'phải' },
            ],
          },
        ],
      },
      {
        id: 'directions-07',
        en: "It's next to {place}.",
        vi: 'Nó ở cạnh {place}.',
        ipa: '/ɪts nɛkst tə ðə bæŋk/',
        level: 'A1',
        slots: [
          {
            key: 'place',
            hint: 'địa điểm',
            examples: [
              { en: 'the bank', vi: 'ngân hàng' },
              { en: 'the school', vi: 'trường học' },
              { en: 'the coffee shop', vi: 'quán cà phê' },
            ],
          },
        ],
        note: '"next to" nối liền, /t/ cuối "next" gần như hoà vào "to".',
      },
      {
        id: 'directions-08',
        en: 'Can you show me on the map?',
        vi: 'Bạn chỉ trên bản đồ giúp tôi được không?',
        ipa: '/kæn ju ʃoʊ mi ɑn ðə mæp/',
        level: 'A2',
        note: '"show" bắt đầu bằng /ʃ/, không phải /s/.',
      },
      {
        id: 'directions-09',
        en: 'How long does it take?',
        vi: 'Mất bao lâu?',
        ipa: '/haʊ lɔŋ dʌz ɪt teɪk/',
        level: 'A2',
        note: '"does" đọc /dʌz/, có /z/ cuối.',
      },
      {
        id: 'directions-10',
        en: 'Thank you so much for your help.',
        vi: 'Cảm ơn bạn đã giúp.',
        ipa: '/θæŋk ju soʊ mʌtʃ fər jʊr hɛlp/',
        level: 'A1',
        note: '"help" kết thúc bằng /lp/.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'shopping',
    nameVi: 'Mua sắm',
    nameEn: 'Shopping',
    icon: 'ShoppingBag',
    intro: 'Hỏi giá, hỏi cỡ và màu, thử đồ, mặc cả, thanh toán.',
    pronunciationFocus:
      'Âm cuối /ɡ/ trong "big", /st/ trong "just", /rd/ trong "card"; nối âm "try it on".',
    patterns: [
      {
        id: 'shopping-01',
        en: "I'm just looking, thanks.",
        vi: 'Tôi chỉ xem thôi, cảm ơn.',
        ipa: '/aɪm dʒʌst ˈlʊkɪŋ, θæŋks/',
        level: 'A1',
        note: '"just" kết thúc bằng /st/.',
      },
      {
        id: 'shopping-02',
        en: 'How much is this?',
        vi: 'Cái này bao nhiêu?',
        ipa: '/haʊ mʌtʃ ɪz ðɪs/',
        level: 'A1',
        note: '"this" bắt đầu bằng /ð/ và kết thúc bằng /s/.',
      },
      {
        id: 'shopping-03',
        en: 'Do you have this in {size}?',
        vi: 'Có cái này cỡ {size} không?',
        ipa: '/du ju hæv ðɪs ɪn ə ˈmidiəm/',
        level: 'A1',
        slots: [
          {
            key: 'size',
            hint: 'cỡ',
            examples: [
              { en: 'a medium', vi: 'M' },
              { en: 'a large', vi: 'L' },
              { en: 'a smaller size', vi: 'nhỏ hơn' },
            ],
          },
        ],
      },
      {
        id: 'shopping-04',
        en: 'Do you have it in {color}?',
        vi: 'Có màu {color} không?',
        ipa: '/du ju hæv ɪt ɪn blæk/',
        level: 'A1',
        slots: [
          {
            key: 'color',
            hint: 'màu',
            examples: [
              { en: 'black', vi: 'đen' },
              { en: 'white', vi: 'trắng' },
              { en: 'blue', vi: 'xanh dương' },
            ],
          },
        ],
        note: '"have it in" nối thành /hævɪtɪn/.',
      },
      {
        id: 'shopping-05',
        en: 'Can I try it on?',
        vi: 'Tôi thử được không?',
        ipa: '/kæn aɪ traɪ ɪt ɑn/',
        level: 'A1',
        note: '"try it on" nối thành /traɪɪtɑn/.',
      },
      {
        id: 'shopping-06',
        en: "It's too {problem}.",
        vi: 'Nó {problem} quá.',
        ipa: '/ɪts tu bɪɡ/',
        level: 'A1',
        slots: [
          {
            key: 'problem',
            hint: 'vấn đề',
            examples: [
              { en: 'big', vi: 'rộng' },
              { en: 'small', vi: 'chật' },
              { en: 'expensive', vi: 'đắt' },
            ],
          },
        ],
        note: '"big" kết thúc bằng /ɡ/ — người Việt hay đọc thành "bích".',
      },
      {
        id: 'shopping-07',
        en: 'Can you give me a discount?',
        vi: 'Giảm giá cho tôi được không?',
        ipa: '/kæn ju ɡɪv mi ə ˈdɪskaʊnt/',
        level: 'A2',
        note: 'Danh từ "discount" trọng âm ở âm đầu: DIS-count.',
      },
      {
        id: 'shopping-08',
        en: "I'll take it.",
        vi: 'Tôi lấy cái này.',
        ipa: '/aɪl teɪk ɪt/',
        level: 'A1',
        note: '"take it" nối thành /teɪkɪt/.',
      },
      {
        id: 'shopping-09',
        en: 'Can I pay by card?',
        vi: 'Tôi trả bằng thẻ được không?',
        ipa: '/kæn aɪ peɪ baɪ kɑrd/',
        level: 'A1',
        note: '"card" kết thúc bằng /rd/.',
      },
      {
        id: 'shopping-10',
        en: 'Can I have a receipt, please?',
        vi: 'Cho tôi hoá đơn.',
        ipa: '/kæn aɪ hæv ə rɪˈsit, pliz/',
        level: 'A2',
        note: '"receipt" có chữ p câm, đọc /rɪˈsit/.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'work',
    nameVi: 'Công việc',
    nameEn: 'At work',
    icon: 'Briefcase',
    intro: 'Họp, gửi tài liệu, hẹn thời gian, xin nhắc lại, xin lỗi vì đến muộn.',
    pronunciationFocus:
      'Đuôi -ed: "finished" đọc /t/, "called" đọc /d/ — đừng bỏ hẳn. Cụm /nd/ /nt/ cuối trong "send", "don\'t".',
    patterns: [
      {
        id: 'work-01',
        en: 'I have a meeting at {time}.',
        vi: 'Tôi có cuộc họp lúc {time}.',
        ipa: "/aɪ hæv ə ˈmitɪŋ æt naɪn əˈklɑk/",
        level: 'A1',
        slots: [
          {
            key: 'time',
            hint: 'giờ',
            examples: [
              { en: "nine o'clock", vi: '9 giờ' },
              { en: 'two p.m.', vi: '2 giờ chiều' },
              { en: 'ten thirty', vi: '10 rưỡi' },
            ],
          },
        ],
      },
      {
        id: 'work-02',
        en: 'Could you send me the file, please?',
        vi: 'Bạn gửi tôi file đó được không?',
        ipa: '/kʊd ju sɛnd mi ðə faɪl, pliz/',
        level: 'A2',
        note: '"send" kết thúc bằng /nd/; "Could you" nối thành /ˈkʊdʒu/.',
      },
      {
        id: 'work-03',
        en: "I'll do it {when}.",
        vi: 'Tôi sẽ làm {when}.',
        ipa: '/aɪl du ɪt raɪt əˈweɪ/',
        level: 'A1',
        slots: [
          {
            key: 'when',
            hint: 'khi nào',
            examples: [
              { en: 'right away', vi: 'ngay bây giờ' },
              { en: 'this afternoon', vi: 'chiều nay' },
              { en: 'by Friday', vi: 'trước thứ Sáu' },
            ],
          },
        ],
        note: '"right away" nối thành /raɪtəˈweɪ/.',
      },
      {
        id: 'work-04',
        en: 'I finished the report yesterday.',
        vi: 'Tôi đã xong báo cáo hôm qua.',
        ipa: '/aɪ ˈfɪnɪʃt ðə rɪˈpɔrt ˈjɛstərdeɪ/',
        level: 'A2',
        note: 'Đuôi -ed trong "finished" đọc /t/ — người Việt hay bỏ hẳn.',
      },
      {
        id: 'work-05',
        en: "Sorry, I don't understand. Could you repeat that?",
        vi: 'Xin lỗi, tôi chưa hiểu. Bạn nhắc lại được không?',
        ipa: '/ˈsɑri, aɪ doʊnt ˌʌndərˈstænd. kʊd ju rɪˈpit ðæt/',
        level: 'A1',
        note: '"don\'t" kết thúc bằng /nt/; "that" kết thúc bằng /t/.',
      },
      {
        id: 'work-06',
        en: 'Can we talk about {topic}?',
        vi: 'Ta nói về {topic} được không?',
        ipa: '/kæn wi tɔk əˈbaʊt ðə ˈskɛdʒul/',
        level: 'A2',
        slots: [
          {
            key: 'topic',
            hint: 'chủ đề',
            examples: [
              { en: 'the schedule', vi: 'lịch làm việc' },
              { en: 'the new project', vi: 'dự án mới' },
              { en: 'my salary', vi: 'lương của tôi' },
            ],
          },
        ],
        note: '"talk about" nối thành /tɔkəˈbaʊt/.',
      },
      {
        id: 'work-07',
        en: "I'm sorry, I'm running late.",
        vi: 'Xin lỗi, tôi đến muộn một chút.',
        ipa: '/aɪm ˈsɑri, aɪm ˈrʌnɪŋ leɪt/',
        level: 'A2',
        note: '"late" kết thúc bằng /t/.',
      },
      {
        id: 'work-08',
        en: 'Let me check and get back to you.',
        vi: 'Để tôi kiểm tra rồi báo lại.',
        ipa: '/lɛt mi tʃɛk ænd ɡɛt bæk tə ju/',
        level: 'A2',
        note: '"check" bắt đầu bằng /tʃ/ và kết thúc bằng /k/.',
      },
      {
        id: 'work-09',
        en: 'Thanks for your help today.',
        vi: 'Cảm ơn bạn đã giúp hôm nay.',
        ipa: '/θæŋks fər jʊr hɛlp təˈdeɪ/',
        level: 'A1',
      },
      {
        id: 'work-10',
        en: 'Have a good weekend!',
        vi: 'Cuối tuần vui vẻ!',
        ipa: '/hæv ə ɡʊd ˌwikˈɛnd/',
        level: 'A1',
        note: '"good weekend": giữ /d/ cuối của "good" rồi mới sang /w/.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'phone',
    nameVi: 'Điện thoại',
    nameEn: 'On the phone',
    icon: 'Phone',
    intro: 'Nghe máy, xin gặp ai đó, xin nói chậm, hẹn gọi lại, để lại lời nhắn.',
    pronunciationFocus:
      'Cụm /sp/ trong "speak" (không chèn âm "ơ" vào giữa); /t/ cuối phân biệt "can\'t" với "can"; /z/ trong "who\'s".',
    patterns: [
      {
        id: 'phone-01',
        en: 'Hello, this is {name}.',
        vi: 'Alô, tôi là {name}.',
        ipa: '/həˈloʊ, ðɪs ɪz læn/',
        level: 'A1',
        slots: [
          {
            key: 'name',
            hint: 'tên bạn',
            examples: [
              { en: 'Lan', vi: 'Lan' },
              { en: 'Minh', vi: 'Minh' },
              { en: 'Hoa', vi: 'Hoa' },
            ],
          },
        ],
        note: 'Khi nghe máy nói "this is …", không nói "I am …".',
      },
      {
        id: 'phone-02',
        en: 'Can I speak to {person}, please?',
        vi: 'Cho tôi gặp {person}.',
        ipa: '/kæn aɪ spik tə ˈmɪstər næm, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'person',
            hint: 'người cần gặp',
            examples: [
              { en: 'Mr. Nam', vi: 'anh Nam' },
              { en: 'the manager', vi: 'quản lý' },
              { en: 'Ms. Hoa', vi: 'chị Hoa' },
            ],
          },
        ],
        note: '"speak" là /sp/ liền, không thêm âm "ơ" ở giữa.',
      },
      {
        id: 'phone-03',
        en: "Sorry, who's calling?",
        vi: 'Xin lỗi, ai đang gọi ạ?',
        ipa: '/ˈsɑri, huz ˈkɔlɪŋ/',
        level: 'A2',
        note: '"who\'s" có /z/ cuối.',
      },
      {
        id: 'phone-04',
        en: 'Could you speak more slowly, please?',
        vi: 'Bạn nói chậm lại được không?',
        ipa: '/kʊd ju spik mɔr ˈsloʊli, pliz/',
        level: 'A1',
      },
      {
        id: 'phone-05',
        en: "Sorry, I can't hear you well.",
        vi: 'Xin lỗi, tôi nghe không rõ.',
        ipa: '/ˈsɑri, aɪ kænt hɪr ju wɛl/',
        level: 'A1',
        note: '"can\'t" /kænt/ — /t/ cuối giúp phân biệt với "can".',
      },
      {
        id: 'phone-06',
        en: 'Can I call you back {when}?',
        vi: 'Tôi gọi lại {when} được không?',
        ipa: '/kæn aɪ kɔl ju bæk ɪn tɛn ˈmɪnɪts/',
        level: 'A2',
        slots: [
          {
            key: 'when',
            hint: 'khi nào',
            examples: [
              { en: 'in ten minutes', vi: 'sau 10 phút' },
              { en: 'later', vi: 'sau nhé' },
              { en: 'tomorrow', vi: 'ngày mai' },
            ],
          },
        ],
        note: '"minutes" kết thúc bằng /ts/.',
      },
      {
        id: 'phone-07',
        en: 'Can I leave a message?',
        vi: 'Tôi nhắn lại được không?',
        ipa: '/kæn aɪ liv ə ˈmɛsɪdʒ/',
        level: 'A2',
        note: '"leave a" nối thành /livə/; "message" kết thúc bằng /dʒ/.',
      },
      {
        id: 'phone-08',
        en: 'My number is {number}.',
        vi: 'Số của tôi là {number}.',
        ipa: '/maɪ ˈnʌmbər ɪz oʊ naɪn wʌn tu, θri fɔr faɪv, sɪks ˈsɛvən eɪt/',
        level: 'A1',
        slots: [
          {
            key: 'number',
            hint: 'số điện thoại (đọc từng chữ số)',
            examples: [
              { en: 'oh nine one two, three four five, six seven eight', vi: 'không chín một hai, ba bốn năm, sáu bảy tám' },
              { en: 'zero eight eight, one two three, four five six seven', vi: 'không tám tám, một hai ba, bốn năm sáu bảy' },
            ],
          },
        ],
        note: 'Đọc từng chữ số; số 0 đọc "oh" hoặc "zero".',
      },
      {
        id: 'phone-09',
        en: 'Thanks for calling. Goodbye!',
        vi: 'Cảm ơn đã gọi. Tạm biệt!',
        ipa: '/θæŋks fər ˈkɔlɪŋ. ˌɡʊdˈbaɪ/',
        level: 'A1',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'airport',
    nameVi: 'Sân bay',
    nameEn: 'At the airport',
    icon: 'Plane',
    intro: 'Làm thủ tục, chọn ghế, ký gửi hành lý, hỏi cổng và giờ lên máy bay, trả lời hải quan.',
    pronunciationFocus:
      '/t/ cuối trong "flight", "gate", "ticket"; /ɡz/ trong "bags"; "aisle" đọc /aɪl/ (s câm).',
    patterns: [
      {
        id: 'airport-01',
        en: 'Where is the check-in counter for {airline}?',
        vi: 'Quầy làm thủ tục của {airline} ở đâu?',
        ipa: '/wɛr ɪz ðə ˈtʃɛkɪn ˈkaʊntər fər ˌviɛtˈnɑm ˈɛrlaɪnz/',
        level: 'A2',
        slots: [
          {
            key: 'airline',
            hint: 'hãng bay',
            examples: [
              { en: 'Vietnam Airlines', vi: 'Vietnam Airlines' },
              { en: 'Vietjet', vi: 'Vietjet' },
              { en: 'Bamboo Airways', vi: 'Bamboo Airways' },
            ],
          },
        ],
      },
      {
        id: 'airport-02',
        en: 'Here is my passport and ticket.',
        vi: 'Đây là hộ chiếu và vé của tôi.',
        ipa: '/hɪr ɪz maɪ ˈpæspɔrt ænd ˈtɪkɪt/',
        level: 'A1',
        note: '"passport" có /sp/ ở giữa và /rt/ cuối.',
      },
      {
        id: 'airport-03',
        en: "I'd like a {seat} seat, please.",
        vi: 'Cho tôi ghế {seat}.',
        ipa: '/aɪd laɪk ə ˈwɪndoʊ sit, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'seat',
            hint: 'loại ghế',
            examples: [
              { en: 'window', vi: 'cạnh cửa sổ' },
              { en: 'aisle', vi: 'cạnh lối đi' },
            ],
          },
        ],
        note: '"aisle" đọc /aɪl/ — chữ s câm.',
      },
      {
        id: 'airport-04',
        en: 'How many bags can I check in?',
        vi: 'Tôi được ký gửi mấy kiện?',
        ipa: '/haʊ ˈmɛni bæɡz kæn aɪ tʃɛk ɪn/',
        level: 'A2',
        note: '"bags" kết thúc bằng /ɡz/.',
      },
      {
        id: 'airport-05',
        en: 'What time is boarding?',
        vi: 'Mấy giờ lên máy bay?',
        ipa: '/wʌt taɪm ɪz ˈbɔrdɪŋ/',
        level: 'A1',
      },
      {
        id: 'airport-06',
        en: 'Which gate is my flight?',
        vi: 'Chuyến của tôi ở cổng nào?',
        ipa: '/wɪtʃ ɡeɪt ɪz maɪ flaɪt/',
        level: 'A1',
        note: '"gate" và "flight" đều kết thúc bằng /t/.',
      },
      {
        id: 'airport-07',
        en: 'Is the flight on time?',
        vi: 'Chuyến bay có đúng giờ không?',
        ipa: '/ɪz ðə flaɪt ɑn taɪm/',
        level: 'A1',
      },
      {
        id: 'airport-08',
        en: "I'm here {purpose}.",
        vi: 'Tôi đến đây để {purpose}.',
        ipa: '/aɪm hɪr ɑn veɪˈkeɪʃən/',
        level: 'A1',
        slots: [
          {
            key: 'purpose',
            hint: 'mục đích',
            examples: [
              { en: 'on vacation', vi: 'du lịch' },
              { en: 'for work', vi: 'công tác' },
              { en: 'to visit my family', vi: 'thăm gia đình' },
            ],
          },
        ],
        note: '"vacation" trọng âm ở âm thứ hai: va-CA-tion.',
      },
      {
        id: 'airport-09',
        en: "I'm staying for {duration}.",
        vi: 'Tôi ở lại {duration}.',
        ipa: '/aɪm ˈsteɪɪŋ fər wʌn wik/',
        level: 'A1',
        slots: [
          {
            key: 'duration',
            hint: 'bao lâu',
            examples: [
              { en: 'one week', vi: 'một tuần' },
              { en: 'ten days', vi: 'mười ngày' },
              { en: 'two weeks', vi: 'hai tuần' },
            ],
          },
        ],
        note: '"week" kết thúc bằng /k/.',
      },
      {
        id: 'airport-10',
        en: 'My luggage is missing.',
        vi: 'Hành lý của tôi bị thất lạc.',
        ipa: '/maɪ ˈlʌɡɪdʒ ɪz ˈmɪsɪŋ/',
        level: 'A2',
        note: '"luggage" là danh từ không đếm được — không thêm -s.',
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    id: 'hotel',
    nameVi: 'Khách sạn',
    nameEn: 'At the hotel',
    icon: 'BedDouble',
    intro: 'Nhận phòng, hỏi giá và bữa sáng, xin Wi-Fi, báo hỏng, xin thêm đồ, trả phòng.',
    pronunciationFocus:
      '/m/ cuối trong "room" (khép môi); /ts/ trong "nights"; /st/ trong "breakfast"; trọng âm "reser-VA-tion".',
    patterns: [
      {
        id: 'hotel-01',
        en: 'I have a reservation under {name}.',
        vi: 'Tôi đã đặt phòng tên {name}.',
        ipa: '/aɪ hæv ə ˌrɛzərˈveɪʃən ˈʌndər træn/',
        level: 'A2',
        slots: [
          {
            key: 'name',
            hint: 'tên đặt phòng',
            examples: [
              { en: 'Tran', vi: 'Trần' },
              { en: 'Lan', vi: 'Lan' },
              { en: 'Minh', vi: 'Minh' },
            ],
          },
        ],
        note: '"reservation" trọng âm ở "VA": re-ser-VA-tion.',
      },
      {
        id: 'hotel-02',
        en: 'Do you have a room for {nights}?',
        vi: 'Còn phòng cho {nights} không?',
        ipa: '/du ju hæv ə rum fər tu naɪts/',
        level: 'A1',
        slots: [
          {
            key: 'nights',
            hint: 'số đêm',
            examples: [
              { en: 'two nights', vi: 'hai đêm' },
              { en: 'tonight', vi: 'tối nay' },
              { en: 'three nights', vi: 'ba đêm' },
            ],
          },
        ],
        note: '"nights" kết thúc bằng /ts/; "room" kết thúc bằng /m/ — khép môi.',
      },
      {
        id: 'hotel-03',
        en: 'How much is it per night?',
        vi: 'Bao nhiêu một đêm?',
        ipa: '/haʊ mʌtʃ ɪz ɪt pər naɪt/',
        level: 'A1',
      },
      {
        id: 'hotel-04',
        en: 'Does it include breakfast?',
        vi: 'Có bao gồm bữa sáng không?',
        ipa: '/dʌz ɪt ɪnˈklud ˈbrɛkfəst/',
        level: 'A2',
        note: '"breakfast" kết thúc bằng /st/.',
      },
      {
        id: 'hotel-05',
        en: 'What time is check-out?',
        vi: 'Mấy giờ trả phòng?',
        ipa: '/wʌt taɪm ɪz ˈtʃɛkaʊt/',
        level: 'A1',
      },
      {
        id: 'hotel-06',
        en: "What's the Wi-Fi password?",
        vi: 'Mật khẩu Wi-Fi là gì?',
        ipa: '/wʌts ðə ˈwaɪfaɪ ˈpæswɜrd/',
        level: 'A1',
        note: '"password" kết thúc bằng /rd/.',
      },
      {
        id: 'hotel-07',
        en: "The {thing} in my room isn't working.",
        vi: '{thing} trong phòng tôi bị hỏng.',
        ipa: '/ði ɛr kənˈdɪʃənər ɪn maɪ rum ˈɪzənt ˈwɜrkɪŋ/',
        level: 'A2',
        slots: [
          {
            key: 'thing',
            hint: 'thiết bị',
            examples: [
              { en: 'air conditioner', vi: 'máy lạnh' },
              { en: 'shower', vi: 'vòi sen' },
              { en: 'TV', vi: 'ti vi' },
            ],
          },
        ],
        note: '"isn\'t" kết thúc bằng /nt/.',
      },
      {
        id: 'hotel-08',
        en: 'Can I have {item}, please?',
        vi: 'Cho tôi xin {item}.',
        ipa: '/kæn aɪ hæv ən ˈɛkstrə ˈtaʊəl, pliz/',
        level: 'A1',
        slots: [
          {
            key: 'item',
            hint: 'đồ cần thêm',
            examples: [
              { en: 'an extra towel', vi: 'thêm một khăn tắm' },
              { en: 'another pillow', vi: 'thêm một cái gối' },
              { en: 'some water', vi: 'ít nước' },
            ],
          },
        ],
      },
      {
        id: 'hotel-09',
        en: 'Could you call a taxi for me?',
        vi: 'Gọi taxi giúp tôi được không?',
        ipa: '/kʊd ju kɔl ə ˈtæksi fər mi/',
        level: 'A2',
      },
      {
        id: 'hotel-10',
        en: "I'd like to check out, please.",
        vi: 'Tôi muốn trả phòng.',
        ipa: '/aɪd laɪk tə tʃɛk aʊt, pliz/',
        level: 'A1',
        note: '"check out" nối thành /tʃɛkaʊt/.',
      },
    ],
  },
]

/** Tổng số mẫu câu trong seed (dùng cho màn Mẫu câu và test). */
export const PATTERN_COUNT = SITUATIONS.reduce((n, s) => n + s.patterns.length, 0)

/** Id tình huống của một pattern id dạng `<situationId>-<NN>`; `undefined` nếu không tìm thấy. */
export function situationOfPattern(patternId: string): string | undefined {
  return SITUATIONS.find((s) => s.patterns.some((p) => p.id === patternId))?.id
}

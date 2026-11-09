---
version: 1
slug: "src-routes-today-tsx"
primary_target: "src/routes/Today.tsx"
related_targets: ["src/components/Shell.tsx"]
---

# Surface: App shell + "Hôm nay" (Today)

Scope: the authenticated app shell (top bar + navigation) and the Today screen; every other MVP screen (Nhật ký buổi học, Ôn thẻ, Mẫu câu, Shadowing, Tiến độ) inherits this world.
Mode: Operate. The learner has to know what to do next within seconds: review the due cards, then shadow a few phrases.
Audience/job: a Vietnamese adult who has lost the basics, studying 15 minutes a day between classes, on a laptop or a phone.
Constraints: UI in Vietnamese, learning content in English; free stack; works on 390px phones; WCAG AA.

## Direction contract

THESIS: Coming back to English the way you first learned to write. Every class is a page in a vở ô ly notebook and every correction is a teacher's red pen, but kind. It rejects the category default of white rounded cards, a green progress ring, and a mascot.

OWN-WORLD: Notebook paper #F7F5FB under a faint four-line lilac ô ly grid. Mực tím #4B2E83 is the ink: shell bar, primary actions, written English. Teacher red #D2332B is reserved for corrections and "quên" (forgotten). 1px ruled lines, 10px corners, no shadows. Be Vietnam Pro for the whole UI, plus one handwritten red remark (Charm) per screen at most.

STORY: The learner opens the app, sees how many cards are due and the latest class page, starts reviewing, and leaves having done today's 15 minutes.

FIRST VIEWPORT: A purple top bar holds brand, primary nav and user/streak. Below, two columns. Left, at 420px: a white card with "Đến hạn ôn hôm nay", a huge purple count, the estimated minutes, the primary "Ôn ngay" button, and the three hardest cards with red status. Right: the latest class rendered as a ruled notebook page with a red margin line, the date, the topic in purple, and phrase rows sitting on the grid with Vietnamese glosses, a red common-mistake note and one handwritten remark. On a phone, the due card comes first and the page follows.

FORM: Vở ô ly mực tím, the pick card (my rank 1; the roll assigned rank 4). seed:a90ae3aaf4af6947. Signature move: class content sits on a real ô ly grid, with English written in purple ink on the baseline every 48px.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Kept from declined challengers: red only for corrections and forgotten cards (orienteering); 1px rules, states as marks (rail); destructive actions isolated (console); the English phrase at display size over small labels (specimen).

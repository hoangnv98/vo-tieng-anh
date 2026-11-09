---
name: Vở Tiếng Anh
description: A Vietnamese learner's ô ly notebook, written in purple ink and corrected with a kind red pen.
colors:
  paper: "#F7F5FB"
  grid: "#D9D3EE"
  grid-strong: "#B9B2DA"
  ink: "#20182E"
  purple-ink: "#4B2E83"
  teacher-red: "#D2332B"
  mute: "#6A6280"
  white: "#FFFFFF"
  lilac: "#E6DFF7"
typography:
  display-count:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "104px"
    fontWeight: 700
    lineHeight: 1
  display:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 700
    lineHeight: 1
  review-english:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "48px"
  shadowing-english:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "48px"
  headline:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "48px"
  title:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  title-mobile:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
  subtitle:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  lead:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.4
  english-line:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: "48px"
  gloss:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "48px"
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0em"
  remark:
    fontFamily: "Charm, cursive"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  ink: "1.5px"
  chip: "6px"
  btn: "8px"
  card: "10px"
spacing:
  line-minor: "12px"
  line: "48px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.purple-ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "44px"
  button-primary-lg:
    backgroundColor: "{colors.purple-ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #4B2E83 85%, black)"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.purple-ink}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.purple-ink}"
  button-danger:
    backgroundColor: "{colors.white}"
    textColor: "{colors.teacher-red}"
    rounded: "{rounded.btn}"
    padding: "0 24px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.purple-ink}"
    rounded: "{rounded.btn}"
    padding: "0 12px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.purple-ink}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  field-control:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "10px 12px"
    height: "44px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.lilac}"
    rounded: "{rounded.chip}"
    padding: "9px 14px"
    height: "44px"
  nav-link-current:
    backgroundColor: "{colors.white}"
    textColor: "{colors.purple-ink}"
    rounded: "{rounded.chip}"
    padding: "9px 14px"
    height: "44px"
  shell-chip:
    backgroundColor: "transparent"
    textColor: "color-mix(in srgb, #FFFFFF 85%, transparent)"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "28px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.btn}"
    padding: "12px 16px"
  remark:
    backgroundColor: "transparent"
    textColor: "{colors.teacher-red}"
    typography: "{typography.remark}"
---

# Design System: Vở Tiếng Anh

## Overview

**Creative North Star: "Vở ô ly mực tím"**

Coming back to English the way you first learned to write. The whole app is a school notebook: a cool lilac-grey paper (#F7F5FB), white pages ruled with a faint ô ly grid, a thin red margin, and two pens. Purple ink (#4B2E83) is the learner's own hand: it paints the top bar, the primary buttons, and every English phrase, which sits on a real 48px baseline. Teacher red (#D2332B) is the correcting pen, used sparingly and kindly: a forgotten card, a validation error, a destructive action, the "Lỗi hay gặp:" label, and one handwritten remark in Charm when the learner has earned it.

Density is calm and large. The UI is Vietnamese; the learning content is English and always typeset bigger than the Vietnamese that explains it. Everything is flat: 1px rules on paper, no shadows anywhere, corners of 10/8/6px. The one authored moment of motion is the pen mark that a grade leaves on a review card. The world rejects the category defaults it was built against: white rounded cards floating on shadows, a green progress ring, a mascot, uppercase eyebrow labels.

**Key Characteristics:**
- Paper, grid, margin: content surfaces are ruled pages, not cards floating in space.
- Two inks only: purple for the learner's own writing and actions, red for the teacher's corrections.
- English on the baseline: 26px purple on a 48px rule, Vietnamese gloss 17px ink beside it.
- Flat and 1px: rules, borders, calendar cells, progress bar; shadows are forbidden.
- One handwritten voice per screen, maximum.
- Motion is a pen stroke, 300ms, once, and nothing else moves.

## Colors

A lilac-grey paper with two pens on it; everything else is grey ink and the paper itself.

### Primary
- **Mực tím / Purple Ink** (`purple-ink`): the learner's hand. Fills the top bar and primary buttons, colours every English phrase, the big due count, the current nav tab on mobile, stats values, the progress fill, calendar ticks, the Khó dash and Nhớ/Dễ tick pen marks, the text caret, the focus ring and the link colour. Hover on primary darkens it with `color-mix(in srgb, var(--purple) 85%, black)`.
- **Lilac** (`lilac`): nav text on the purple bar, hover wash on secondary and ghost buttons and on icon buttons, text selection background, open fill-in slot.

### Secondary
- **Teacher Red / Bút đỏ** (`teacher-red`): the red pen. Only for the forgotten state ("quên" status, Quên grade button, forgotten stat row, strike pen mark), errors and validation (field error border and text, route and login errors, toast icon), destructive actions (danger button, danger zones), the Charm remark, the underlined "Lỗi hay gặp:" / "Lưu ý phát âm:" labels and their wavy underlines, and the 1px page margin at 60% opacity.

### Neutral
- **Paper** (`paper`): the body background and scrollbar track; the desk the pages sit on.
- **White** (`white`): the page. Cards, ruled paper, inputs, the mobile bottom bar, the current-tab pill on desktop, button text on purple.
- **Grid** (`grid`): minor rules every 12px, the vertical column rules, 1px list dividers (`--rule`), the progress bar track, calendar gutters.
- **Grid strong** (`grid-strong`): main rules every 48px, card and input borders (`--rule-strong`), the secondary button stroke, the spinner ring, the scrollbar thumb, the off switch track.
- **Ink** (`ink`): primary text, Vietnamese glosses, toast background, dialog backdrop at 40%.
- **Mute** (`mute`): secondary text at 14-16px (dates, hints, "khó" status, placeholders, mobile tab labels). Reaches 5.4:1 on paper.

### Named Rules
**The Two Pens Rule.** Purple is the learner writing; red is the teacher correcting. Red never decorates and never signals "important" in general: if a thing is not forgotten, wrong, destructive, a mistake note, the margin, or the remark, it is not red.

**The Purple Is English Rule.** English learning content is set in purple ink; Vietnamese UI and glosses are set in ink. A purple sentence on a white page reads as "something to say out loud".

**The One Remark Rule.** At most one Charm handwritten remark per screen, always red, always one of the fixed texts the build ships (`Tốt lắm!`, `Đều đặn lắm!`); it is never rendered when empty and never invented per surface.

## Typography

**Display Font:** Be Vietnam Pro (with system-ui, sans-serif)
**Body Font:** Be Vietnam Pro (with system-ui, sans-serif)
**Remark Font:** Charm 700 (with cursive), red, rotated -6deg; the only second face

**Character:** One humanist sans does the whole notebook in weights 400-700, loaded from Google Fonts. Hierarchy comes from size and ink colour, never from case or tracking. The handwritten Charm appears only as the teacher's remark.

### Hierarchy
- **Display** (700, 72px desktop 1024+: 104px, line-height 1, tabular numerals): the due-card count on Today; the number is the headline and the sentence continues at 17px on the same baseline.
- **Headline** (700, 34px, line-height 48px, purple): notebook page title (the class topic). Mobile 26px. Sits on the grid.
- **Title** (700, 28px, line-height 1.25, ink): route page titles (`.page-title`), summary titles, big stats. Mobile 24px. Login title is purple.
- **English line** (500, 26px, line-height from the 48px entry, purple, `lang="en"`): every English phrase on a ruled page. Mobile 20px on a 24px line. Review card: 600, 36px (mobile 28px).
- **Gloss** (500, 17px, purple-free ink): the Vietnamese meaning, inline after the English on desktop as an inline-block so it drops as a whole; its own 24px line below on mobile at 16px. Review card gloss is 20px (front 28px/600).
- **Body** (400, 16px, line-height 1.5, ink): descriptions, dialog copy, notes (`max-width: 52ch` on review notes).
- **Small / Label** (400-500, 14-15px, mute or ink, line-height 24px): dates, hints, counts, status marks, field descriptions. Always sentence case, zero letter-spacing.
- **Section heading** (600, 16-20px, ink): "Thẻ khó nhất", progress block headings, empty-state titles, dialog titles (20px/700).

### Named Rules
**The No Eyebrow Rule.** No uppercase, no tracked-out kicker, no small-caps label anywhere. Secondary text is smaller and muter, never capitalised.

**The Baseline Rule.** On a ruled page each entry is a multiple of 48px (`line-height: var(--line)` on `.entry`, `line-height: 1` on its spans) so the English baseline lands on a main rule; mobile halves the line to 24px, EN and VI stacked, still summing to 48px per entry. Small mute text that would be cut by a rule gets a white "knockout" background (`padding: 0 6px; background: var(--white)`).

## Layout

Content is centred in a 1200px shell with 40px side padding on desktop (24px tablet, 16px mobile) and 32px top / 48px bottom (24px on mobile, plus the 64px bottom bar and safe-area inset). Today splits into two columns at 1024px: a 420px due card on the left and the notebook page filling the right, 28px gap; below 1024px it is one column with the due card first. Review is a single 720px column; Progress a 640px column that becomes `goal | cal` / `stats | cal` with a 392px calendar at 1024px; Patterns and Lessons cap at 960px with rows separated by 1px rules.

Spacing follows an 4/8/12/16/24/32/48 rhythm, and inside ruled paper it becomes the notebook's own: main rules every 48px, minor rules every 12px, a vertical column every 48px, 72px margin (40px on mobile), page padding `30px 40px 30px 96px` (mobile `24px 16px 24px 56px`). Dividers inside cards are 1px `--rule` lines with 12-16px of padding, never extra boxes.

Breakpoints as used: 389px (very narrow: chips to icons, remark takes its own 48px line), 767px (mobile: bottom tab bar, nav hidden, cards 16px padding), 1023px (tablet: short nav labels wrap into the purple bar), 1024px (two-column surfaces), 1279px (narrow desktop: tighter nav gaps). Tap targets are 44px minimum (`--tap`); top bar 68px (56px mobile); bottom bar 64px.

## Elevation & Depth

There are no shadows anywhere (`--shadow: none`; every card, dialog and button sets `box-shadow: none`). Depth is paper on a desk: white pages with a 1px grid-strong border sit on the lilac-grey paper background, and content on a page is separated by the page's own rules. The one modal (confirm dialog) dims the desk with a 40% ink backdrop and is itself a flat bordered card. Toasts are the only dark surface: ink background, white text, no shadow.

### Named Rules
**The Flat Paper Rule.** Surfaces are white, bordered 1px, and never lifted. If something needs to stand apart, give it a rule or a page, not a shadow.

## Shapes

Three radii, each tied to a thing: pages and cards 10px, buttons and toasts 8px, inputs, chips and nav pills 6px. Rules, borders and strokes are 1px (`--rule` on grid, `--rule-strong` on grid-strong); the only thicker lines are the 3px progress fill and the 2-3px pen strokes. Square elements exist where the notebook is literal: the calendar is a true ô ly grid of 1px gutters with no cell radius, and fill-in slots are a bare 1px purple underline with radius 0. Pen marks (strike, dash, tick) are rounded-cap SVG strokes slightly rotated (-4 to -6deg), as is the Charm remark.

## Components

### Buttons
- **Shape:** softly rounded (8px), 1px border (transparent unless stroked), weight 600, `gap: 8px` for an inline icon, `min-width: 44px`, horizontal padding 24px.
- **Sizes:** md 44px / 16px text; lg 52px / 17px text. Icon-only variants are square 44px (52px for lg speak button).
- **Primary:** purple fill, white text; hover darkens via color-mix 85% purple / black.
- **Secondary:** white fill, grid-strong border, purple text; hover lilac fill.
- **Danger:** white fill, red border, red text; hover 8% red wash. Used for Quên and destructive actions only.
- **Ghost:** transparent, purple text, 12px padding; hover lilac.
- **Disabled:** opacity 0.5, `cursor: not-allowed`. Transition is background-color only, 150ms ease.
- **Grade buttons (review):** four equal columns, 56px tall, secondary style with Quên as danger and the recommended grade (Nhớ) primary; 14px mute hint under each.

### Segmented control
- White, 1px grid-strong border, 8px radius, buttons divided by 1px rules; 44px min, 16px/600 purple text; hover lilac; checked purple fill with white text; focus ring inset 4px in currentColor.

### Cards / Pages
- **Corner Style:** 10px.
- **Background:** white on paper.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px grid-strong.
- **Internal Padding:** 24px (16px on mobile).

### Inputs / Fields
- **Style:** white, 1px grid-strong border, 6px radius, 44px min height, `padding: 10px 12px`, 16px ink text; label 16px/500 ink above with 6px gap; description 14px mute below.
- **Focus:** border turns purple plus the global 2px purple outline at 2px offset. Caret purple; selection lilac.
- **Error:** border red, 14px/500 red message.
- **Switch:** 48x28 track, grid-strong off / purple on, 22px white thumb with 6px radius; stepper buttons are 44px squares.

### Chips
- **Shell chip:** 28px tall, 6px radius, 1px border of 45% lilac, 14px text at 85% white on the purple bar; informational only (sync mode, streak on mobile).

### Status marks
- 14px/500 mute inline text ("khó"); forgotten state is red/600 ("quên 2 lần"). State is written as a word, never a coloured dot or badge.

### Navigation
- **Top bar:** purple, 68px, white 20px/700 brand, links 15px lilac in 6px pills (44px tall, `9px 14px`), hover 12% white wash, current tab white pill with purple 600 text. Focus rings inside the bar are white. Right side holds chips, the streak link and a 44px icon button.
- **Tablet:** nav labels switch to short forms and wrap onto a second row inside the purple bar.
- **Mobile:** nav hidden; a fixed white bottom bar (64px, 1px grid-strong top rule, 5 equal tabs) with 14px/500 mute labels under outline icons, current tab purple/600. Hidden while a review session is active.

### Toast
- Fixed bottom-right (24px), ink background, white 15px text, 8px radius, `12px 16px`, red icon for errors. Mobile: centred above the bottom bar.

### Dialog
- `min(440px, 100vw - 32px)`, white, 1px grid-strong, 10px radius, 24px padding; title 20px/700; actions spaced apart with the destructive button isolated at one end; backdrop 40% ink.

### Empty state / Errors
- Left-aligned stack: 20px/600 title, 16px mute description, actions with 12px gap. Route and login errors are 16px/500 red text with a leading red icon.

### Spinner
- 24px ring, 2px grid-strong with purple top, 0.8s linear spin; under reduced motion a 10px static purple dot.

### Signature: Ruled paper and the notebook page
`.ruled-paper` is the notebook itself: white, 1px grid-strong border, 10px radius, three layered gradients drawing a main rule every 48px (grid-strong), a minor rule every 12px (grid) and a vertical column every 48px (grid), offset so the first main rule sits 23px inside the border; a 1px red margin at 60% opacity stands 72px from the left (40px on mobile). The notebook page writes on it with `padding: 30px 40px 30px 96px`: a 14px mute date on a 24px line, a 34px/700 purple title on a 48px line (white-masked so rules don't cut through letters), and entries each a multiple of 48px with the English in purple at 26px and the gloss inline at 17px. A red Charm remark sits top-right beside the title (desktop), beside the date (mobile), or on its own rule below 390px. The review card reuses the same paper with `padding: 24px 40px 24px 96px` and the English at 36px/600 on the rule. The mistakes note ("Lỗi hay gặp:") is 15px ink with a red underlined label and red wavy underlines on the wrong words.

### Signature: Pen-mark grading (the only motion)
Grading a review card draws a pen stroke over the English: a red slanted strike across the phrase for Quên, a short 64px purple dash (2px) under it rotated -4deg for Khó, a 44px purple tick above the end rotated -6deg for Nhớ and Dễ. Strokes are 3px round-capped SVG lines, drawn with `stroke-dashoffset` from 1 to 0 over 300ms `cubic-bezier(0.16, 1, 0.3, 1)`. Under `prefers-reduced-motion` the mark appears instantly (global `animation: none`). Nothing else in the app animates beyond 150ms background-color transitions and the loading spinner.

### Signature: Ô ly calendar
Eight weeks as a real grid: `.cal-body` is grid-coloured with 1px gaps and a 1px grid border, white square cells with no radius; a studied day is a 28px purple hand-drawn tick rotated -6deg, a partial day a 6px purple dot, today a 1px inset purple outline. The daily-goal bar is a 1px grid rule with a 3px purple fill growing from the left.

## Do's and Don'ts

### Do:
- **Do** set every English phrase in purple at 26px (20px mobile, 36px on the review card) with `lang="en"`, and keep its baseline on a 48px rule.
- **Do** keep the Vietnamese gloss at 17px ink as an inline-block so it drops whole to the next rule; on mobile give it its own 24px line.
- **Do** separate list rows and sections with 1px `--rule` lines and padding, never with nested cards.
- **Do** use only the three radii: 10px pages/cards, 8px buttons/toasts, 6px inputs/chips/nav pills.
- **Do** write state as words in mute ("khó") and reserve red for the forgotten word ("quên"), errors, destructive actions, mistake labels, the margin and the remark.
- **Do** give small mute text on ruled paper a white knockout background so rules do not cut through it.
- **Do** keep all interactive targets at least 44px (`--tap`), buttons 44/52px, with a 2px purple focus ring (white inside the purple bar).

### Don't:
- **Don't** use uppercase, letter-spaced or small-caps labels, kickers or eyebrows anywhere.
- **Don't** add shadows, glows or lifted surfaces; `box-shadow` is always none.
- **Don't** use red for emphasis, success, badges or decoration; purple is the accent, red is the correction.
- **Don't** add a second handwritten remark on a screen, invent new remark texts, or use Charm for anything but the remark.
- **Don't** animate anything beyond the 300ms pen mark, the 150ms button background transition and the spinner; no slide-ins, fades or bouncing.
- **Don't** introduce green, a progress ring, a mascot, glyph icons or badge dots; the world's status language is ink words and pen marks.
- **Don't** render the ruled grid as decoration outside a notebook page or review card; the grid is the functional page, with content sitting on its rules.

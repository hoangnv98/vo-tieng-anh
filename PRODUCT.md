# Product

Name: Vở Ngoại Ngữ. Learning languages since T20: English, Chinese (Simplified), Japanese, Korean; UI stays Vietnamese.

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, with constraints from the user: free tools only, quick to build, needs account sync so each person sees the same data on web and phone, and a few people may use it.

Chosen: Vite + React + TypeScript, installable as a PWA. Supabase free tier for auth (email magic link) and Postgres with row-level security, so every account keeps its own data. Deployed free on Vercel or Netlify. Speech uses the browser Web Speech API (TTS + speech recognition, free). AI conversation and correction (phase 2) uses the Google Gemini API free tier; each user pastes their own key, stored only on their device.

## Users

Vietnamese adults who have "lost the basics" of English (mất gốc, roughly A0–A2) and are restarting a basic spoken-English class. The first user is the owner, who starts a class next month; a handful of friends or family may join with separate accounts. They have jobs and limited time, feel shy about speaking, and forget what they learned between classes. They use the app on both laptop (writing up class notes) and phone (short review sessions).

## Product Purpose

A personal companion to a real English class, not a replacement for it. It turns each class session into material for review, keeps vocabulary and sentence patterns alive with spaced repetition, and gives a private, low-pressure place to practice listening and speaking. Success means the learner reviews a little every day, remembers what was taught, and gets more comfortable speaking out loud.

## Positioning

Built around the learner's own class: what the teacher taught this week becomes the review deck, instead of a generic course. Explanations are in Vietnamese and target the mistakes Vietnamese speakers actually make (dropped final sounds, -s/-ed endings, word stress, linking).

## Operating Context

- After each class: log new words, phrases, and patterns (laptop or phone), plus questions for the teacher.
- Daily, 15–20 minutes: review due cards → shadow a few sentences → (phase 2) role-play one situation with AI → look at mistakes.
- Often on a phone in short gaps, sometimes in noisy places or late at night, sometimes with no earphones.

## Capabilities and Constraints

MVP (phase 1):
1. Class journal: one entry per session, with words/phrases/patterns that become flashcards automatically.
2. Spaced-repetition flashcards (FSRS via `ts-fsrs`): Again/Hard/Good/Easy grading; EN→VI, VI→EN and listen→type directions; TTS audio.
3. Situational sentence-pattern library (greetings, self-intro, ordering food, directions, shopping, work, phone, airport, hotel) with fill-in slots.
4. Shadowing: listen to a sentence, record yourself, play both back, adjustable speed (0.5x / 0.75x / 1x).
5. Habit tracking: daily goal in minutes, streak, calendar.

Phase 2: pronunciation drills targeting Vietnamese-speaker errors with browser speech-recognition feedback; AI role-play conversation with Gemini (slow, simple A1–A2 English, hints, Vietnamese summary of mistakes afterwards); personal mistake log.

Phase 3: placement check, minimal grammar notes in Vietnamese, speaking diary, progress charts, offline support.

Constraints: no paid services; data is per account and syncs across devices; Web Speech recognition works best in Chrome and Edge (Safari support is partial), so the app must degrade gracefully. UI language is Vietnamese, and learning content is English.

## Evidence on Hand

None yet. There are no testimonials, user counts, or course partnerships, and none should be invented. Starter content (sentence patterns per situation) has to be authored as seed data.

## Product Principles

1. The class comes first: the app follows the user's actual course, not a curriculum of its own.
2. Small every day beats a lot once a week: sessions finish in minutes, and the next action is always obvious.
3. Speaking out loud should feel safe: practice is private, mistakes are explained kindly in Vietnamese, and there is no public scoring.
4. Chunks over grammar: whole phrases and patterns you can use, not rules to memorize.
5. Free and personal: no paywall, no ads, and the data belongs to the user.

## Accessibility & Inclusion

Adult learners, some not tech-savvy: large tap targets, readable type at arm's length on a phone, every audio item has a text equivalent, no autoplay surprises in quiet places. Target WCAG 2.2 AA.

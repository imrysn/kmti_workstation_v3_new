# JLPT Learning Tab — Implementation Plan

**Project:** kmti_workstation_v3_new
**Scope (confirmed):** N5 vocabulary is the primary feature — a searchable, filterable, tag-grouped **list** of all ~800 N5 words (word / reading / meaning), same mental model as any "Vocabulary" screen. Flashcards are a **study mode launched from that list** (study all, or study your current selection), not the feature itself. Hiragana/Katakana charts remain flashcard-only (no list view makes sense for a 92-character fixed set). **Progress is session-local only — no DB persistence, no per-user tracking.**
**Estimated effort:** ~2 dev days happy-path, ~3 with the polish items from sections 9/10 (loading/error/empty states, keyboard a11y, `useJlptVocab` hook extraction, existing-pattern audit per 10.0). *(Revised from the original "well under 2 days" — that line was written before the list view, grouping, accessibility, and reuse-audit work existed. Re-check this number again if sections 9/10 grow further before build starts.)*

---

## 1. Architecture decisions (read this before building)

### 1.1 — Vendor the source CSV directly. No HTTP call anywhere in the pipeline, not even at import time.

Originally considered `jlpt-vocab-api.vercel.app` (wkei/jlpt-vocab-api) as a one-time import source, but rejected it: **no LICENSE file in that repo** (confirmed by checking the file tree directly — default copyright applies, so redistributing/vendoring their dataset has no actual legal grant behind it), plus observed data-quality issues (a corrupted `furigana` field, and a `?level=5` request that returned `level: 3` data in one test).

**Switched to `jamsinclair/open-anki-jlpt-decks`** — confirmed via GitHub:
- **MIT licensed** (confirmed in repo metadata), 221 stars, actively maintained (last release Aug 2025, has a CI pipeline).
- Sourced from the same tanos.co.uk (Jonathan Waller, Creative Commons BY) lineage that most of this ecosystem derives from — a real, explicit license chain, not just borrowed goodwill.
- N1–N5 already split into separate files: `src/n5.csv`, `src/n4.csv`, etc.
- `src/n5.csv` confirmed at 719 lines / 62.5 KB — matches the standard ~800-word N5 vocabulary count almost exactly.
- Columns: `word, reading, meaning, tags, hash` (comma-separated, quoted where a field contains a comma). We need `word`, `reading` (≈furigana), `meaning`, **and now `tags`** (see section 1.4 — no longer dropped, since the list view filters/groups by it). `hash` (Anki note GUID) stays irrelevant and is dropped on import. **No romaji column exists in this dataset** — the `romaji` field in our schema stays empty/optional; the flashcard back just shows `meaning`.

**Decision:** don't fetch this over HTTP at all, not even once. Download `src/n5.csv` manually and commit it into this repo at `backend/data/jlpt/n5_source.csv`. The import script reads that local file — zero network calls anywhere in the pipeline, ever.

**Attribution required** (their MIT license terms, and courtesy to the CC BY-licensed underlying data) — add `backend/data/jlpt/ATTRIBUTION.md`:
```
JLPT N5 vocabulary sourced from:
- https://github.com/jamsinclair/open-anki-jlpt-decks (MIT License)
- Underlying data originally from https://www.tanos.co.uk/jlpt/ by Jonathan Waller (Creative Commons BY)
```

### 1.2 — No progress persistence. No DB table, no auth dependency, no username-keying problem.

**Scope change:** per-user progress tracking is cut entirely. `kmti_jlpt_vocab` is the only new table. There is no `kmti_jlpt_progress` table, no `/api/jlpt/progress` endpoints, and `GET /api/jlpt/vocab` needs no auth at all — it's just static reference data, same trust level as reading a bundled JSON file.

This also makes moot the earlier concern about `get_current_user` returning IDs from two different ID spaces (local `kmti_users` vs `kmtifms.users`) — that problem only existed because progress needed to be attributed to a specific person. With no persistence, there's nothing to key by anyone's identity. If per-user progress becomes a real requirement later, revisit that design then — don't build it speculatively now.

**What "known/unknown" looks like in v1:** plain React state (`useState`) in the flashcard page component. Marking a card known/unknown only affects the current session's in-memory list (e.g. moves it to the back of the queue, or filters it out of the current pass). Refreshing the page or closing the app resets it. This is a real, intentional limitation — not a bug — and should be treated as an explicit "known limitation" if anyone asks, not silently glossed over.

### 1.3 — Table creation

This project has no Alembic. New tables are created automatically via `Base.metadata.create_all` in `main.py`'s lifespan handler — the only requirement is that the new model module gets imported somewhere so SQLAlchemy registers it on `Base.metadata` (see `models/__init__.py` pattern already used for `telemetry`, `broadcast`, `stopwatch`, etc.). No manual migration needed for a brand-new table.

### 1.4 — Tags: real format, and why grouping won't cover every word

Actual sample row from `src/n5.csv`:
```
暑い,あつい,"hot (in reference to weather), warm",Genki Genki_Ln.5 Intermediate_Japanese Intermediate_Japanese_Ln.4 JLPT JLPT_5 JLPT_N5,...
```
Tags are **space-separated, multiple per word** — a mix of textbook name (`Genki`, `Intermediate_Japanese`), lesson number (`Genki_Ln.5`), and JLPT-level markers (`JLPT`, `JLPT_5`, `JLPT_N5`).

**Decision:** strip the `JLPT*` tokens on import — they appear on nearly every N5 row and carry zero filtering value once we've already scoped to N5-only. Keep only textbook/lesson tags (`Genki_Ln.X`, `Intermediate_Japanese_Ln.X`, etc.) as the stored `tags` value (space-joined string, source order preserved).

**Known limitation, not a bug:** not every word has a textbook/lesson tag — plenty of N5 entries carry only the generic `JLPT JLPT_5 JLPT_N5` triplet and nothing else. After stripping those, such words end up with an **empty tags string**.

### 1.5 — Grouping decision: gojuon order (kana row), not textbook tags

**Revised decision:** textbook/lesson tags are kept as a **filter**, not the primary grouping. Reasoning: tag coverage is inherently incomplete (an artifact of which Anki contributor happened to cross-reference which textbook chapter, not a property of the vocabulary itself) — no dataset gives full lesson coverage, so any lesson-based grouping was always going to have a large "everything else" bucket. Rather than fight that with a different data source (evaluated and rejected — alternatives either have the same gap, no categorization at all, or an unverifiable license chain on the underlying dictionary content), group by something that's 100% derivable from data already being imported: **gojuon order**, i.e. which kana row (あカさたなはまやらわ) the reading starts with. This is how most dictionaries and vocab lists are organized anyway.

**Derivation (frontend, client-side, no backend/schema change):**
```ts
const GOJUON_ROWS: Record<string, string[]> = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ', 'が', 'ぎ', 'ぐ', 'げ', 'ご'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ', 'ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  'た': ['た', 'ち', 'つ', 'て', 'と', 'だ', 'ぢ', 'づ', 'で', 'ど'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', 'ゆ', 'よ'],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん'],
}
// Build a reverse lookup (kana -> row) once at module load.
```

**Known edge case — katakana loanwords:** for words like `アパート` (apartment), the `furigana` field is katakana, not hiragana (there's nothing to gloss). Normalize the first character to hiragana before the row lookup (katakana and hiragana are a fixed Unicode offset apart: `String.fromCharCode(char.charCodeAt(0) - 0x60)` for characters in the standard katakana block) rather than adding a separate katakana table. Verify this on a real katakana row from the imported data before trusting it blindly — Unicode offset tricks are exactly the kind of thing that looks right until it hits a wide-vowel mark or an edge-of-block character.

**What changes in the UI:** the grouped list (section 5.3) defaults to gojuon-row sections (あ行, か行, さ行, ...) instead of textbook-lesson sections. The tag pills (Genki_Ln.5, etc.) become a **filter row above the list**, same as the search bar — selecting one narrows which words show, it doesn't change how they're grouped. No "Ungrouped" bucket is needed anymore, since every word has a reading and therefore a gojuon row.

### 1.6 — Romaji: computed via `wanakana`, not a new data source

The person found a reference UI (nihongoichiban.com) with a Romaji column and liked the table layout — but that site itself was already evaluated and rejected as a *data source* (no license, personal blog, default copyright — see the conversation history). The table layout and the Romaji column are two separate asks, and only one of them requires new data.

**Decision:** don't source romaji from anywhere. Compute it client-side from the `furigana` we already import, using [`wanakana`](https://www.npmjs.com/package/wanakana) (`npm i wanakana`) — confirmed MIT licensed, maintained by the WaniKani team, 50k+ weekly downloads, does exactly `toRomaji(furigana)`. This sidesteps the licensing question entirely: we're using a code library to transform data we already legitimately have, not importing anyone else's compiled word list.

**Where it's computed:** once, client-side, right after the vocab fetch resolves in `JlptVocabularyList` (section 5.3) — mapped onto each row as `romaji: wanakana.toRomaji(w.furigana)` and stored in state, not recomputed on every render. **List-view table only** — the flashcard back does not show romaji (see section 1.1 and section 5.5); don't wire `wanakana` into the flashcard component. Not stored in the DB — the `romaji` column in section 2's schema stays present but unused; computing on read at ~800 rows is trivially cheap and keeps romaji always in sync with furigana (no risk of the two drifting if furigana is ever corrected).

**Known limitation:** Hepburn romanization from raw kana has real ambiguities (long vowels, particle は/へ read as "wa"/"e", etc.) that a lookup table can't perfectly resolve without sentence context — acceptable here since these are single vocabulary words, not sentences, where that ambiguity mostly doesn't arise. Spot-check a sample after wiring it up (same spirit as the CSV import spot-check in section 3).

---

## 2. Database schema

New file: `backend/models/jlpt.py`

```python
from sqlalchemy import Column, Integer, String, Index
from db.database import Base


class JlptVocab(Base):
    """
    Static reference data — imported once via scripts/import_jlpt_vocab.py.
    Never written to at runtime except by the import script / admin tooling.
    This is the ONLY table this feature needs — see plan section 1.2 for why
    there's no per-user progress table.
    """
    __tablename__ = "kmti_jlpt_vocab"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String(50), nullable=False)
    furigana = Column(String(100), nullable=True)
    romaji = Column(String(100), nullable=True)  # left empty for now — see section 1.1, source dataset has none. See section 1.6: computed client-side via wanakana, not populated here. Column kept for possible future use (e.g. server-side search by romaji) but unused in v1.
    meaning = Column(String(500), nullable=False)
    tags = Column(String(200), nullable=True)  # space-separated textbook/lesson tags, JLPT_* noise stripped — see section 1.4. Empty string, not null, when a word has none.
    level = Column(Integer, nullable=False, default=5, index=True)  # 5=N5 ... 1=N1

    __table_args__ = (
        Index("ix_jlpt_vocab_level_word", "level", "word"),
    )
```

Register in `backend/main.py` alongside the other model imports so `create_all` picks it up:

```python
from models import telemetry as telemetry_model, broadcast as broadcast_model, stopwatch as stopwatch_model, activity_log as activity_log_model, custom_dictionary as custom_dictionary_model, work_schedule as work_schedule_model, jlpt as jlpt_model  # add jlpt_model
```

---

## 3. Import script (one-time, run manually — not part of app startup)

**First, manually download and commit the source file** (one-time repo setup, not code):
1. Download `https://github.com/jamsinclair/open-anki-jlpt-decks/blob/main/src/n5.csv` (use the "Download raw file" button on GitHub).
2. Save it to `backend/data/jlpt/n5_source.csv` in this repo.
3. Add the `ATTRIBUTION.md` file from section 1.1 alongside it.
4. Commit both — from this point on, the import script never touches the network.

New file: `backend/scripts/import_jlpt_vocab.py`

```python
"""
One-time import of N5 vocabulary from the vendored CSV
(backend/data/jlpt/n5_source.csv) into our own kmti_jlpt_vocab table.
Run manually: `python scripts/import_jlpt_vocab.py`

Source: jamsinclair/open-anki-jlpt-decks (MIT License) — see
backend/data/jlpt/ATTRIBUTION.md. No network call — the CSV is committed
to this repo, not fetched live. Do NOT wire this into app startup or any
request path; see implementation plan section 1.1 for why.
"""
import asyncio
import csv
from pathlib import Path
from sqlalchemy import select
from db.database import AsyncSessionLocal
from models.jlpt import JlptVocab

SOURCE_CSV = Path(__file__).parent.parent / "data" / "jlpt" / "n5_source.csv"

async def main():
    if not SOURCE_CSV.exists():
        print(f"[ABORT] {SOURCE_CSV} not found.")
        print("Download src/n5.csv from jamsinclair/open-anki-jlpt-decks "
              "and place it there first (see section 3 of the implementation plan).")
        return

    cleaned = []
    with open(SOURCE_CSV, encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 4:
                continue  # malformed row, skip rather than guess
            word, reading, meaning, raw_tags = row[0].strip(), row[1].strip(), row[2].strip(), row[3].strip()
            if not word or not meaning:
                continue
            # Strip JLPT_* noise tags (JLPT, JLPT_5, JLPT_N5, ...) — see plan section 1.4.
            # Every row has them; they carry zero filtering value once already N5-scoped.
            kept_tags = [t for t in raw_tags.split() if not t.startswith("JLPT")]
            tags = " ".join(kept_tags)  # empty string (not null) when a word has no textbook/lesson tag
            # romaji intentionally left blank — this dataset doesn't include it
            cleaned.append({"word": word, "furigana": reading, "romaji": "", "meaning": meaning, "tags": tags, "level": 5})

    print(f"Parsed {len(cleaned)} words from {SOURCE_CSV.name}.")

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(JlptVocab.word).where(JlptVocab.level == 5))
        existing_words = {row[0] for row in existing.all()}
        new_rows = [JlptVocab(**c) for c in cleaned if c["word"] not in existing_words]
        session.add_all(new_rows)
        await session.commit()
        print(f"Inserted {len(new_rows)} new rows ({len(cleaned) - len(new_rows)} already existed, skipped).")

if __name__ == "__main__":
    asyncio.run(main())
```

**Manual step after running this:** this dataset is well-maintained (MIT, active CI), so a full manual spot-check isn't strictly necessary — but skim a sample after import anyway. Any dataset built from decades-old crowd-sourced JLPT lists can have edge cases like duplicate readings for words with multiple pronunciations.

**Known caveat — dedup is word-text-only:** the `existing_words` check dedupes on `word` alone, not `(word, furigana)`. N5 has legitimate homographs (e.g. words with more than one reading/meaning under the same kanji/kana spelling). If the source CSV has two rows for the same `word` text, only the first one imported survives — the second is silently skipped as a "duplicate," even if it's actually a distinct entry. Low impact at this scale (~800 words, one-time import, spot-checked anyway), but if vocab looks short by a handful of entries after import, this is why.

---

## 4. Backend endpoint

New file: `backend/routers/jlpt.py`

```python
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import Depends
from db.database import get_db
from models.jlpt import JlptVocab

router = APIRouter()


@router.get("/vocab")
async def get_vocab(
    level: int = 5,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns ALL vocab words for the given JLPT level, the primary list-view feed.
    Static reference data, no auth required — same trust level as serving a
    bundled JSON file.

    No search/tag query params on purpose (revised — earlier draft had both):
    at ~800 rows for N5, the frontend (section 5.3) fetches once and does
    search/tag filtering entirely client-side, so backend-side filtering was
    dead code with no caller. It also carried a latent bug — `tag.ilike(...)`
    built patterns directly from tag values like `Genki_Ln.5`, and `_` is a
    SQL LIKE single-character wildcard, so an unescaped tag string could
    accidentally match a tag it shouldn't. Simplest fix: don't do it in SQL.
    If this endpoint ever needs to serve a much larger level (or a non-browser
    client that can't filter client-side), reintroduce filtering then — with
    `_`/`%` escaped via `.ilike(pattern, escape='\\')` or a Python-side filter
    instead of raw ilike on user-supplied tag strings.

    ORDER BY id note: this returns insertion order, not alphabetical/gojuon
    order — that's fine since grouping (section 1.5) is derived client-side
    from `furigana`. Don't "fix" this into a sort later without checking
    whether it actually needs to change; it doesn't drive UI order today.
    """
    query = select(JlptVocab).where(JlptVocab.level == level).order_by(JlptVocab.id)
    result = await db.execute(query)
    words = result.scalars().all()
    return {
        "data": [
            {
                "id": w.id,
                "word": w.word,
                "furigana": w.furigana,
                "romaji": w.romaji,
                "meaning": w.meaning,
                "tags": w.tags.split() if w.tags else [],
            }
            for w in words
        ]
    }


@router.get("/vocab/tags")
async def get_vocab_tags(level: int = 5, db: AsyncSession = Depends(get_db)):
    """
    Returns the distinct set of textbook/lesson tags present at this level,
    for populating the filter dropdown / grouping headers. JLPT_* noise was
    already stripped at import time (section 1.4), so every value here is a
    real textbook/lesson reference. Does NOT include an "Ungrouped" entry —
    that's a frontend concept for rows with an empty tags string, not a tag
    that exists in the data.
    """
    result = await db.execute(select(JlptVocab.tags).where(JlptVocab.level == level, JlptVocab.tags != ""))
    tag_set = set()
    for (tags_str,) in result.all():
        tag_set.update(tags_str.split())
    return {"data": sorted(tag_set)}
```

That's the entire backend surface for this feature — one table, two read-only endpoints, no auth, no writes at runtime.

**Known limitation — no `level` validation:** `level: int = 5` accepts any integer. Since only N5 is imported, `?level=3` won't error, it'll just return `{"data": []}`. Fine today because the frontend only ever calls `level=5` — but if this endpoint gets reused for N4+ before that data exists, an empty array is a quieter failure than a 400 would be. Not worth fixing for v1; just don't be surprised by it later.

Register in `backend/main.py`:

```python
from routers import jlpt
app.include_router(jlpt.router, prefix="/api/jlpt", tags=["JLPT Learning"])
```

---

## 5. Frontend

### 5.1 — Route + nav entry

`src/App.tsx` — add a route following the existing `ProtectedRoute` pattern (still gate behind login even though the data itself needs no auth — keeps it consistent with every other tab in this app, and stops it showing up for logged-out sessions):

```tsx
<Route
  path="/jlpt"
  element={
    <ProtectedRoute>
      <JlptLearning />
    </ProtectedRoute>
  }
/>
```

`<JlptLearning>` is now a thin shell: a tab toggle (Vocabulary | Hiragana | Katakana) plus internal view state (`'list' | 'study'`) that swaps between `JlptVocabularyList` (section 5.3) and `JlptStudyMode` (section 5.5) — one route, not several, same as the original plan. No router changes beyond the single `/jlpt` entry.

`src/components/TitleBar.tsx` — add a nav entry to the `nav` array following the existing icon/label/path pattern.

### 5.2 — API client

`src/services/api.ts` — add alongside the other `*Api` objects:

```ts
export const jlptApi = {
  getVocab: (level: number = 5) => api.get('/jlpt/vocab', { params: { level } }),
  getTags: (level: number = 5) => api.get('/jlpt/vocab/tags', { params: { level } }),
  playAudio: (text: string, voice: string = 'jf_alpha') =>
    api.get('/tts/generate', { params: { text, voice } }),
}
```

Three calls total — vocab list (level only, no search/tag params — see section 4, filtering is client-side), the distinct-tags list for the filter UI, and TTS playback (wired up in section 5.6). No progress endpoints.

### 5.3 — Vocabulary list view (the primary screen)

This is the actual "Vocabulary" feature — what most people picture when they hear the word. Flashcards (section 5.5) are a mode you launch *from* this list, not a replacement for it.

**Layout reference:** table format — Kanji / Furigana / Romaji / Meaning columns, alternating row tint, matching the UI pattern the person referenced (nihongoichiban.com's table — fine to match the *layout*, since a generic column/row table pattern isn't the same thing as the site's content, which stays unused per section 1.6). Adapt colors to the app's existing dark theme rather than copying the reference's light theme literally.

New file: `src/pages/JlptVocabularyList.tsx`

- On mount, fetch `jlptApi.getVocab(5)` and `jlptApi.getTags(5)` in parallel. Immediately after the vocab fetch resolves, map over the ~800 rows once and attach `romaji: wanakana.toRomaji(w.furigana)` to each (see section 1.6) — compute it here, not inline in the row renderer, so it isn't recalculated on every re-render/keystroke. Hold the enriched array in `useState`.
- **Search bar** — debounced input, filters client-side against the already-fetched (and romaji-enriched) ~800 rows. No backend round-trip per keystroke — the `/vocab` endpoint (section 4) intentionally has no `search`/`tag` params; this is the only place filtering happens.
- **Tag filter pills** — populated from `getTags`, plus a synthetic "All" option. Selecting a tag **filters** the list (narrows which words are visible); it does not change grouping — see section 1.5 for why grouping and filtering use different dimensions.
- **Grouping** — default view groups rows by **gojuon row** (あ行, か行, さ行, ... derived client-side from `furigana[0]`, see section 1.5 for the derivation and the katakana-normalization edge case). Every word has a reading, so every word lands in exactly one group — no "Ungrouped" bucket needed. Each group is a collapsible section header, followed by a table (not cards) of its rows.
- **Table columns:** checkbox | Kanji (`word`) | Furigana | Romaji (pre-computed once per row on fetch, not per-render — see the "On mount" bullet above and section 1.6) | Meaning. Checkbox drives selection (local component state, a `Set<number>` of selected ids — not persisted anywhere, resets on navigation away).
- **Selection toolbar** (sticky, appears once ≥1 row is checked): shows count selected, "Study selected" button, "Clear selection" button.
- **Always-visible "Study all N5 words"** button (independent of selection) — launches flashcard mode over the full currently-filtered list (respects search/tag filter if one's active, so "study all" after filtering to a tag studies just that tag's words — an intentional, useful behavior, not scope creep).
- Both study entry points open the same `JlptFlashcard`-based study view (section 5.5), just seeded with a different word array.

### 5.4 — Static Hiragana/Katakana data (no backend involved)

New file: `src/data/kana.ts` — hardcoded, ~92 entries, no API/DB needed:

```ts
export interface KanaEntry {
  kana: string
  romaji: string
}

export const hiragana: KanaEntry[] = [
  { kana: 'あ', romaji: 'a' }, { kana: 'い', romaji: 'i' }, /* ...full set... */
]

export const katakana: KanaEntry[] = [
  { kana: 'ア', romaji: 'a' }, { kana: 'イ', romaji: 'i' }, /* ...full set... */
]
```

### 5.5 — Study mode (flashcards)

New file: `src/pages/JlptStudyMode.tsx` (replaces the old plan's `JlptLearning.tsx` as a full page — now a focused study view, launched from the vocabulary list or a kana tab, not the landing page itself)

- Accepts a word array as input (either "all N5," "current filtered list," or "selected rows," per section 5.3) plus a `source` label so the UI can show "Studying: 12 selected words" or "Studying: all N5 vocabulary."
- Shuffle client-side on entry for variety.
- Flashcard shows `word`/`furigana` on front, `meaning` on back (no romaji shown on the card itself — see section 1.1; romaji is only used in the list-view table, computed once on fetch per section 5.3), flip on click/tap.
- "Mark known" — removes the card from the current session's remaining queue (or moves it to the back; either is fine for v1). Purely local state, no API call at all. This resets every time the page reloads or a new study session starts — that's expected, not a bug (see section 1.2).
- Progress bar for the session: `reviewedCount / totalCount`, reset each time a new study session starts.
- "Back to vocabulary list" / "Back to kana" exits the study view without side effects (nothing to save).

New file: `src/components/JlptFlashcard.tsx` — reusable flip-card component, takes `front`/`back` content as props so it works for both vocab and kana without duplication.

Hiragana/Katakana tabs (section 5.4's data) launch straight into this same study mode — they have no list view of their own (a 46-92 character fixed set doesn't benefit from search/filter/grouping the way ~800 vocab words do), so for kana, "tab click" and "study mode" are effectively the same action.

### 5.6 — Audio playback (TTS)

**No new backend work.** `/api/tts/generate` already exists, is already Japanese-aware (`lang="ja"` auto-activates for any voice starting with `j`), already has a symbol-cleanup map for Japanese text, already does three-tier caching (NAS shared → local → generate), and already requires no auth — same trust level as the vocab endpoint, so this is consistent with the rest of the feature, not a new exception.

**Voice:** default to `jf_alpha`. **Must confirm before wiring the button** — hit `/api/tts/generate?text=こんにちは&voice=jf_alpha` once and confirm it doesn't 500 (i.e. that `jf_alpha` is actually one of the voices baked into `voices-v1.0.bin`, not just a Kokoro-typical name assumed by convention). If it 500s, check what voice names the bin actually contains and swap the default before shipping.

**Frontend wiring:**
- `jlptApi.playAudio` (already added in section 5.2) — adjust to however the endpoint returns audio (likely a URL or binary stream; check the existing router's response type before assuming JSON).
- `JlptFlashcard.tsx` gets a speaker-icon button on the front (word) side. On tap, calls the TTS endpoint with the current word and plays the returned audio via a plain `<audio>` element or `Audio()` object — no new state management needed beyond a simple "is this word currently playing" flag for the icon.
- Kana tabs (Hiragana/Katakana) can reuse the same button/prop if desired, but it's not required for v1 — kana pronunciation is arguably less valuable to hear than vocab words. Optional, cut if short on time.
- Because the cache self-warms (first user to play a word triggers generation + NAS cache write; every subsequent play across all users is instant), there's no batch pre-generation step needed anywhere in the build order.

**Explicitly not doing:** no client-side audio caching/prefetching — the backend's three-tier cache already handles that; duplicating it in the frontend would just be complexity for no benefit at this scale.

---

## 6. Build order

1. `backend/models/jlpt.py` — define the model (including `tags`), register import in `main.py`.
2. Download `src/n5.csv`, commit to `backend/data/jlpt/n5_source.csv` + `ATTRIBUTION.md`.
3. `backend/scripts/import_jlpt_vocab.py` — run once (strips `JLPT*` noise tags per section 1.4), spot-check the imported rows.
4. `backend/routers/jlpt.py` — both endpoints (`/vocab` — level param only, no search/tag, see section 4 — and `/vocab/tags`), register in `main.py`.
5. Manual test: hit `/api/jlpt/vocab?level=5` and `/api/jlpt/vocab/tags?level=5` directly (curl/Postman) before touching frontend — confirm the row count and a couple of sample entries look right. (No `search`/`tag` query params to test — section 4 keeps that filtering client-side only.)
6. **Sanity check TTS voice** (see section 5.6): hit `/api/tts/generate?text=こんにちは&voice=jf_alpha`, confirm it doesn't 500. Do this before step 10, not after — it decides the default voice name the frontend wires up.
7. `src/data/kana.ts` — static data, no dependencies, can be done in parallel with backend work.
8. `src/services/api.ts` — `jlptApi` client (vocab list + tags + TTS playback, section 5.2).
9. `src/pages/JlptVocabularyList.tsx` — the primary list view: search, tag filter, grouping, selection, study-launch buttons (section 5.3). Build and sanity-check this **before** the flashcard component — it's the feature now, not a supporting screen.
10. `src/components/JlptFlashcard.tsx` — reusable flip component, including the audio playback button (section 5.6).
11. `src/pages/JlptStudyMode.tsx` — study view accepting a word array from the list or kana tab (section 5.5).
12. `src/pages/JlptLearning.tsx` — thin shell: tab toggle + list/study view-state switch (section 5.1).
13. `App.tsx` route + `TitleBar.tsx` nav entry.
14. End-to-end test: search/filter/group the vocabulary list, select a subset and "Study selected," separately try "Study all," flip cards, play audio (confirm first play generates + caches, replay is instant), mark known, confirm the queue updates; return to the list and confirm selection/filters reset as expected (session-local, not a regression).

---

## 7. Explicitly out of scope for v1 (don't build these unless asked)

- N4–N1 vocabulary (N5 only).
- Any persistence of progress, selection, search text, or active filters — no DB table, no localStorage, no per-user tracking of any kind. All of it is component state, reset on navigation/reload.
- Spaced repetition scheduling.
- Kanji-specific stroke order / writing practice (kanji appears embedded in vocab words, no separate kanji tab).
- Any live dependency on an external JLPT API or dataset after the one-time vendored import.
- Server-side pagination for the vocab list — ~800 rows is small enough to fetch and filter entirely client-side; don't add pagination/infinite-scroll machinery unless the list actually turns out to feel slow in testing.

---

## 8. Open item to confirm before starting

Manually download `src/n5.csv` from `jamsinclair/open-anki-jlpt-decks` and commit it to `backend/data/jlpt/n5_source.csv` (plus the `ATTRIBUTION.md`) **before** step 3 of the build order — the import script aborts cleanly if the file isn't there yet, but this is a manual one-time step that has to happen first, not something the script does for you.

---

## 9. Notes for whoever picks this up next

Nothing here blocks the build — these are open questions and low-cost enhancements worth a decision (or a deliberate "skip it") rather than silent defaults.

- **Selection vs. tag filter interaction is unspecified.** Section 5.3 doesn't say what happens to `Set<number>` selection when the tag filter changes after some rows are already checked. If a selected word scrolls out of view because a filter narrowed the list, does it stay selected (and get included if the user hits "Study selected"), or get silently dropped? Either is defensible, but pick one on purpose — right now it's whatever React happens to do, which is exactly the kind of thing that becomes a confusing bug report later ("I selected 10 words, filtered, and only got 4").
- **Search matches word/furigana/meaning, not romaji.** Someone who doesn't have a JP IME handy will want to type `atsui` and find 暑い. Since romaji is already computed client-side per row (section 5.3), including it as a fourth search field is a one-line addition (`w.romaji.includes(query)`) — cheap enough to just do, not worth a separate ticket.
- **No automated tests anywhere in the plan** — build order step 5/6 are manual curl/Postman checks, step 14 is manual click-through. Fine for a <2 day feature, but at minimum the import script's tag-stripping logic (section 1.4) and the gojuon/katakana-normalization derivation (section 1.5) are pure functions with real edge cases (empty tags, katakana loanwords) — cheap to cover with a handful of unit tests if this codebase has any existing test setup to slot into. Check before assuming "manual is enough" is still the right call.
- **Table row count vs. rendering strategy.** ~800 rows in one DOM table (even split across gojuon sections) is probably fine, but if it feels sluggish on lower-end hardware once built, that's a virtualization problem (e.g. `react-window`), not a backend/pagination problem — section 7 already correctly rules out server-side pagination, this is just the client-side escape hatch if it's ever needed. Don't pre-build it; only reach for it if step 14's manual test actually feels slow.
- **Attribution is repo-only, not user-facing.** `ATTRIBUTION.md` (section 1.1) satisfies the MIT license's letter, but nobody using the app will ever see it. A one-line "Vocabulary data via open-anki-jlpt-decks (MIT) / tanos.co.uk (CC BY)" in a footer or an "About" panel costs almost nothing and is the kind of courtesy that ages well if this app is ever shown to someone outside the company.
- **`kmti_jlpt_vocab` has no `created_at`/`updated_at` columns.** Harmless today since it's static reference data touched only by the one-time import script, but if a future N4+ import or a data-correction pass ever needs to know "when was this row last touched," retrofitting timestamp columns onto a live table is more annoying than adding them now. Low priority — only add if it's free to do while the model file is already open, not worth a special trip.

---

## 10. Frontend improvements (4th pass)

### 10.0 — Reuse before building new (applies to every item below and every section 5 file)

Before adding any new component, hook, modal, or utility for this feature, check whether this codebase already has one that fits: this app already has patterns for modals, toasts/notifications, loading skeletons, debounce hooks, collapsible sections, and API-client error handling (used by `stopwatch`, `broadcast`, `custom_dictionary`, `work_schedule`, etc. per the existing model registrations in section 2). JLPT is a new *feature*, not a new *app* — it should look and behave like it belongs, not like it was dropped in from a different codebase. Concretely, before writing any of the below from scratch:
- Confirm mode: no new modal component — use the existing one for "Study selected? / Study all?" type confirmations if any are added later.
- Loading state: reuse the existing loading spinner/skeleton pattern, don't invent a JLPT-specific one.
- Toast/error notification: reuse the existing error-toast mechanism for fetch failures (section 10.1) instead of a bespoke inline error banner, unless the existing pattern genuinely doesn't fit an inline table context.
- Debounce: check for an existing `useDebounce`/`useDebouncedValue` hook before writing a new one for the search bar (section 10.1).
- Collapsible sections: check whether an existing accordion/collapsible component is already used elsewhere (e.g. in settings or admin panels) before hand-rolling gojuon group headers.
- API client error handling: match whatever interceptor/error-shape pattern `api.ts` already uses for the other `*Api` objects — don't give `jlptApi` a different error contract than `telemetryApi`/`workScheduleApi`/etc.

If a genuine gap exists (e.g. nothing in this codebase does flip-card UI), building new is obviously fine — the point isn't "never write new code," it's "don't duplicate what's already solved," since duplicated patterns are exactly what turns into inconsistent UX and double the maintenance surface six months from now.

### 10.1 — UX gaps that'll bite during build

- **No loading/error states specified.** Section 5.3 says "on mount, fetch" but doesn't say what renders while ~800 rows + tags are in flight, or what happens if the fetch 404s/500s/times out. Default today is a blank screen, which reads as broken. Use the existing loading-skeleton and error-toast/banner patterns (see 10.0) rather than a one-off spinner.
- **Empty search/filter result state isn't addressed.** A typo in search, or a tag with zero matches after another filter's applied, needs a simple "No words match" message — not a silently empty table.
- **Collapsible group default state (expanded vs. collapsed) isn't decided.** All 15 gojuon sections expanded on first load means a lot of scrolling before anything useful is visible; all collapsed hides content behind an extra click for everyone. Decide on purpose — leaning toward expanding only the group containing the first few words (or none, with a clear "expand all" control) rather than defaulting to whatever's easiest to code.
- **TTS audio button has no failure state.** Section 5.6/10.2 cover the loading/playing state, but not what happens if `/tts/generate` fails (network drop, cache-cold generation timeout, or the `jf_alpha` voice check from build-order step 6 turning out wrong in production). Reuse whatever error-toast pattern is already used for the rest of this list (10.0) rather than leaving the speaker icon silently doing nothing on failure.

### 10.2 — Accessibility (currently unaddressed anywhere in section 5)

- Flashcard flip is specified as "click/tap" only (5.5) — add keyboard support (Space/Enter to flip, arrow keys to advance) since this is a repeated-use study tool, not a one-off form.
- Collapsible group headers need `aria-expanded` and a real `<button>`, not a clickable `<div>` (check 10.0 first — an existing accordion component likely already handles this correctly).
- The audio speaker icon (5.6) needs an `aria-label` ("Play pronunciation") and a visible playing/loading state. A cold-cache first play (TTS generation, not instant playback) will look like a dead button without one.

### 10.3 — Code structure

- `JlptVocabularyList.tsx` as currently scoped owns fetch + search + tag-filter + gojuon-grouping + romaji-enrichment + selection state in one component — too many concerns for one file, and the kind of component that becomes untestable after two more feature requests land on it. Pull the data logic into a hook (`useJlptVocab()`: fetch, romaji-enrich, expose filtered/grouped view) so the component is closer to pure render, and the hook is unit-testable per the section 9 note on testing pure logic. Check for an existing generic `useFetch`/`useApiResource` hook first (10.0) before writing `useJlptVocab` as a one-off from scratch.

### 10.4 — Small but cheap to get right now

- Search debounce value isn't specified — pin it at 200–250ms (standard range) rather than leaving it to whoever implements it to guess. Use the existing debounce hook if one exists (10.0).
- Japanese font stack isn't mentioned anywhere — furigana/kanji need an explicit fallback (e.g. `'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif`) or risk tofu boxes / mismatched system fonts on machines without a JP font pack. Check whether the app's existing theme/typography file already declares a CJK-safe stack (likely, if any other part of this app renders Japanese text) before adding a new one.
- The 4-column table (Kanji/Furigana/Romaji/Meaning) should get a `min-width` and horizontal-scroll fallback rather than squeezing `meaning` text when the window's narrowed — this is an Electron desktop app, and windows do get resized.

---

## 11. Before build starts: triage sections 9 and 10

Sections 9 and 10 are a review trail from four passes, not a final spec — left unresolved, they'll just keep growing with every future pass instead of converging. Before writing code, go through every bullet in 9 and 10 and mark it one of:

- **Decided — fold into sections 1–6.** E.g. once someone picks a collapsible-group default state (10.1) or a debounce value is confirmed at 200–250ms (10.4), that decision belongs in section 5.3 proper, not as a standing question in an appendix.
- **Deferred on purpose — keep as a note, say why.** E.g. spaced repetition, N4+ vocab (already covered in section 7) — fine to leave as "not now" as long as it's a decision, not an oversight.
- **Resolved by this doc already — delete the bullet.** A few items in 9/10 (e.g. the search/tag SQL removal, the romaji-recompute fix) were already acted on in sections 4/5.3/5.5 during this pass — once a fix lands in the primary sections, the corresponding appendix note is redundant and safe to cut rather than kept as historical trivia.

Goal: by the time build order step 1 starts, sections 1–8 should be the complete, self-consistent spec, and sections 9–10 should either be empty or contain only genuinely deferred items — not a growing backlog nobody's triaged.

---

## 12. Phase-by-phase handoff notes (read the relevant block before starting that phase)

This plan will likely be implemented by someone (or some AI session) other than whoever wrote it. These are the specific misreadings/shortcuts most likely to happen per phase, mapped to the build order in section 6. If you deviate from the plan while coding, write the change back into this doc rather than leaving it undocumented — this file is the source of truth across sessions, not a one-time briefing.

**Every phase below ends with a "Phase completion log" block.** Whoever finishes a phase fills it in before handing off — actual work done, any deviation from the plan and why, what's verified vs. not, and a direct note to whoever picks up the next phase. Whoever *starts* a phase reads the previous phase's completed log first, not just the pre-phase guidance — the log is where you'll find out about anything that changed mid-implementation that this static plan doesn't yet reflect. An unfilled log block means that phase hasn't actually been finished, regardless of what the build-order checkbox in section 6 says.

**Before any phase:** don't re-litigate settled scope. No progress persistence, no server-side pagination, no N4+ vocab, no spaced repetition — check section 7 before adding anything that isn't explicitly in sections 1–6. If it's not in the plan, it's out of scope until someone updates the plan.

### Phase A — Backend data layer (build steps 1–3: model, CSV vendoring, import script)
- The import script must make **zero network calls**, ever — not even a "just to double check" fetch during testing. Verify by reading the script before committing: no `requests`/`httpx`/`urllib` import anywhere in it.
- Do **not** populate `romaji` during import, even though it'd be easy to add. It's intentionally left blank — see section 1.6, computed client-side so it can never drift from `furigana`.
- Tag-stripping only removes tokens starting with literal `"JLPT"` — spot-check the output tags after import to confirm no legitimate textbook tag got caught by a loose match.
- Confirm `ATTRIBUTION.md` is actually committed alongside `n5_source.csv`, not just referenced in the plan — the import script's missing-file abort message doesn't check for it.

**Phase A completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built (files touched, row count imported, etc.):**
- **Deviations from this plan, and why:**
- **Verified:** (e.g. spot-checked tags, confirmed zero network calls, confirmed ATTRIBUTION.md committed)
- **Known issues / left unresolved:**
- **Note to Phase B's agent:**

### Phase B — Backend API (build steps 4–6: router, manual test, TTS voice check)
- **Do not add `search`/`tag` query params** to `/vocab`, even if it feels incomplete without them. This was already built, found to be dead code with a latent SQL LIKE bug, and deliberately removed — see section 4's docstring for the full reasoning before re-adding it.
- **Do not add auth** to `/vocab` or `/vocab/tags` for "consistency" with other routers — no auth is intentional (section 1.2), the route itself is still gated behind login at the frontend level (section 5.1), which is a separate decision.
- Step 6 (TTS voice sanity check) is a **hard gate before step 10**, not an optional nice-to-check — if `jf_alpha` 500s, the frontend default voice name changes, so confirm this before any frontend TTS wiring exists to rework.

**Phase B completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built:**
- **Deviations from this plan, and why:**
- **Verified:** (e.g. `/vocab` and `/vocab/tags` manually hit and checked, TTS voice confirmed working — record the actual voice name used if it wasn't `jf_alpha`)
- **Known issues / left unresolved:**
- **Note to Phase C's agent:**

### Phase C — Frontend foundation (build steps 7–8: kana data, API client)
- `src/data/kana.ts` in section 5.4 shows a truncated sample (`/* ...full set... */`) — that's shorthand for "fill in all 46 hiragana + dakuten/handakuten variants and 46 katakana," not a hint that a partial set is acceptable.
- Before writing `jlptApi` in `api.ts`, check the existing error-handling/interceptor shape used by the other `*Api` objects (section 10.0) and match it — don't give this one a different error contract than the rest of the app.

**Phase C completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built:**
- **Deviations from this plan, and why:**
- **Verified:** (e.g. full 92-entry kana set confirmed complete, `jlptApi` error handling confirmed matching existing pattern)
- **Known issues / left unresolved:**
- **Note to Phase D's agent:**

### Phase D — Vocabulary list view (build step 9)
- Compute romaji **once, right after the fetch resolves**, and store it on the row objects — not inline inside the row renderer. This was a real perf fix from section 9/10.3; the two spots in section 5.3 that mention romaji have been reconciled to agree on this, so if any code path recomputes per render, that's a regression, not a stylistic choice.
- Before building the collapsible group headers, search debounce, or loading/empty states from scratch, check for existing accordion/debounce/skeleton/toast components in this codebase (section 10.0). This step is where "reuse before building new" actually gets tested — it's easy to skip under time pressure and just inline everything.
- Two things were flagged as **undecided, not unimportant** (section 9): the default expand/collapse state for gojuon groups, and what happens to `Set<number>` selection when the tag filter changes underneath it. Pick an explicit behavior for both — don't ship whatever React happens to do by default.
- **"Study selected" and "Study all N5 words" will necessarily be stubs at the end of this phase.** Section 6 deliberately builds the list view (step 9) before the flashcard component (steps 10–11), so `JlptFlashcard`/`JlptStudyMode` don't exist yet when Phase D finishes. That's expected, not a bug — don't burn time half-building a temporary flashcard just to make the buttons "work," it'll get thrown away in Phase E. Wire the buttons to a clearly-inert placeholder (disabled state, a `console.log` of the word array that would've been passed, or a "coming in next phase" toast) and record exactly what state you left them in in this phase's completion log — Phase E's agent needs to know precisely what to wire up rather than guessing whether the buttons already do something.

**Phase D completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built:**
- **Decisions made for the previously-undecided items:** (default expand/collapse state chosen; selection-vs-filter behavior chosen)
- **State the study-launch buttons were left in** (disabled / placeholder / logs the word array / etc. — be specific, Phase E needs this):
- **Deviations from this plan, and why:**
- **Verified:** (e.g. romaji confirmed computed once not per-render, reused components confirmed vs. new ones written — list what was reused vs. newly built)
- **Known issues / left unresolved:**
- **Note to Phase E's agent:**

### Phase E — Flashcard + study mode (build steps 10–12)
- **First task of this phase: wire up the study-launch buttons left as stubs at the end of Phase D.** Check Phase D's completion log for exactly what state they were left in before assuming anything — don't rebuild the list-view trigger logic from scratch if Phase D already worked out how the word array should be passed.
- No romaji on the flashcard front or back — romaji only appears in the list-view table (section 5.3). This was a doc inconsistency that's now fixed in both 5.3 and 5.5; if you're implementing from memory of an earlier draft, double-check the current wording.
- "Mark known" is **pure local state** — no API call, no persistence. If you find yourself adding a fetch call here, stop and re-read section 1.2; this is deliberate, not an oversight to "fix."
- Build keyboard support (Space/Enter to flip, arrows to advance) as part of this phase, not as a retrofit afterward — section 10.2 flagged this as currently unaddressed; it's cheaper to add now than to patch onto a shipped component later.

**Phase E completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built:**
- **Deviations from this plan, and why:**
- **Verified:** (e.g. confirmed no romaji on flashcard, confirmed "mark known" has zero API calls, keyboard nav tested)
- **Known issues / left unresolved:**
- **Note to Phase F's agent:**

### Phase F — Integration & QA (build steps 13–14)
- `ProtectedRoute` on `/jlpt` (frontend route gating) and "no auth on the API" (backend) are two independent decisions — don't conflate them. Adding auth to the endpoints or removing the route guard would each undo a separate, deliberate choice.
- The end-to-end test pass (step 14) should explicitly exercise: the selection-vs-filter behavior decided in Phase D, an empty search/filter result, a TTS failure (not just a successful cold/warm play), and the collapsible-group default state — not just the happy path listed in section 6.
- Before calling the feature done, run the section 11 triage on sections 9/10 — the feature isn't finished if there's still an unresolved appendix nobody looked at.

**Phase F completion log**
- **Status:** ☐ Not started ☐ In progress ☐ Complete
- **Completed by / date:**
- **What was actually built / tested:**
- **Deviations from this plan, and why:**
- **Verified:** (e.g. full e2e checklist from step 14 run, section 11 triage completed — link or summarize the triage outcome)
- **Known issues shipped with (if any), and why they were accepted:**
- **Final note for whoever reads this plan after the feature ships:**


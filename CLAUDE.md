# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Turbopack enabled)
npm run build    # Production build
npm start        # Run production server
npm run lint     # Run ESLint
```

No test framework is currently configured.

## Architecture Overview

**StudyFlow** is a Next.js 16 app that syncs Canvas LMS assignments into a local task manager with focus/Pomodoro tools. All data persists in `localStorage` — there is no backend database.

### Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Styling**: Tailwind CSS 4 with CSS variables for theming (`--primary`, `--bg`, `--text`, etc.)
- **State**: React Context (`AppProvider` in `src/hooks/useAppData.tsx`) + `localStorage`
- **Drag & Drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Browser Automation**: Puppeteer (with stealth plugin) + Playwright as fallback
- **Animation**: Motion (Framer Motion v12)
- **Path alias**: `@/*` → `./src/*`

### Data Flow

```
/setup page → POST /api/canvas → Puppeteer/Playwright logs into Canvas
                                → fetches courses + assignments via Canvas REST API
                                → returns to frontend → stored in localStorage

AppProvider (Context) → loads from localStorage on mount
                      → exposes tasks, blocks, courses, tags, settings
                      → persists all mutations back to localStorage

Dashboard → reads filtered/sorted tasks via useFilteredTasks hook
          → drag-and-drop reordering via @dnd-kit
          → FocusMode overlay (Pomodoro timer per task)
          → TaskEditModal for editing individual tasks
```

### Key Directories

- `src/app/` — Next.js pages and API routes
  - `api/canvas/route.ts` — Canvas login automation (`maxDuration = 300s`)
  - `api/notion/` — Notion OAuth + sync (partially implemented, not wired to UI)
- `src/components/` — UI components (`TaskCard`, `TaskBlock`, `TaskEditModal`, `CalendarView`, `FilterPanel`, `FocusMode`)
- `src/hooks/useAppData.tsx` — Central state: all task/block/course/tag CRUD lives here
- `src/hooks/useFilteredTasks.ts` — Memoized filter + sort logic
- `src/lib/` — `storage.ts` (localStorage), `colors.ts` (color palettes), `cn.ts` (clsx wrapper)
- `src/types/index.ts` — All TypeScript interfaces (`StudyTask`, `TaskBlock`, `CanvasConfig`, `MacroStep`, `AppData`, `FilterState`, etc.)

### Canvas Automation

The `/api/canvas` route uses a `MacroStep[]` sequence (recorded by the user on `/setup`) to automate login:

- Step types: `click`, `fill`, `navigate`, `wait`, `press`
- Puppeteer launches with `puppeteer-extra-plugin-stealth`; falls back to Playwright on failure
- Waits for the browser to land on a `.instructure.com` domain before hitting the Canvas REST API

### Notion Integration

Auth routes exist (`/api/notion/auth`, `/callback`, `/provision`, `/refresh`, `/sync`) but are not yet connected to any UI. The integration is incomplete.

### State Shape

`AppData` (in `localStorage`) holds: `config` (Canvas credentials + macro), `courses`, `assignments`, `tasks`, `blocks`, `tags`, `settings` (timer duration, theme, Notion credentials).

Canvas credentials are stored in plaintext in `localStorage` — avoid changes that log or expose this data.

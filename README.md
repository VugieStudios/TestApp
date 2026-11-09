# Grow

A gamified self-help and life-management app: habits with flexible schedules and streak freezes, goals that break themselves into daily micro-goals, a brain dump, guided journaling, a focus timer, mood & energy analytics, automatic weekly/monthly reviews, Low Energy Mode, a 1-minute-rule kicker, XP/levels/badges, and a customizable dashboard.

Live at https://vugiestudios.github.io/TestApp/ (deploys automatically on every push to `main`).

## Architecture

```
src/
  lib/            pure logic, no UI
    store.js      data model, migration of older data, all actions, Supabase sync
    dates.js      date helpers (weeks run Mon–Sun)
    habits.js     schedules (daily / specific days / x per week), streaks with freezes
    goals.js      automatic goal breakdown into micro-goals, pace tracking
    game.js       XP per day, levels, ranks, badges, daily quests
    analytics.js  day scores, pattern insights (correlations), weekly/monthly reviews
    timer.jsx     shared Pomodoro timer (survives tab switches and reloads)
    supabase.js   login + database connection
  components/     shared UI: rings, sheets, player card, celebrations, 1-minute kicker
  widgets/        dashboard widgets (habits, micro-goals, focus, tasks, check-in, journal, dump, grid, insights)
  views/          screens: Today (dashboard), Habits, Goals, Mind, Stats, Profile, Login
```

All data is one JSON document per user in the Supabase `user_data` table, cached in the browser for instant and offline use. All XP is derived from the data, so it can't drift or be farmed.

## Run locally

```bash
npm install
npm run dev
```

# 🌱 Grow

A personal self-help app: daily habits with streaks, a mood & energy check-in, journal prompts, goals broken into small steps, and insights over time.

## Using it

The app is published automatically to GitHub Pages every time code is pushed to `main`.
Your data is stored in your own browser. Use **Insights → Download backup** now and then.

## Running it on your computer

```bash
npm install
npm run dev
```

## How the code is organised

- `src/store.js`: all data and the actions that change it (the only file to change when adding a server/accounts later)
- `src/dates.js`: date helpers
- `src/views/`: one file per screen (Today, Habits, Goals, Journal, Insights)
- `src/styles.css`: all styling

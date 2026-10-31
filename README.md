# Kioku (記憶)

A set of memory-training tools, starting with **Digits**, modelled on the World Memory Championships "speed numbers" discipline.

## Digits

Level *n* asks you to memorise *n* random digits. Recall all of them correctly to move on to level *n* + 1; otherwise you retry level *n*.

Each round has three stages, any of which can be ended early: 60 s to memorise, 10 s of reflection, and 4 min to recall.

| Stage | Controls |
| --- | --- |
| Memorise | `→` / `←` step through groups; `Space` or `↑` returns to the start; `Enter`, the Finished button, or `→` twice quickly at the end stops the timer |
| Recall | Click a cell or use arrow keys; type `0`–`9`; `Backspace` deletes to the left; `+` inserts an item; `-` deletes one; `Enter` submits |

On touch devices the recall stage shows an on-screen keypad, and tapping the digits advances through the memorise stage. Progress and statistics are stored in the browser's `localStorage`; there is no backend.

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # type-check and production build
```

## Deployment

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to **GitHub Actions** once. The build uses relative asset paths, so it works under `/Kioku/` without further configuration.

Live site: https://eddporter.github.io/Kioku/ (the path is case-sensitive).

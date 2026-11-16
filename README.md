# Doux Arcade

Two browser games for Doux and the arcade page that lists them. Everything is plain HTML, CSS and JavaScript with no build step.

| Folder | What it is |
|---|---|
| `/` (this folder) | The arcade home page: `index.html`, the two card pictures and its fonts |
| `coin-run/` | Coin Run, a Three.js shooter. Collect currency coins and beat a boss at the end of each of ten levels. |
| `brick-breaker/` | Brick Breaker. Clear eight levels of bricks; some bricks drop a Doux coin that gives a power-up. |
| `supabase/migrations/` | Database setup for the optional shared leaderboard |

## Running it

Serve this folder with any static server and open the address it prints:

```bash
npx serve .
```

The arcade cards link to `coin-run/` and `brick-breaker/`, and each game's back link goes to `../`, so the whole folder works as one site on any static host (Vercel, Netlify, Cloudflare Pages, S3 and so on).

To give each game its own address instead, host each folder as its own site, then change the two `href`s on the arcade cards in `index.html` and the back link (`class="arcade"`) near the top of each game's `index.html`.

## Leaderboard (optional)

The leaderboard is switched off in this copy. Without it, each game keeps scores on the player's device and never asks for a name, and the arcade's trophy button and Brick Breaker's Leaderboard button are hidden.

To switch it on:

1. Create a Supabase project.
2. Run the three files in `supabase/migrations/` in name order, with `supabase db push` or by pasting them into the SQL editor. They create the score tables, the leaderboard views and the `arcade_` functions the games call.
3. In all three `index.html` files, fill in the line `const LB = { url: '', key: '' };` with the project URL and its publishable (anon) key. That key is designed to be public: the database rules let it read the boards and call the `arcade_` functions, nothing else.
4. If the games end up on different subdomains of one site (`coin.example.com`, `bricks.example.com`), set `COOKIE_DOMAIN` to `'example.com'` in both games. Players then keep the same name in every game.

Player names are unique across all the games. There is no sign-in: each browser makes a random secret key, keeps it in a `doux_player` cookie, and the database stores only a hash of it next to the name.

## Shared parts

- `doux-assets.js` is the 3D model library for the coins. Both games carry their own copy, so after changing one, copy it to the other folder to keep the coins matching.
- `vendor/` in each game holds Three.js r128 and its bloom effect (MIT licence).
- `fonts/` in each folder holds Grozel (titles) and Noir Pro Light (everything else). Both are commercial fonts. Check that your licence covers web use on your domain before going live.

## Brick Breaker power-ups

| Coin | Power-up |
|---|---|
| Naira | Wider paddle for 12s |
| Dollar | Splits every ball into three |
| Pound | The paddle fires lasers for 10s |
| Euro | Sticky paddle for 12s |
| Tether | Slows the ball for 10s |
| Solana | Fireball for 8s, smashes through bricks |
| Bitcoin | Extra life (rare) |

## Adding a game to the arcade

Copy one `<li class="game">` block in the root `index.html` and change the picture, title, tagline and link. Card pictures are square JPEGs (900 by 900) taken from the game with its score and buttons hidden. For the game to count on the combined leaderboard, it needs its own scores table and a column in the `arcade_leaderboard` view.

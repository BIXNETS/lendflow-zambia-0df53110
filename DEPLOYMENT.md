# Deploying to Vercel

This app is a TanStack Start (SSR) app. Vercel builds it through Nitro, which is enabled automatically when `VERCEL=1` is present (or locally via `DEPLOY_TARGET=vercel`). The default build used elsewhere is unchanged.

## Quick deploy (one click)

1. Sync this project to GitHub from the Lovable editor: **Plus (+) menu → GitHub → Connect project**.
2. Replace `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` in the README deploy button with your actual repository path.
3. Click the **Deploy with Vercel** button in README.md and fill in the environment variables when prompted.

## Manual import

In Vercel: **Add New → Project → Import** this repository. Leave the framework preset on auto-detect (TanStack Start / Nitro). The `vercel.json` at the project root supplies the build settings.

- Build command: `vite build` (set automatically by `vercel.json`)
- Output: `.output` (produced by Nitro, detected automatically)
- Install command: default (`npm install`)

## 2. Environment variables

Add these in **Project → Settings → Environment Variables** for Production,
Preview and Development:

Client (must keep the `VITE_` prefix):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Server-only:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MOMO_WEBHOOK_SECRET`

Copy the values from the project's backend settings. Never expose the service
role key or the webhook secret to the client.

## 3. Webhook / callback URLs

After the first deploy, point the mobile-money provider at:

```
https://<your-vercel-domain>/api/public/momo/webhook
```

The handler verifies the HMAC signature with `MOMO_WEBHOOK_SECRET`, so the same
secret must be configured on both sides.

## 4. Auth redirect URLs

Add the Vercel production and preview domains to the backend Auth settings
(Site URL + Redirect URLs) so email confirmation and OAuth return correctly.

## 5. Local verification

```bash
npm run build:vercel   # builds the Nitro/Vercel output into .output
npm run start:vercel   # runs that output locally on Node
```

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ee511c91-5bbb-4716-b64e-4a6ff99c2490

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production Setup

Set these environment variables on the hosting provider:

```env
NODE_ENV=production
DATABASE_URL=your-postgres-connection-string
AUTH_SECRET=use-a-long-random-secret
JWT_SECRET=use-a-different-long-random-secret
INITIAL_ADMIN_EMAIL=your-admin-email
INITIAL_ADMIN_PASSWORD=use-a-password-at-least-12-characters
INITIAL_ADMIN_NAME=Your Name
INITIAL_ORGANIZATION_NAME=Your Store Name
```

Production does not create demo products, sample sales, promotions, or demo accounts. Add your real products and staff after the first admin login.

### Railway deployment

1. Add a Railway PostgreSQL service to the project.
2. Add the PostgreSQL service's `DATABASE_URL` to the app service variables.
3. Set `NODE_ENV=production` and the production variables above.
4. Use `npm run build` as the build command and `npm start` as the start command.

The app intentionally does not use the embedded PGlite database in production. This prevents a missing Railway database variable from causing the container to be killed while initializing a local database.

To remove the existing seeded demo catalog from a database, run this once with the correct database environment loaded:

```powershell
$env:CONFIRM_DEMO_DATA_DELETE="YES"
npm run db:clean-demo
```

This command removes demo products and their sample sales, purchases, stock, serials, and promotions for the bundled demo organizations only.

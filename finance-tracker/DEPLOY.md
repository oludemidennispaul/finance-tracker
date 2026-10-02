# Putting Mimo Eye online

This guide gets the app onto a permanent web address that you and your friends can open from any phone or computer, and install like an app. It uses two free services:

- **Neon** stores the database. Its free plan is permanent and needs no card.
- **Render** runs the app and redeploys it every time you change the GitHub repo.

Total time: about 20 minutes. Everything is done in the browser.

## 1. Create the database on Neon

1. Go to **neon.com** and sign up (signing in with GitHub is fine).
2. Create a project. Name it `finance-tracker` and pick the region **AWS Europe Central (Frankfurt)**. Any region works; Frankfurt is closest to Nigeria.
3. On the project dashboard, click **Connect**. Copy the connection string. It looks like:

   ```
   postgresql://neondb_owner:abc123...@ep-something.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   Keep this private. Anyone with it can read the database.

You don't need to create any tables. The app does that itself every time it starts.

## 2. Run the app on Render

1. Go to **render.com** and sign up with GitHub. When asked, give Render access to the `finance-tracker` repo.
2. Click **New +** then **Web Service**, and pick the `finance-tracker` repo.
3. Fill in the form:

   | Setting | Value |
   |---|---|
   | Name | anything, e.g. `my-finance`. It becomes part of the address: `my-finance.onrender.com` |
   | Region | **Frankfurt** (same as the database) |
   | Branch | `main` |
   | Root Directory | `finance-tracker` |
   | Runtime / Language | Node |
   | Build Command | `npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `NODE_ENV` | `production` |
   | `SIGNUP_CODE` | a code you choose, e.g. `lagos-friends-2026`. Only people with this code can create an account. |

5. Click **Create Web Service**. The first build takes a few minutes. When the log shows `App listening`, open the address at the top of the page.

6. **Create your own account first.** Then send friends the address and the invite code.

## 3. Install it on a phone

Open the address on the phone, sign in, then:

- **Android (Chrome):** menu (three dots) then **Add to Home screen** or **Install app**.
- **iPhone (Safari):** Share button then **Add to Home Screen**.

It opens full screen with its own icon. You stay signed in for 30 days at a time.

## Things to know about the free plans

- **First open can be slow.** Render puts free apps to sleep after 15 minutes without visitors. The next visit wakes it up, which takes about a minute. After that it's fast. Upgrading the Render service to a paid instance removes the sleep.
- **Limits are generous for personal use.** Render gives 750 free hours a month, enough for one app running all month. Neon's free plan gives 0.5 GB of storage, which is years of expense entries for a group of friends.
- **Updating the app:** commit a change to the repo on GitHub and Render rebuilds and redeploys automatically. Your data stays in Neon untouched.

## Keeping it awake (optional, free)

To avoid the one-minute wake-up screen, have a free service visit the app every 10 minutes:

1. Sign up at **cron-job.org** (free).
2. Create a cron job with URL `https://YOUR-APP.onrender.com/api/ping`, running **every 10 minutes**.
3. Save it.

`/api/ping` doesn't touch the database, so this keeps the app awake without using up Neon's free compute. One app running all month uses about 744 of Render's 750 free hours, so only keep **one** free Render service awake this way.

## Keeping it safe

- Choose a `SIGNUP_CODE` that isn't easy to guess, and change it in Render's **Environment** tab if it gets shared too widely. Changing it doesn't affect existing accounts.
- **Never run `npm run seed` against the live database.** It creates a demo account with a public password. (The script refuses to in production unless forced.)
- Each person only ever sees their own data. The server checks ownership on every request.
- Passwords are stored hashed, never as plain text. Sign-in attempts are limited to 10 per 15 minutes per email.
- There is no "forgot password" email yet. If a friend gets locked out, delete their account in Neon's SQL editor so they can sign up again:

  ```sql
  DELETE FROM users WHERE lower(email) = 'their@email.com';
  ```

  This removes that account's data too.

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| Build fails saying it can't find `package.json` | Root Directory isn't set to `finance-tracker` |
| Log shows `Migration failed` or `password authentication failed` | `DATABASE_URL` was pasted incompletely. Copy it again from Neon. |
| A loading screen for up to a minute | Normal: the app is waking up after sleeping. |
| "That invite code is not correct" | The code is case-sensitive. Check `SIGNUP_CODE` in Render. |

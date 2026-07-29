# Supabase Development Database Setup Guide

When developing new features, testing them on a separate Development Database prevents accidental data loss for your real users.

## 1. Create the Development Database
1. Go to the [Supabase Dashboard](https://app.supabase.com/).
2. Click **New Project** and name it something like `Coaching-System-Dev`.
3. Wait for the database to finish setting up.

## 2. Copy Data from Production to Development (Schema + Data)
To perfectly clone your existing production database (with all students, fees, and data) into your new Dev database, you can use the standard PostgreSQL tools: `pg_dump` and `psql`.

1. Open your terminal.
2. Get the **Connection String (URI)** for your **Production** Supabase Database (found in Project Settings -> Database).
3. Get the **Connection String (URI)** for your new **Development** Supabase Database.
4. Run this command to export your Production data to a local file:
   ```bash
   pg_dump "postgres://postgres.[PRODUCTION_REF]:[PRODUCTION_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" --clean > backup.sql
   ```
5. Run this command to import that data into your Development database:
   ```bash
   psql "postgres://postgres.[DEV_REF]:[DEV_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" -f backup.sql
   ```
*(You can do this whenever you want to refresh your Dev database with the latest real data!)*

## 3. Managing Environment Variables
To switch your code to use the new Dev database:

### For the Backend (FastAPI):
1. In your `backend/` folder, rename your live `.env` to `.env.prod`.
2. Create a new file named `.env.dev` and paste the `SUPABASE_URL` and `SUPABASE_KEY` from your new Dev project.
3. **To switch to Development:** Rename `.env.dev` to `.env`. (Rename back to switch to production).

### For the Frontend (Vite):
1. Keep your real production keys in `.env.production`.
2. Put your Dev keys in a file named `.env.local` (or just `.env`).
3. When you run `npm run dev`, Vite automatically uses `.env.local`. When you push to Vercel/Render, it automatically uses `.env.production`.

# Setting up accounts (Supabase)

Accounts, saving pieces and templates to an account, and share links (ADR-126 to ADR-138) need a Supabase project.
Until the two repository variables below are set, the deployed app is built without accounts and works as before.
These steps are done once, by the owner of the backend account (G-219). Nothing here can be done from the app.

## 1. Create the project

1. Create a Supabase account under your own name and a new project in an **EU region** (G-218), on the **Free** plan
   (G-213).
2. Note the project URL (`https://<ref>.supabase.co`) and the **anon (public) key** from Project settings › API. Never
   copy the `service_role` key anywhere: the app must not have it (ADR-131, `tests/security.test.ts`).

Free plan facts used here (web search 2026-10-28 citing supabase.com/pricing; supabase.com itself was not reachable
from the build session, so check them on the page): 500 MB database, 1 GB file storage, 50,000 monthly active users,
2 active projects, **free projects pause after 1 week of inactivity** (restored from the dashboard, no data deleted);
Pro is $25 per month.

## 2. Create the tables and rules

Open SQL editor and run `supabase/migrations/20261028000000_accounts.sql` once. It creates `records` and `shares`,
the row-level security rules and the functions the app calls. The same rules are tested on a local PostgreSQL with
`bash tools/supabase/test-sql.sh`.

## 3. Sign-in settings (Authentication)

- **URL configuration:** Site URL `https://chiriacsergiucs-v2.github.io/furniture-builder/`; add the same URL (and
  `http://localhost:5173/furniture-builder/` for development) to the redirect URLs.
- **Email provider:** on. Turn **Confirm email off** (G-254: no email verification).
- **Google provider:** on, with a Google Cloud OAuth client (G-248): create an OAuth client of type _Web application_
  in Google Cloud Console, add Supabase's callback URL shown on the provider page as an authorised redirect URI,
  and paste its client id and secret into Supabase. The consent screen asks only for name and email
  (`openid email profile`).
- **Account linking:** a Google login and a password login with the same email stay separate accounts (G-249). Keep
  Supabase's automatic linking of unverified identities off.
- **Emails (G-250):** the built-in email sender is used. Note: search results (2026-10-28) say Supabase's built-in
  sender sends only to addresses of the project's own team, about 2 emails per hour. Password-reset emails will then
  not reach other users. A custom SMTP sender (Authentication › Emails › SMTP) fixes that; see G-276.

## 4. Turn accounts on in the deployed app

In GitHub: Settings › Secrets and variables › Actions › **Variables**, add:

- `SUPABASE_URL` = the project URL
- `SUPABASE_ANON_KEY` = the anon key

The next `Deploy GitHub Pages` run builds with them: the **Account** button appears in the top bar and the content
security policy allows only that Supabase origin (ADR-131).

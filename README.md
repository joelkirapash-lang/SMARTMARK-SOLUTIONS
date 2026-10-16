# SMARTMARK SOLUTIONS

A multi-tenant marks management platform for schools on Kenya's CBC (Playgroup to Grade 10).
Every school is fully isolated. Nothing is pre-loaded: no demo schools, learners, grades or marks.

## Who does what

| Role | What they can do |
|---|---|
| **Super Admin** (you) | Create schools, set learner/staff limits and payment status, **pause or resume a school**, see platform-wide activity, and **visit any account in read-only view-as mode** |
| **School Admin** | Create teacher, educator and learner accounts (single or CSV), grades/streams/subjects, performance levels, teacher access, exams and deadlines, promotion, remarks bank, settings |
| **Teacher / Educator** | Enter marks only for the grade, stream and subject the admin assigned. Read marklists, trends and report cards. Deadline reminders |
| **Learner** | See only their own published results, progress chart and report cards |

No email is involved. The admin creates an account and gets the sign-in details on screen immediately
(copy, CSV, or printable slips). The login email is generated as `firstname.secondname@role.schoolname.com`
(for example `john.kamau@teacher.anestar.com`). A random temporary password is shown **once**; the person
chooses their own password at first sign-in.

## Run it locally

Backend (terminal 1):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
flask db upgrade
flask create-superadmin
python run.py
```

Frontend (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the Super Admin you just created.
Flask reads `backend/.env` on its own, so do not `export` it by hand.
For production, put long random values in `SECRET_KEY` and `JWT_SECRET_KEY`:
`python -c "import secrets; print(secrets.token_hex(32))"`.

### Importing marks from a file

Open **Import marks** in the sidebar (admins and teachers). Choose the exam and class, download the template
(it already lists your learners and subjects), fill in the scores, upload it and review the preview. Nothing is saved
until you confirm. Learners are matched by admission number (or by exact name if there is no admission column).
Blank cells are left alone, bad cells are reported, and teachers can only import subjects they are assigned to.
The marklist then ranks everyone from first to last, and the class report cards are one click away.

### Dark and light mode

Use the sun/moon button in the top bar, or **Account and password > Appearance** (Light, Dark or System).
Printed report cards and marklists are always in light colours.

### First steps

1. Sign in as Super Admin, open **Schools**, **Add school**, set the learner and staff limits. Copy the admin sign-in details.
2. Sign out, sign in as that School Admin (you will be asked to choose a password).
3. **Academics**: add grades, streams, subjects, performance levels. The "standard CBC" buttons are optional shortcuts.
4. **Accounts**: add teachers, educators and learners, or import a CSV. **Teacher access**: assign classes. **Exams**: create one.
5. Teachers enter marks. Marklists, report cards, trends and the dashboard fill in by themselves.

## Tests

```bash
# backend: 17 tests (tenant isolation, roles, limits, suspension, view-as, marks import, time handling...)
cd backend && source venv/bin/activate && python -m pytest -q

# frontend: 42 full-stack tests that render every screen for every role against a live backend
cd backend
export DATABASE_URL=sqlite:////tmp/e2e.db RATELIMIT_ENABLED=0 PORT=5055
rm -f /tmp/e2e.db && flask db upgrade
printf 'Dev\n\ndev@smartmarksolutions.com\nSuperPass1\nSuperPass1\n' | flask create-superadmin
python run.py &            # leave running
cd ../frontend
VITE_API_BASE_URL=http://127.0.0.1:5055/api npm test
```

## Deploy (Netlify + PythonAnywhere free tier)

Because no email is sent, the free PythonAnywhere plan works fine.

**Backend (PythonAnywhere)**
1. Bash console: `git clone <your repo>`, then `cd smartmark-solutions/backend`.
2. `mkvirtualenv --python=/usr/bin/python3.12 sms && pip install -r requirements.txt`
3. Create `.env` with real `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS=https://YOUR-SITE.netlify.app`, `FRONTEND_BASE_URL=https://YOUR-SITE.netlify.app`.
4. `flask db upgrade` then `flask create-superadmin`.
5. Web tab: new manual web app, set the virtualenv, and use this WSGI file:
   ```python
   import sys
   sys.path.insert(0, "/home/YOURUSER/smartmark-solutions/backend")
   from dotenv import load_dotenv
   load_dotenv("/home/YOURUSER/smartmark-solutions/backend/.env")
   from app import create_app
   application = create_app()
   ```
6. Reload, then open `https://YOURUSER.pythonanywhere.com/api/health`.

**Frontend (Netlify)**: import the repo. `netlify.toml` already sets base `frontend`, build `npm run build`,
publish `dist`, and the single-page redirect. Add the environment variable
`VITE_API_BASE_URL=https://YOURUSER.pythonanywhere.com/api`.

## Security and privacy notes

- The school is always taken from the signed-in user's database record, never from anything the browser sends.
- Passwords are bcrypt-hashed. Temporary passwords are random, shown once, and force a change.
- Sign-in is rate limited. Public parent report links are rate limited, expire after 30 days, and only work for published exams.
- **View-as is read-only and logged to the platform activity feed.** Schools hold learners' data, so tell your customers about this
  support access in your terms of service.
- Teachers do not see guardian phone numbers or dates of birth. Only admins do.
- Back up the database regularly. On PythonAnywhere, download `backend/smartmark_solutions.db` or move to PostgreSQL by setting `DATABASE_URL`.

## Not included

Crest/logo is a web address (no file upload yet), PDF comes from the browser's Print > Save as PDF, and there are no
email or SMS notifications. Reminders appear inside the app (bell icon and dashboard).

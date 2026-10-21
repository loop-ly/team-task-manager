# Team Task Manager

A full stack web app where teams plan and track work together: register, create teams, add members, then create, assign and filter tasks.

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router                        |
| Backend  | Node.js, Express 5, Joi validation, Helmet, rate limiting            |
| Auth     | Passport (local strategy) + express-session, HTTP-only cookie, bcrypt |
| Database | PostgreSQL (Google Cloud SQL compatible); sessions stored in Postgres |

## Features

- **Auth** - register / login / logout, session restored on refresh, every non-auth route is protected.
- **Teams** - create, rename, delete; add and remove members; members can leave.
- **Tasks** - create, edit, delete; status (To do / In progress / Done), priority, due date, assignee.
- **Search and filter** - by team, assignee (including "me" and "unassigned"), status, priority and free text.
- **Responsive UI** - sidebar collapses on mobile; modals for task / team / member forms.
- **Bonus features (all three implemented)**
  - *Due date reminders* - a banner after login lists your overdue and soon-due tasks.
  - *Role-based access* - only a team's owner can rename/delete the team or manage members; only the task creator or team owner can delete a task.
  - *Email invites (stubbed)* - inviting an unregistered email stores a pending invite and logs the "email" to the console; the person joins the team automatically when they register with that email.

## Project structure

```
team-task-manager/
├── server/                 Express API
│   ├── src/
│   │   ├── app.js          App wiring: security middleware, sessions, routes
│   │   ├── index.js        Entry point (migrates DB, starts server)
│   │   ├── config/         Environment configuration
│   │   ├── db/             Pool, schema.sql, migration runner
│   │   ├── auth/           Passport strategy
│   │   ├── middleware/     requireAuth, team access (owner/member), validate, errors
│   │   ├── routes/         auth.js, teams.js, tasks.js
│   │   ├── services/       Invite stub
│   │   └── validators/     Joi schemas (also sanitize input)
│   └── tests/              Integration tests (real Express app + real PostgreSQL)
└── client/                 React app
    └── src/
        ├── api/            fetch wrapper (cookies, 401 handling)
        ├── context/        Auth and toast providers
        ├── pages/          AuthPage (login/register), Dashboard
        ├── components/     Team list, task board/cards/filters, modals, ui kit
        └── utils, hooks/   Helpers
```

## Getting started

**Prerequisites:** Node 20+, PostgreSQL 14+.

```bash
# 1. Create a database
createdb taskmanager

# 2. Configure the API
cp server/.env.example server/.env      # then edit DATABASE_URL and SESSION_SECRET

# 3. Install everything and run (API on :4000, web on :5173)
npm run install:all
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the API, so the session cookie is same-origin and no CORS setup is needed.

Tables (including the `user_sessions` table) are created automatically on boot. To run migrations by hand: `npm run migrate --prefix server`.

No PostgreSQL for a quick look? Set `SESSION_STORE=memory` in `server/.env` to keep *sessions* in memory (development only) - note the app data itself still needs PostgreSQL.

### Environment variables (`server/.env`)

| Variable          | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string                                         |
| `SESSION_SECRET`  | Long random string; **required** in production                       |
| `SESSION_STORE`   | `memory` = in-memory sessions (dev only). Default: PostgreSQL        |
| `DB_SSL`          | `true` for Cloud SQL over public IP                                  |
| `COOKIE_SECURE`   | Defaults to `true` in production                                     |
| `CLIENT_ORIGIN`   | Only needed if the client is served from a different origin          |
| `BCRYPT_ROUNDS`   | Hash cost (default 12)                                               |

## API overview

All routes are prefixed with `/api`. Everything except `/auth/register`, `/auth/login` and `/health` needs a logged-in session (otherwise `401`).

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/auth/register` | Create account and log in |
| POST | `/auth/login` | Log in |
| POST | `/auth/logout` | Log out and destroy the session |
| GET | `/auth/me` | Current user |
| GET / POST | `/teams` | List my teams / create a team (creator becomes owner) |
| GET / PUT / DELETE | `/teams/:id` | Team details with members / update (owner) / delete (owner) |
| POST | `/teams/:id/members` | Add an existing user by email (owner) |
| DELETE | `/teams/:id/members/:userId` | Remove a member (owner) or leave (self) |
| POST / DELETE | `/teams/:id/invites[/:inviteId]` | Stubbed email invites (owner) |
| GET | `/tasks` | List tasks. Query: `teamId`, `assigneeId` (`me`/`unassigned`/id), `status`, `priority`, `q`, `sort` |
| GET | `/tasks/reminders` | My overdue / soon-due unfinished tasks |
| POST | `/tasks` | Create a task in a team I belong to |
| GET / PUT / PATCH / DELETE | `/tasks/:id` | Read / update / delete (creator or team owner) |

Errors are JSON: `{ "error": "message", "details": [{ "field", "message" }] }`.

## Security practices

- Passwords hashed with **bcrypt** (never stored or logged in plain text); login compares against a dummy hash for unknown emails so timing does not reveal which accounts exist.
- **Session cookie** is `HttpOnly`, `SameSite=Lax`, and `Secure` in production; sessions are regenerated on login and destroyed on logout.
- **Auth middleware** guards `/teams` and `/tasks`; **team access middleware** checks membership/ownership. Non-members get `404`, so team ids cannot be probed.
- **Validation and sanitization** with Joi on every body, query and param: unknown fields are stripped, types and lengths enforced, HTML is removed from text fields.
- Parameterised SQL only (no string-built queries); `LIKE` wildcards in search are escaped.
- `helmet` headers, JSON body size limit, and rate limiting on login/register.

## Testing

```bash
# Server: integration tests - uses a REAL database and EMPTIES its tables, so use a separate one
createdb taskmanager_test
NODE_ENV=test DATABASE_URL=postgres://user:pass@localhost:5432/taskmanager_test npm test

# Client: component and unit tests
npm test --prefix client
```

## Deploying on Google Cloud

1. **Database** - create a Cloud SQL for PostgreSQL instance and a database/user.
2. **Build** - `docker build -t task-manager .` (the Dockerfile builds the React app and serves it from Express, so one container serves the UI and API).
3. **Run** - deploy to Cloud Run, attach the Cloud SQL instance, and set:
   - `DATABASE_URL=postgres://USER:PASSWORD@/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE`
   - `SESSION_SECRET=<openssl rand -hex 32>` (use Secret Manager)
   - `NODE_ENV=production`

## Git workflow

Work was done on short-lived feature branches (`feature/*`) and merged into `main` through pull requests - see the commit and merge history.

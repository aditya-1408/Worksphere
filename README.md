# WorkSphere Goal Setting & Tracking Portal

WorkSphere is an in-house web portal for employee goal creation, L1 manager approval, quarterly achievement tracking, admin governance, reports, audit logs, and shared departmental KPIs.

## Live Demo Readiness

The app runs as a real database-backed Next.js portal on Vercel with Neon PostgreSQL, Prisma, password-based signup/login, signed HTTP-only sessions, role-scoped dashboards, and server-side API protection.

## Accounts

Create accounts from the Sign up tab. Managers and Admin/HR can sign up directly. Employees can sign up with an existing manager email to attach themselves to that L1 manager's team.

## Implemented Features

- Employee dashboard.
- Employee goal sheet creation and editing.
- BRD validations:
  - Total weightage must equal 100%.
  - Minimum individual goal weightage is 10%.
  - Maximum 8 goals per employee.
- Goal submission workflow.
- Admin-controlled cycle phase enforcement for Goal Setting and quarterly check-in windows.
- Manager L1 dashboard.
- Manager inline edit of target and weightage.
- Manager approve and lock flow.
- Manager return-for-rework flow.
- Quarterly achievement updates.
- Progress score formulas for Numeric, Percentage, Timeline, and Zero-based goals.
- Manager check-in comments.
- Admin users, hierarchy, and cycle window view.
- Admin unlock exception flow.
- Completion dashboard.
- CSV achievement report export.
- Audit trail.
- Shared departmental KPI push to team.
- Shared goal recipient restriction: title, target, UoM, and deadline are read-only; weightage remains editable.
- Shared goal primary owner achievement sync.
- Analytics bonus module:
  - QoQ achievement trend.
  - Individual, team, and department drilldowns.
  - Completion heatmap.
  - Goal distribution by thrust area, UoM type, and status.
  - Manager effectiveness dashboard.
- Rule-based escalation bonus module:
  - Configurable N-day rules for employee submission, manager approval, and quarterly check-ins.
  - Auto-notification chain display from employee to manager to skip-level / HR.
  - Admin-visible escalation log with owner, level, trigger age, and resolution action.
- Optional Email and Microsoft Teams notification integration:
  - Resend email helper for submission, approval, return, check-in, phase change, and reminders.
  - Teams Adaptive Card webhook helper with Open in WorkSphere deep links.
  - Weekly Vercel Cron reminder endpoint for pending quarterly updates and manager check-ins.

## Tech Stack

- Next.js 16
- TypeScript
- React
- Tailwind CSS
- lucide-react icons
- PostgreSQL via Neon
- Prisma ORM
- Signed HTTP-only session cookie auth

## Local Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
npm run lint
npm run build
```

Both commands pass in the current workspace.

## Demo Script

1. Sign up as Admin/HR.
   - Open Users & Cycles.
   - Set active phase to Goal Setting.
2. Sign up as Manager.
   - Use the same department you want employees to join.
3. Sign up as Employee.
   - Enter the manager email during signup.
   - Open Goals, create goals, verify validation, and submit.
4. Log in as Manager.
   - Open Approvals.
   - Review the employee sheet, edit target or weightage inline, return for rework or approve and lock.
5. Log in as Admin/HR.
   - Move the active phase to Q1 Check-in.
6. Log in as Employee.
   - Open Quarterly Update.
   - Enter Q1 actual achievement and status.
7. Log in as Manager.
   - Open Check-ins.
   - Review planned vs actual and add a structured check-in comment.
8. Open Shared Goals as Manager or Admin/HR.
   - Push departmental KPI.
   - Confirm recipients can edit only weightage.
9. Log in as Admin/HR.
   - Open Reports and export CSV.
   - Open Audit Trail.

## Bonus Demo Path

Open `Admin / HR -> Reports`.

- Use `QoQ Achievement Trend` and `QoQ Drilldown` to show progress at organization, individual, team, and department levels.
- Use `Completion Heatmap` to show goal-sheet and quarterly completion health.
- Use `Goal Distribution` to show breakdowns by thrust area, UoM, and status.
- Use `Manager Effectiveness` to compare check-in completion across L1 managers.
- Use `Rule-Based Escalation Log` to configure N-day rules and show the escalation chain from employee to manager to skip-level / HR.

## Deployment: Vercel

1. Push this folder to GitHub.
2. Go to Vercel and import the GitHub repository.
3. Framework preset: Next.js.
4. Build command: `npm run build`.
5. Output directory: leave default.
6. Environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `NEXTAUTH_SECRET` if you also want a NextAuth-compatible secret name
   - `NEXTAUTH_URL`
   - `APP_BASE_URL`
   - `RESEND_API_KEY` for real email notifications
   - `EMAIL_FROM` using a Resend-verified sender/domain
   - `TEAMS_WEBHOOK_URL` for Teams Workflow/webhook notifications
   - `CRON_SECRET` for securing reminder cron calls
7. Deploy.

## Optional Email and Teams Setup

The app works without these values. Missing notification variables are treated as skipped sends, not app errors.

You provide:

- Resend account and API key.
- A verified Resend sender/domain for `EMAIL_FROM`.
- Teams Workflow/webhook URL for `TEAMS_WEBHOOK_URL`.
- `APP_BASE_URL`, usually the Vercel URL.
- `CRON_SECRET`, a long random string.

Implemented notification events:

- Goal submitted -> manager email/card.
- Goal achievement updated -> manager email/card.
- Goal approved -> employee email/card.
- Goal returned -> employee email/card.
- Check-in completed -> employee and manager email/card.
- Cycle phase changed -> all users email/card.
- Weekly check-in reminders -> employee and manager email/card.
For no-domain Resend demos, create the manager account using your Resend account Gmail. Employees who sign up with that manager email will route submission and achievement-update emails to that manager inbox.

## Future Enterprise Upgrade Path

- Replace open signup with HR/admin-provisioned invitations or Microsoft Entra ID SSO.
- Map manager hierarchy from Entra profile attributes or HRMS data.
- Add real email or Microsoft Teams notifications using Microsoft Graph.

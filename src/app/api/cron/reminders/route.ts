import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { atomQuestLink, sendNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CronUser = {
  id: string;
  name: string;
  email: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  managerId: string | null;
};

type CronGoal = {
  id: string;
  employeeId: string;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
  updatedAt: Date;
};

type EscalationRule = {
  employeeSubmissionDays: number;
  managerApprovalDays: number;
  quarterlyCheckInDays: number;
  managerNotifyAfterDays: number;
  hrNotifyAfterDays: number;
};

type EscalationNotification = {
  id: string;
  employee: CronUser;
  manager?: CronUser;
  admins: CronUser[];
  type: string;
  level: number;
  owner: string;
  message: string;
  deepLink: string;
  recipients: string[];
  chain: string[];
  ageDays: number;
  dueAfterDays: number;
};

const phaseToQuarter = {
  Q1_CHECK_IN: "Q1",
  Q2_CHECK_IN: "Q2",
  Q3_CHECK_IN: "Q3",
  Q4_ANNUAL: "Q4",
} as const;

const phaseLabels = {
  GOAL_SETTING: "Goal Setting",
  Q1_CHECK_IN: "Q1 Check-in",
  Q2_CHECK_IN: "Q2 Check-in",
  Q3_CHECK_IN: "Q3 Check-in",
  Q4_ANNUAL: "Q4 / Annual",
  CLOSED: "Closed",
} as const;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function escalationRule(): EscalationRule {
  return {
    employeeSubmissionDays: envNumber("ESCALATION_EMPLOYEE_SUBMISSION_DAYS", 0),
    managerApprovalDays: envNumber("ESCALATION_MANAGER_APPROVAL_DAYS", 0),
    quarterlyCheckInDays: envNumber("ESCALATION_QUARTERLY_CHECKIN_DAYS", 0),
    managerNotifyAfterDays: envNumber("ESCALATION_NOTIFY_MANAGER_AFTER_DAYS", 2),
    hrNotifyAfterDays: envNumber("ESCALATION_NOTIFY_HR_AFTER_DAYS", 5),
  };
}

function isEscalationRule(value: unknown): value is EscalationRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<Record<keyof EscalationRule, unknown>>;
  return (
    typeof rule.employeeSubmissionDays === "number" &&
    typeof rule.managerApprovalDays === "number" &&
    typeof rule.quarterlyCheckInDays === "number" &&
    typeof rule.managerNotifyAfterDays === "number" &&
    typeof rule.hrNotifyAfterDays === "number"
  );
}

async function latestLockedRule() {
  const latest = await prisma.auditLog.findFirst({
    where: { action: "Escalation rules locked" },
    orderBy: { createdAt: "desc" },
    select: { afterJson: true },
  });

  const value = latest?.afterJson;
  if (isEscalationRule(value)) return value;
  return escalationRule();
}

function daysSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function recipientsForLevel(employee: CronUser, manager: CronUser | undefined, admins: CronUser[], ageDays: number, rule: EscalationRule) {
  const recipients = [employee.email];
  const chain = [`Employee: ${employee.name}`];
  let level = 1;
  let owner = employee.name;

  if (ageDays >= rule.managerNotifyAfterDays) {
    if (manager?.email) recipients.push(manager.email);
    chain.push(`Manager: ${manager?.name ?? "Unassigned manager"}`);
    level = 2;
    owner = manager?.name ?? "Unassigned manager";
  }

  if (ageDays >= rule.hrNotifyAfterDays) {
    recipients.push(...admins.map((admin) => admin.email));
    chain.push("Skip-level / HR");
    level = 3;
    owner = "Admin / HR";
  }

  return {
    recipients: [...new Set(recipients.filter(Boolean))],
    chain,
    level,
    owner,
  };
}

function emailTemplate(item: EscalationNotification) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">WorkSphere Escalation</h2>
      <h3 style="margin:0 0 12px">${item.type}</h3>
      <p>${item.message}</p>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc">
        <p><strong>Employee:</strong> ${item.employee.name}</p>
        <p><strong>Manager:</strong> ${item.manager?.name ?? "Unassigned"}</p>
        <p><strong>Escalation level:</strong> ${item.level}</p>
        <p><strong>Current owner:</strong> ${item.owner}</p>
        <p><strong>Rule trigger:</strong> ${item.ageDays} day(s) old / N=${item.dueAfterDays}</p>
        <p><strong>Auto-notification chain:</strong> ${item.chain.join(" -> ")}</p>
      </div>
      <p style="margin-top:20px">
        <a href="${item.deepLink}" style="background:#2563eb;color:white;padding:10px 14px;border-radius:6px;text-decoration:none;font-weight:700">
          Open in WorkSphere
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:20px">
        This escalation was generated automatically from the active cycle rules.
      </p>
    </div>
  `;
}

function latestSubmittedDate(goals: CronGoal[]) {
  return goals.reduce<Date | null>((latest, goal) => {
    if (goal.status !== "SUBMITTED") return latest;
    return !latest || goal.updatedAt > latest ? goal.updatedAt : latest;
  }, null);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  return runEscalationNotifications(await latestLockedRule());
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin / HR can run escalation notifications." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<EscalationRule>;
  const rule: EscalationRule = {
    employeeSubmissionDays: sanitizeRuleNumber(body.employeeSubmissionDays, 0),
    managerApprovalDays: sanitizeRuleNumber(body.managerApprovalDays, 0),
    quarterlyCheckInDays: sanitizeRuleNumber(body.quarterlyCheckInDays, 0),
    managerNotifyAfterDays: sanitizeRuleNumber(body.managerNotifyAfterDays, 0),
    hrNotifyAfterDays: sanitizeRuleNumber(body.hrNotifyAfterDays, 0),
  };

  await prisma.auditLog.create({
    data: {
      actorId: sessionUser.id,
      entityType: "EscalationRule",
      entityId: "active-cycle",
      action: "Escalation rules locked",
      afterJson: rule,
    },
  });

  return runEscalationNotifications(rule, sessionUser.id);
}

function sanitizeRuleNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function runEscalationNotifications(rule: EscalationRule, actorId?: string) {
  const cycle = await prisma.cycle.findFirst({ orderBy: { createdAt: "asc" } });
  if (!cycle || cycle.phase === "CLOSED") {
    return NextResponse.json({ ok: true, sent: 0, reason: "No active escalation phase." });
  }

  const [users, goals, updates, checkIns] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, managerId: true } }),
    prisma.goal.findMany({
      where: { cycleId: cycle.id },
      select: { id: true, employeeId: true, title: true, status: true, updatedAt: true },
    }),
    prisma.quarterlyUpdate.findMany({ select: { goalId: true, quarter: true } }),
    prisma.checkIn.findMany({ where: { cycleId: cycle.id }, select: { employeeId: true, quarter: true } }),
  ]);

  const typedUsers = users as CronUser[];
  const typedGoals = goals as CronGoal[];
  const employees = typedUsers.filter((user) => user.role === "EMPLOYEE");
  const admins = typedUsers.filter((user) => user.role === "ADMIN");
  const notifications: EscalationNotification[] = [];

  for (const employee of employees) {
    const manager = typedUsers.find((user) => user.id === employee.managerId);
    const employeeGoals = typedGoals.filter((goal) => goal.employeeId === employee.id);

    if (cycle.phase === "GOAL_SETTING") {
      const submittedGoals = employeeGoals.filter((goal) => goal.status === "SUBMITTED");
      const hasApprovedGoals = employeeGoals.some((goal) => goal.status === "APPROVED");

      if (!submittedGoals.length && !hasApprovedGoals) {
        const ageDays = daysSince(cycle.goalSettingOpenDate);
        if (ageDays >= rule.employeeSubmissionDays) {
          const chain = recipientsForLevel(employee, manager, admins, ageDays, rule);
          notifications.push({
            id: `${employee.id}-goal-submission`,
            employee,
            manager,
            admins,
            type: "Employee goal submission overdue",
            level: chain.level,
            owner: chain.owner,
            message: `${employee.name} has not submitted a complete goal sheet within ${rule.employeeSubmissionDays} day(s) of the cycle opening.`,
            deepLink: atomQuestLink("/", { view: "Goals", employeeId: employee.id }),
            recipients: chain.recipients,
            chain: chain.chain,
            ageDays,
            dueAfterDays: rule.employeeSubmissionDays,
          });
        }
      }

      if (submittedGoals.length > 0) {
        const submittedDate = latestSubmittedDate(submittedGoals) ?? cycle.goalSettingOpenDate;
        const ageDays = daysSince(submittedDate);
        if (ageDays >= rule.managerApprovalDays) {
          const chain = recipientsForLevel(employee, manager, admins, ageDays, rule);
          notifications.push({
            id: `${employee.id}-manager-approval`,
            employee,
            manager,
            admins,
            type: "Manager goal approval overdue",
            level: chain.level,
            owner: chain.owner,
            message: `${employee.name}'s submitted goal sheet is still waiting for L1 approval after ${rule.managerApprovalDays} day(s).`,
            deepLink: atomQuestLink("/", { view: "Approvals", employeeId: employee.id }),
            recipients: chain.recipients,
            chain: chain.chain,
            ageDays,
            dueAfterDays: rule.managerApprovalDays,
          });
        }
      }
    }

    const activeQuarter = phaseToQuarter[cycle.phase as keyof typeof phaseToQuarter];
    if (activeQuarter) {
      const quarterOpenDate =
        activeQuarter === "Q1"
          ? cycle.q1OpenDate
          : activeQuarter === "Q2"
            ? cycle.q2OpenDate
            : activeQuarter === "Q3"
              ? cycle.q3OpenDate
              : cycle.q4OpenDate;
      const ageDays = daysSince(quarterOpenDate);
      const approvedGoals = employeeGoals.filter((goal) => goal.status === "APPROVED");
      const hasMissingUpdate = approvedGoals.some(
        (goal) => !updates.some((update) => update.goalId === goal.id && update.quarter === activeQuarter),
      );
      const hasCheckIn = checkIns.some(
        (checkIn) => checkIn.employeeId === employee.id && checkIn.quarter === activeQuarter,
      );

      if (approvedGoals.length > 0 && ageDays >= rule.quarterlyCheckInDays && (hasMissingUpdate || !hasCheckIn)) {
        const chain = recipientsForLevel(employee, manager, admins, ageDays, rule);
        notifications.push({
          id: `${employee.id}-${activeQuarter}-checkin`,
          employee,
          manager,
          admins,
          type: `${activeQuarter} check-in overdue`,
          level: chain.level,
          owner: chain.owner,
          message: hasMissingUpdate
            ? `${employee.name} has not completed all ${activeQuarter} achievement updates in the active check-in window.`
            : `${employee.name}'s ${activeQuarter} achievement updates are complete, but the manager check-in is pending.`,
          deepLink: atomQuestLink("/", {
            view: hasMissingUpdate ? "Quarterly Update" : "Check-ins",
            employeeId: employee.id,
          }),
          recipients: chain.recipients,
          chain: chain.chain,
          ageDays,
          dueAfterDays: rule.quarterlyCheckInDays,
        });
      }
    }
  }

  let sent = 0;
  for (const item of notifications) {
    const title = `Escalation: ${item.type}`;
    const result = await sendNotification({
      title,
      message: item.message,
      deepLink: item.deepLink,
      email: {
        to: item.recipients,
        subject: title,
        html: emailTemplate(item),
      },
    });

    await prisma.escalationLog.create({
      data: {
        userId: item.employee.id,
        type: item.type,
        level: item.level,
        message: item.message,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? item.manager?.id ?? item.admins[0]?.id ?? item.employee.id,
        entityType: "Escalation",
        entityId: item.employee.id,
        action: `Escalation notification ${item.type}`,
        afterJson: {
          phase: phaseLabels[cycle.phase as keyof typeof phaseLabels],
          employee: item.employee.email,
          manager: item.manager?.email ?? null,
          recipients: item.recipients,
          chain: item.chain,
          level: item.level,
          owner: item.owner,
          ageDays: item.ageDays,
          dueAfterDays: item.dueAfterDays,
          deepLink: item.deepLink,
          email: result.email,
          teams: result.teams,
          errors: result.errors,
        },
      },
    });

    if (result.email === "sent" || result.teams === "sent") sent += 1;
  }

  return NextResponse.json({
    ok: true,
    sent,
    generated: notifications.length,
    phase: phaseLabels[cycle.phase as keyof typeof phaseLabels],
    rules: rule,
  });
}

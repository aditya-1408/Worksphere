import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { atomQuestLink, sendNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type NotificationEvent =
  | "GOAL_SUBMITTED"
  | "GOAL_UPDATED"
  | "GOAL_APPROVED"
  | "GOAL_RETURNED"
  | "CHECK_IN_COMPLETED"
  | "CYCLE_PHASE_CHANGED";

type NotificationRequest = {
  event?: NotificationEvent;
  employeeId?: string;
  managerId?: string;
  phase?: string;
  comment?: string;
  goalSummary?: Array<{
    title: string;
    thrustArea: string;
    uomType: string;
    target: string;
    weightage: number;
  }>;
  updateSummary?: {
    title: string;
    thrustArea: string;
    target: string;
    actual: string;
    status: string;
    progressScore: number;
    quarter: string;
    comment?: string;
  };
};

function roleLabel(role: string) {
  return role === "ADMIN" ? "Admin / HR" : role === "MANAGER" ? "Manager" : "Employee";
}

function managerRecipients(managerEmail?: string) {
  return [managerEmail].filter(Boolean) as string[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function goalTable(goals?: NotificationRequest["goalSummary"]) {
  if (!goals?.length) return "";
  const rows = goals
    .map(
      (goal) => `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(goal.title)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(goal.thrustArea)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(goal.uomType)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(goal.target)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0">${goal.weightage}%</td>
        </tr>
      `,
    )
    .join("");
  return `
    <h3 style="margin-top:20px">Submitted Goals</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Goal</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Thrust Area</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">UoM</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Target</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Weightage</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updatePanel(update?: NotificationRequest["updateSummary"]) {
  if (!update) return "";
  return `
    <h3 style="margin-top:20px">Latest Achievement Update</h3>
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#f8fafc">
      <p><strong>Goal:</strong> ${escapeHtml(update.title)}</p>
      <p><strong>Thrust Area:</strong> ${escapeHtml(update.thrustArea)}</p>
      <p><strong>Quarter:</strong> ${escapeHtml(update.quarter)}</p>
      <p><strong>Target:</strong> ${escapeHtml(update.target)}</p>
      <p><strong>Actual:</strong> ${escapeHtml(update.actual)}</p>
      <p><strong>Status:</strong> ${escapeHtml(update.status)}</p>
      <p><strong>Progress Score:</strong> ${update.progressScore}%</p>
      ${update.comment ? `<p><strong>Employee Comment:</strong> ${escapeHtml(update.comment)}</p>` : ""}
    </div>
  `;
}

function emailTemplate(title: string, message: string, deepLink: string, detailsHtml = "") {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">WorkSphere Goal Portal</h2>
      <h3 style="margin:0 0 12px">${title}</h3>
      <p>${message}</p>
      ${detailsHtml}
      <p style="margin-top:20px">
        <a href="${deepLink}" style="background:#2563eb;color:white;padding:10px 14px;border-radius:6px;text-decoration:none;font-weight:700">
          Open in WorkSphere
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:20px">
        This notification was generated automatically by the WorkSphere Goal Setting & Tracking Portal.
      </p>
    </div>
  `;
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as NotificationRequest;
  if (!body.event) {
    return NextResponse.json({ error: "Notification event is required." }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, managerId: true },
  });
  const employee = users.find((user) => user.id === body.employeeId);
  const manager =
    users.find((user) => user.id === body.managerId) ??
    users.find((user) => user.id === employee?.managerId);
  const admins = users.filter((user) => user.role === "ADMIN");

  let title = "WorkSphere Notification";
  let message = "A goal workflow event needs attention.";
  let recipients: string[] = [];
  let deepLink = atomQuestLink("/", { view: "Dashboard" });
  let detailsHtml = "";

  if (body.event === "GOAL_SUBMITTED" && employee && manager) {
    title = "New goal sheet submitted";
    message = `${employee.name} submitted a goal sheet for L1 review. Please review the planned targets, weightage, and approve or return for rework.`;
    recipients = managerRecipients(manager.email);
    deepLink = atomQuestLink("/", { view: "Approvals", employeeId: employee.id });
    detailsHtml = goalTable(body.goalSummary);
  }

  if (body.event === "GOAL_UPDATED" && employee && manager) {
    title = "Goal achievement updated";
    message = `${employee.name} updated quarterly goal achievement progress. Please review planned versus actual performance and complete the manager check-in.`;
    recipients = managerRecipients(manager.email);
    deepLink = atomQuestLink("/", { view: "Check-ins", employeeId: employee.id });
    detailsHtml = updatePanel(body.updateSummary);
  }

  if (body.event === "GOAL_APPROVED" && employee) {
    title = "Goal sheet approved";
    message = `${employee.name}'s goal sheet was approved and locked.`;
    recipients = [employee.email];
    deepLink = atomQuestLink("/", { view: "Goals", employeeId: employee.id });
  }

  if (body.event === "GOAL_RETURNED" && employee) {
    title = "Goal sheet returned for rework";
    message = `${employee.name}'s goal sheet was returned for rework.${body.comment ? ` Comment: ${body.comment}` : ""}`;
    recipients = [employee.email];
    deepLink = atomQuestLink("/", { view: "Goals", employeeId: employee.id });
  }

  if (body.event === "CHECK_IN_COMPLETED" && employee && manager) {
    title = "Quarterly check-in completed";
    message = `${manager.name} completed a quarterly check-in for ${employee.name}.`;
    recipients = [employee.email, ...managerRecipients(manager.email)];
    deepLink = atomQuestLink("/", { view: "Check-ins", employeeId: employee.id });
  }

  if (body.event === "CYCLE_PHASE_CHANGED") {
    title = "Cycle phase changed";
    message = `${sessionUser.name} changed the active cycle phase to ${body.phase ?? "a new phase"}.`;
    recipients = users.map((user) => user.email);
    deepLink = atomQuestLink("/", { view: roleLabel(sessionUser.role) === "Admin / HR" ? "Users & Cycles" : "Dashboard" });
  }

  const result = await sendNotification({
    title,
    message,
    deepLink,
    email: {
      to: recipients,
      subject: title,
      html: emailTemplate(title, message, deepLink, detailsHtml),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: sessionUser.id,
      entityType: "Notification",
      entityId: body.employeeId ?? body.phase ?? body.event,
      action: `Notification ${body.event}`,
      afterJson: {
        email: result.email,
        teams: result.teams,
        recipients,
        deepLink,
        goalSummary: body.goalSummary,
        updateSummary: body.updateSummary,
        admins: admins.map((admin) => admin.email),
        errors: result.errors,
      },
    },
  });

  return NextResponse.json({ ok: true, result });
}

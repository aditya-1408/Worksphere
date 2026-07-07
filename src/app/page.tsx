"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Unlock,
  Video,
  Calendar,
  Users,
  FileText,
  Clock,
  Monitor,
  Mic,
  MicOff,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";

// Dynamically import LiveKit components (client-side only)
const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.LiveKitRoom),
  { ssr: false }
);
const GridLayout = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.GridLayout),
  { ssr: false }
);
const ParticipantTile = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.ParticipantTile),
  { ssr: false }
);
const ControlBar = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.ControlBar),
  { ssr: false }
);
const RoomAudioRenderer = dynamic(
  () => import("@livekit/components-react").then((mod) => mod.RoomAudioRenderer),
  { ssr: false }
);

type Role = "Employee" | "Manager" | "Admin";
type UomType = "Numeric" | "Percentage" | "Timeline" | "Zero";
type Direction = "Min" | "Max";
type GoalStatus = "Draft" | "Submitted" | "Approved" | "Returned";
type GoalTab = "Current" | "Returned" | "Completed" | "Shared KPI";
type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
type ProgressStatus = "Not Started" | "On Track" | "Completed";
type MeetingStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
type ParticipantStatus = "INVITED" | "JOINED" | "LEFT" | "DECLINED";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  managerId?: string;
};

type Goal = {
  id: string;
  employeeId: string;
  thrustArea: string;
  title: string;
  description: string;
  uomType: UomType;
  direction: Direction;
  targetValue: number;
  targetDate: string;
  weightage: number;
  status: GoalStatus;
  locked: boolean;
  sharedGoalId?: string;
  primaryOwner?: boolean;
};

type Update = {
  id: string;
  goalId: string;
  quarter: Quarter;
  actualValue: number;
  actualDate: string;
  status: ProgressStatus;
  employeeComment: string;
  progressScore: number;
};

type CheckIn = {
  id: string;
  employeeId: string;
  managerId: string;
  quarter: Quarter;
  comment: string;
  completedAt: string;
};

type SharedGoal = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  thrustArea: string;
  uomType: UomType;
  direction: Direction;
  targetValue: number;
  targetDate: string;
};

type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  before?: string;
  after?: string;
  createdAt: string;
};

type MeetingParticipant = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: ParticipantStatus;
  joinedAt: string | null;
  leftAt: string | null;
};

type MeetingDocument = {
  id: string;
  title: string;
  fileUrl: string;
  status: string;
  createdAt: string;
};

type MeetingMessage = {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
};

type Meeting = {
  id: string;
  title: string;
  agenda: string | null;
  department: string;
  hostId: string;
  hostName: string;
  status: MeetingStatus;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  livekitRoomName: string | null;
  participantCount: number;
  participants: MeetingParticipant[];
  documents: MeetingDocument[];
  summaryStatus: string;
  transcriptStatus: string;
};

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
};

type Escalation = {
  id: string;
  level: number;
  owner: string;
  type: string;
  message: string;
  nextAction: string;
  ageDays: number;
  dueAfterDays: number;
  chainStage: string;
  notifications: string[];
};

type EscalationConfig = {
  employeeSubmissionDays: number;
  managerApprovalDays: number;
  quarterlyCheckInDays: number;
  managerNotifyAfterDays: number;
  hrNotifyAfterDays: number;
};

type SharedGoalDraft = {
  title: string;
  description: string;
  thrustArea: string;
  uomType: UomType;
  direction: Direction;
  targetValue: number;
  targetDate: string;
  weightage: number;
  recipientIds: string[];
};

type AppState = {
  users: User[];
  goals: Goal[];
  updates: Update[];
  checkIns: CheckIn[];
  sharedGoals: SharedGoal[];
  auditLogs: AuditLog[];
  cycle: {
    name: string;
    phase: string;
    windows: Record<string, string>;
  };
};

const quarters: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const statuses: ProgressStatus[] = ["Not Started", "On Track", "Completed"];
const palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];
const cyclePhases = ["Goal Setting", "Q1 Check-in", "Q2 Check-in", "Q3 Check-in", "Q4 / Annual", "Closed"];
const defaultEscalationConfig: EscalationConfig = {
  employeeSubmissionDays: 0,
  managerApprovalDays: 0,
  quarterlyCheckInDays: 0,
  managerNotifyAfterDays: 2,
  hrNotifyAfterDays: 5,
};
const cycleOpenDate = "2026-05-01";
const quarterOpenDates: Record<Quarter, string> = {
  Q1: "2026-07-01",
  Q2: "2026-10-01",
  Q3: "2027-01-01",
  Q4: "2027-03-01",
};

function initialQueryParam(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

const emptyGoal = (employeeId: string): Goal => ({
  id: crypto.randomUUID(),
  employeeId,
  thrustArea: "Business Growth",
  title: "",
  description: "",
  uomType: "Numeric",
  direction: "Min",
  targetValue: 100,
  targetDate: "2026-07-31",
  weightage: 10,
  status: "Draft",
  locked: false,
});

const seedState = (): AppState => {
  const users: User[] = [
    {
      id: "u-admin",
      name: "Ananya HR",
      email: "admin@worksphere.demo",
      role: "Admin",
      department: "People Success",
    },
    {
      id: "u-manager",
      name: "Rohan Mehta",
      email: "manager@worksphere.demo",
      role: "Manager",
      department: "Operations",
    },
    {
      id: "u-employee",
      name: "Priya Shah",
      email: "employee@worksphere.demo",
      role: "Employee",
      department: "Operations",
      managerId: "u-manager",
    },
    {
      id: "u-employee-2",
      name: "Karan Iyer",
      email: "employee2@worksphere.demo",
      role: "Employee",
      department: "Operations",
      managerId: "u-manager",
    },
  ];

  const goals: Goal[] = [
    {
      id: "g-1",
      employeeId: "u-employee",
      thrustArea: "Business Growth",
      title: "Improve service closure rate",
      description: "Increase first-time-right closures for assigned service tickets.",
      uomType: "Percentage",
      direction: "Min",
      targetValue: 92,
      targetDate: "2026-07-31",
      weightage: 35,
      status: "Approved",
      locked: true,
    },
    {
      id: "g-2",
      employeeId: "u-employee",
      thrustArea: "Customer Experience",
      title: "Reduce customer escalation TAT",
      description: "Lower average closure time for escalated requests.",
      uomType: "Numeric",
      direction: "Max",
      targetValue: 24,
      targetDate: "2026-07-31",
      weightage: 25,
      status: "Approved",
      locked: true,
    },
    {
      id: "g-3",
      employeeId: "u-employee",
      thrustArea: "Quality",
      title: "Maintain zero safety incidents",
      description: "Ensure process discipline and report unsafe conditions.",
      uomType: "Zero",
      direction: "Max",
      targetValue: 0,
      targetDate: "2026-07-31",
      weightage: 30,
      status: "Approved",
      locked: true,
    },
    {
      id: "g-4",
      employeeId: "u-employee-2",
      thrustArea: "Business Growth",
      title: "Launch dealer onboarding tracker",
      description: "Create and roll out a tracker for top-priority dealer onboarding.",
      uomType: "Timeline",
      direction: "Min",
      targetValue: 100,
      targetDate: "2026-07-31",
      weightage: 50,
      status: "Submitted",
      locked: false,
    },
    {
      id: "g-5",
      employeeId: "u-employee-2",
      thrustArea: "Customer Experience",
      title: "Improve monthly NPS follow-up coverage",
      description: "Call back detractors and close feedback loops within defined time.",
      uomType: "Percentage",
      direction: "Min",
      targetValue: 95,
      targetDate: "2026-07-31",
      weightage: 40,
      status: "Submitted",
      locked: false,
    },
    {
      id: "g-shared-1-primary",
      employeeId: "u-employee",
      thrustArea: "Department KPI",
      title: "Department service SLA compliance",
      description: "Maintain SLA adherence across assigned operational queues.",
      uomType: "Percentage",
      direction: "Min",
      targetValue: 95,
      targetDate: "2026-07-31",
      weightage: 10,
      status: "Approved",
      locked: true,
      sharedGoalId: "sg-1",
      primaryOwner: true,
    },
    {
      id: "g-shared-1-recipient",
      employeeId: "u-employee-2",
      thrustArea: "Department KPI",
      title: "Department service SLA compliance",
      description: "Maintain SLA adherence across assigned operational queues.",
      uomType: "Percentage",
      direction: "Min",
      targetValue: 95,
      targetDate: "2026-07-31",
      weightage: 10,
      status: "Submitted",
      locked: false,
      sharedGoalId: "sg-1",
      primaryOwner: false,
    },
  ];

  return {
    users,
    goals,
    updates: [
      {
        id: "up-1",
        goalId: "g-1",
        quarter: "Q1",
        actualValue: 86,
        actualDate: "2026-07-20",
        status: "On Track",
        employeeComment: "Process adherence improved; two complex cases are pending.",
        progressScore: 93,
      },
      {
        id: "up-2",
        goalId: "g-2",
        quarter: "Q1",
        actualValue: 28,
        actualDate: "2026-07-22",
        status: "On Track",
        employeeComment: "Need faster closure from field team.",
        progressScore: 86,
      },
      {
        id: "up-shared-1-primary",
        goalId: "g-shared-1-primary",
        quarter: "Q1",
        actualValue: 91,
        actualDate: "2026-07-24",
        status: "On Track",
        employeeComment: "Shared SLA is improving across service queues.",
        progressScore: 96,
      },
      {
        id: "up-shared-1-recipient",
        goalId: "g-shared-1-recipient",
        quarter: "Q1",
        actualValue: 91,
        actualDate: "2026-07-24",
        status: "On Track",
        employeeComment: "Shared SLA is improving across service queues.",
        progressScore: 96,
      },
    ],
    checkIns: [
      {
        id: "ci-1",
        employeeId: "u-employee",
        managerId: "u-manager",
        quarter: "Q1",
        comment: "Good progress. Prioritize escalation aging in the next sprint.",
        completedAt: "2026-07-25",
      },
    ],
    sharedGoals: [
      {
        id: "sg-1",
        ownerId: "u-employee",
        thrustArea: "Department KPI",
        title: "Department service SLA compliance",
        description: "Maintain SLA adherence across assigned operational queues.",
        uomType: "Percentage",
        direction: "Min",
        targetValue: 95,
        targetDate: "2026-07-31",
      },
    ],
    auditLogs: [
      {
        id: "a-1",
        actor: "Rohan Mehta",
        action: "Approved and locked goal sheet",
        entity: "Priya Shah",
        createdAt: "2026-07-25T10:00:00.000Z",
      },
    ],
    cycle: {
      name: "FY 2026-27 Goal Cycle",
      phase: "Q1 Check-in",
      windows: {
        "Goal Setting": "Opens 1 May",
        "Q1 Check-in": "July",
        "Q2 Check-in": "October",
        "Q3 Check-in": "January",
        "Q4 / Annual": "March / April",
      },
    },
  };
};

function scoreGoal(goal: Goal, actualValue: number, actualDate: string) {
  if (goal.uomType === "Zero") return actualValue === 0 ? 100 : 0;
  if (goal.uomType === "Timeline") {
    return new Date(actualDate) <= new Date(goal.targetDate) ? 100 : 0;
  }
  if (goal.direction === "Max") {
    return roundedScore((goal.targetValue / actualValue) * 100);
  }
  return roundedScore((actualValue / goal.targetValue) * 100);
}

function roundedScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function barWidth(value: number) {
  return `${Math.min(Math.max(value, 0), 100)}%`;
}

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function statusTone(status: GoalStatus) {
  return {
    Draft: "status-draft",
    Submitted: "status-submitted",
    Approved: "status-approved",
    Returned: "status-returned",
  }[status];
}

function quarterForPhase(phase: string): Quarter | null {
  if (phase.startsWith("Q1")) return "Q1";
  if (phase.startsWith("Q2")) return "Q2";
  if (phase.startsWith("Q3")) return "Q3";
  if (phase.startsWith("Q4")) return "Q4";
  return null;
}

function daysSince(date: string) {
  const start = new Date(date);
  const today = new Date();
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

function auditDate(state: AppState, action: string, entity: string, fallback: string) {
  const log = state.auditLogs.find((item) => item.action === action && item.entity === entity);
  return log?.createdAt.slice(0, 10) ?? fallback;
}

function escalationChain(
  ageDays: number,
  config: EscalationConfig,
  employee: User,
  manager?: User,
) {
  const managerName = manager?.name ?? "Manager not assigned";
  const notifications = [`Employee: ${employee.name}`];
  let chainStage = "Employee";
  let level = 1;

  if (ageDays >= config.managerNotifyAfterDays) {
    notifications.push(`Manager: ${managerName}`);
    chainStage = "Manager";
    level = 2;
  }

  if (ageDays >= config.hrNotifyAfterDays) {
    notifications.push("Skip-level / HR");
    chainStage = "Skip-level / HR";
    level = 3;
  }

  return { chainStage, level, notifications };
}

function buildEscalations(state: AppState, config: EscalationConfig): Escalation[] {
  const activeQuarter = quarterForPhase(state.cycle.phase);
  const employees = state.users.filter((user) => user.role === "Employee");
  const escalations: Escalation[] = [];

  for (const employee of employees) {
    const manager = state.users.find((user) => user.id === employee.managerId);
    const goals = state.goals.filter((goal) => goal.employeeId === employee.id);
    const hasSubmittedGoals = goals.some((goal) => goal.status === "Submitted");
    const hasDraftGoals = goals.some((goal) => goal.status === "Draft" || goal.status === "Returned");
    const hasApprovedGoals = goals.some((goal) => goal.status === "Approved");

    if (state.cycle.phase === "Goal Setting") {
      if (hasSubmittedGoals) {
        const startDate = auditDate(state, "Submitted goal sheet", employee.name, cycleOpenDate);
        const ageDays = daysSince(startDate);
        if (ageDays < config.managerApprovalDays) continue;
        const chain = escalationChain(ageDays, config, employee, manager);
        escalations.push({
          id: `${employee.id}-approval`,
          level: chain.level,
          owner: chain.chainStage === "Employee" ? employee.name : chain.chainStage === "Manager" ? manager?.name ?? "Unassigned manager" : "Admin / HR",
          type: "Manager approval pending",
          message: `${employee.name}'s submitted goal sheet has been pending L1 approval for ${ageDays} day${ageDays === 1 ? "" : "s"}.`,
          nextAction: "Notify through escalation chain until Manager approves and locks or returns for rework.",
          ageDays,
          dueAfterDays: config.managerApprovalDays,
          chainStage: chain.chainStage,
          notifications: chain.notifications,
        });
      } else if (hasDraftGoals || goals.length === 0) {
        const ageDays = daysSince(cycleOpenDate);
        if (ageDays < config.employeeSubmissionDays) continue;
        const chain = escalationChain(ageDays, config, employee, manager);
        escalations.push({
          id: `${employee.id}-submission`,
          level: chain.level,
          owner: chain.chainStage === "Employee" ? employee.name : chain.chainStage === "Manager" ? manager?.name ?? "Unassigned manager" : "Admin / HR",
          type: "Employee submission pending",
          message: `${employee.name} has not submitted a complete goal sheet ${ageDays} day${ageDays === 1 ? "" : "s"} after cycle open.`,
          nextAction: "Notify through escalation chain until Employee submits goals with 100% total weightage.",
          ageDays,
          dueAfterDays: config.employeeSubmissionDays,
          chainStage: chain.chainStage,
          notifications: chain.notifications,
        });
      }
    }

    if (activeQuarter && hasApprovedGoals) {
      const ageDays = daysSince(quarterOpenDates[activeQuarter]);
      if (ageDays < config.quarterlyCheckInDays) continue;
      const chain = escalationChain(ageDays, config, employee, manager);
      const approvedGoals = goals.filter((goal) => goal.status === "Approved");
      const missingUpdates = approvedGoals.filter(
        (goal) => !state.updates.some((update) => update.goalId === goal.id && update.quarter === activeQuarter),
      );
      const checkInDone = state.checkIns.some(
        (checkIn) => checkIn.employeeId === employee.id && checkIn.quarter === activeQuarter,
      );

      if (missingUpdates.length > 0) {
        escalations.push({
          id: `${employee.id}-${activeQuarter}-updates`,
          level: chain.level,
          owner: chain.chainStage === "Employee" ? employee.name : chain.chainStage === "Manager" ? manager?.name ?? "Unassigned manager" : "Admin / HR",
          type: `${activeQuarter} achievement pending`,
          message: `${employee.name} has ${missingUpdates.length} approved goal update${missingUpdates.length === 1 ? "" : "s"} pending ${ageDays} day${ageDays === 1 ? "" : "s"} into the active ${activeQuarter} window.`,
          nextAction: "Notify through escalation chain until Employee enters actual achievement, status, and comment.",
          ageDays,
          dueAfterDays: config.quarterlyCheckInDays,
          chainStage: chain.chainStage,
          notifications: chain.notifications,
        });
      } else if (!checkInDone) {
        escalations.push({
          id: `${employee.id}-${activeQuarter}-checkin`,
          level: chain.level,
          owner: chain.chainStage === "Employee" ? employee.name : chain.chainStage === "Manager" ? manager?.name ?? "Unassigned manager" : "Admin / HR",
          type: `${activeQuarter} manager check-in pending`,
          message: `${employee.name}'s ${activeQuarter} achievements are updated, but the manager check-in is not completed ${ageDays} day${ageDays === 1 ? "" : "s"} into the active window.`,
          nextAction: "Notify through escalation chain until Manager records the structured check-in comment.",
          ageDays,
          dueAfterDays: config.quarterlyCheckInDays,
          chainStage: chain.chainStage,
          notifications: chain.notifications,
        });
      }
    }
  }

  return escalations;
}

export default function Home() {
  const [state, setState] = useState<AppState>(seedState);
  const [activeUserId, setActiveUserId] = useState("");
  const [view, setView] = useState(() => initialQueryParam("view") ?? "Dashboard");
  const [activeEmployeeId, setActiveEmployeeId] = useState(() => initialQueryParam("employeeId") ?? "u-employee");
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [hasLoadedDatabase, setHasLoadedDatabase] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [signupName, setSignupName] = useState("");
  const [signupRole, setSignupRole] = useState<Role>("Employee");
  const [signupDepartment, setSignupDepartment] = useState("Operations");
  const [signupManagerEmail, setSignupManagerEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(() => initialQueryParam("sso_error") ?? "");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [ssoConfigured, setSsoConfigured] = useState(false);
  
  // Meeting state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [meetingMessages, setMeetingMessages] = useState<MeetingMessage[]>([]);
  const [meetingChatInput, setMeetingChatInput] = useState("");
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingAgenda, setNewMeetingAgenda] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [meetingError, setMeetingError] = useState("");
  
  // LiveKit video state
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitWsUrl, setLivekitWsUrl] = useState<string | null>(null);
  const [livekitRoomName, setLivekitRoomName] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const loadDatabaseState = async (userId: string) => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load database state.");
    const databaseState = (await response.json()) as AppState;
    setState(databaseState);
    setActiveUserId(userId);
    setActiveEmployeeId(
      databaseState.users.find((user) => user.id === userId && user.role === "Employee")?.id ??
        databaseState.users.find((user) => user.role === "Employee")?.id ??
        "u-employee",
    );
    setHasLoadedDatabase(true);
    setLoadError("");
  };

  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (!sessionResponse.ok) {
          setHasLoadedDatabase(true);
          return;
        }
        const session = (await sessionResponse.json()) as { user?: User };
        if (!session.user) {
          setHasLoadedDatabase(true);
          return;
        }
        await loadDatabaseState(session.user.id);
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not restore session.");
        setHasLoadedDatabase(true);
      }
    }
    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/sso/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { configured: false }))
      .then((result: { configured?: boolean }) => setSsoConfigured(Boolean(result.configured)))
      .catch(() => setSsoConfigured(false));
  }, []);

  useEffect(() => {
    if (!hasLoadedDatabase || !activeUserId) return;
    const timer = window.setTimeout(async () => {
      try {
        setSaveStatus("saving");
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error("Could not save database state.");
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeUserId, hasLoadedDatabase, state]);

  const activeUser = state.users.find((user) => user.id === activeUserId);
  const employees = state.users.filter((user) => user.role === "Employee");
  const team = activeUser ? employees.filter((employee) => employee.managerId === activeUser.id) : [];
  const selectedEmployee =
    state.users.find((user) => user.id === activeEmployeeId) ??
    (activeUser?.role === "Manager" ? team[0] : employees[0]);
  const employeeGoals = selectedEmployee
    ? state.goals.filter((goal) => goal.employeeId === selectedEmployee.id)
    : [];
  const submittedEmployeeGoals = employeeGoals.filter((goal) => goal.status === "Submitted" && !goal.sharedGoalId);
  const ownGoals = activeUser ? state.goals.filter((goal) => goal.employeeId === activeUser.id) : [];
  const ownGoalGroups = {
    current: ownGoals.filter((goal) => !goal.sharedGoalId && (goal.status === "Draft" || goal.status === "Submitted")),
    returned: ownGoals.filter((goal) => !goal.sharedGoalId && goal.status === "Returned"),
    completed: ownGoals.filter((goal) => !goal.sharedGoalId && goal.status === "Approved"),
    shared: ownGoals.filter((goal) => Boolean(goal.sharedGoalId)),
  };

  const completeLogin = (userId: string) => {
    const user = state.users.find((candidate) => candidate.id === userId);
    if (!user) return;
    window.sessionStorage.setItem("worksphere-user-id", user.id);
    setActiveUserId(user.id);
    setView("Dashboard");
    if (user.role === "Employee") setActiveEmployeeId(user.id);
    if (user.role === "Manager") {
      const firstTeamMember = state.users.find(
        (candidate) => candidate.role === "Employee" && candidate.managerId === user.id,
      );
      if (firstTeamMember) setActiveEmployeeId(firstTeamMember.id);
    }
  };

  const login = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authMode === "login"
            ? { email: loginEmail.trim(), password: loginPassword }
            : {
                name: signupName.trim(),
                email: loginEmail.trim(),
                password: loginPassword,
                role: signupRole,
                department: signupDepartment.trim(),
                managerEmail: signupManagerEmail.trim(),
              },
        ),
      });
      const rawResult = await response.text();
      const result: { userId?: string; error?: string } = rawResult
        ? (JSON.parse(rawResult) as { userId?: string; error?: string })
        : { error: "The server returned an empty response." };
      if (!response.ok || !result.userId) throw new Error(result.error ?? "Authentication failed.");
      await loadDatabaseState(result.userId);
      completeLogin(result.userId);
      setLoginPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setActiveUserId("");
    setView("Dashboard");
    setLoginPassword("");
    setSaveStatus("idle");
  };

  const startMicrosoftSso = () => {
    window.location.href = "/api/auth/sso/login";
  };

  // Load meetings from API
  const loadMeetings = async () => {
    try {
      const response = await fetch("/api/meetings", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load meetings.");
      const data = (await response.json()) as { meetings: Meeting[] };
      setMeetings(data.meetings);
      
      // If there's an active meeting, reload its messages
      if (activeMeetingId) {
        await loadMeetingMessages(activeMeetingId);
      }
      
      setMeetingError("");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "Failed to load meetings.");
    }
  };

  // Load messages for a specific meeting
  const loadMeetingMessages = async (meetingId: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/messages`, { 
        cache: "no-store" 
      });
      if (!response.ok) throw new Error("Could not load messages.");
      const data = (await response.json()) as { messages: MeetingMessage[] };
      setMeetingMessages(data.messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  // Create new meeting
  const createMeeting = async () => {
    if (!newMeetingTitle.trim() || !newMeetingDate || selectedParticipantIds.length === 0) {
      setMeetingError("Please provide title, date, and at least one participant.");
      return;
    }
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newMeetingTitle.trim(),
          agenda: newMeetingAgenda.trim() || null,
          scheduledAt: new Date(newMeetingDate).toISOString(),
          participantIds: selectedParticipantIds,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Could not create meeting.");
      }
      await loadMeetings();
      setIsCreatingMeeting(false);
      setNewMeetingTitle("");
      setNewMeetingAgenda("");
      setNewMeetingDate("");
      setSelectedParticipantIds([]);
      setMeetingError("");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "Failed to create meeting.");
    }
  };

  // Meeting status actions
  const updateMeetingStatus = async (meetingId: string, action: "start" | "join" | "leave" | "end" | "cancel") => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(`Could not ${action} meeting.`);
      await loadMeetings();
      
      // If joining, get LiveKit token
      if (action === "join") {
        await loadLiveKitToken(meetingId);
      }
      
      // If leaving or ending, clear video
      if (action === "leave" || action === "end") {
        setLivekitToken(null);
        setLivekitWsUrl(null);
        setLivekitRoomName(null);
      }
      
      setMeetingError("");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : `Failed to ${action} meeting.`);
    }
  };
  
  // Load LiveKit token for video
  const loadLiveKitToken = async (meetingId: string) => {
    setIsLoadingVideo(true);
    setVideoError(null);
    try {
      console.log("Fetching LiveKit token for meeting:", meetingId);
      const response = await fetch(`/api/meetings/${meetingId}/livekit-token`, {
        cache: "no-store",
      });
      console.log("LiveKit token response status:", response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error("LiveKit token error:", error);
        throw new Error(error.error || "Failed to get video token");
      }
      
      const data = await response.json();
      console.log("LiveKit token data received:", {
        hasToken: !!data.token,
        hasWsUrl: !!data.wsUrl,
        hasRoomName: !!data.roomName,
      });
      
      setLivekitToken(data.token);
      setLivekitWsUrl(data.wsUrl);
      setLivekitRoomName(data.roomName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load video";
      console.error("LiveKit token loading failed:", error);
      setVideoError(errorMessage);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // Send chat message
  const sendMeetingMessage = async (meetingId: string) => {
    if (!meetingChatInput.trim()) return;
    try {
      const response = await fetch(`/api/meetings/${meetingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: meetingChatInput.trim() }),
      });
      if (!response.ok) throw new Error("Could not send message.");
      const data = (await response.json()) as { message: MeetingMessage };
      setMeetingMessages((prev) => [...prev, data.message]);
      setMeetingChatInput("");
      setMeetingError("");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "Failed to send message.");
    }
  };

  // Attach document URL
  const attachDocument = async (meetingId: string, title: string, fileUrl: string) => {
    try {
      const response = await fetch(`/api/meetings/${meetingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, fileUrl }),
      });
      if (!response.ok) throw new Error("Could not attach document.");
      await loadMeetings();
      setMeetingError("");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "Failed to attach document.");
    }
  };

  // Load meetings when user logs in or view changes to Meetings
  useEffect(() => {
    if (activeUser && (view === "Meetings" || view === "Live Meetings")) {
      loadMeetings();
    }
  }, [activeUser, view]);

  // Load messages when active meeting changes
  useEffect(() => {
    if (activeMeetingId) {
      loadMeetingMessages(activeMeetingId);
      
      // Poll for new messages every 3 seconds while meeting is active
      const pollInterval = setInterval(() => {
        loadMeetingMessages(activeMeetingId);
      }, 3000);
      
      return () => clearInterval(pollInterval);
    } else {
      setMeetingMessages([]);
    }
  }, [activeMeetingId]);

  const nav = useMemo(() => {
    if (!activeUser) return [];
    if (activeUser.role === "Employee") return ["Dashboard", "Goals", "Quarterly Update", "Meetings"];
    if (activeUser.role === "Manager")
      return ["Dashboard", "Approvals", "Check-ins", "Shared Goals", "Meetings"];
    return ["Dashboard", "Users & Cycles", "Shared Goals", "Reports", "Audit Trail", "Live Meetings"];
  }, [activeUser]);

  const setAndAudit = (updater: (current: AppState) => AppState) => {
    setState((current) => updater(current));
  };

  const notifyWorkflow = (payload: {
    event:
      | "GOAL_SUBMITTED"
      | "GOAL_UPDATED"
      | "GOAL_APPROVED"
      | "GOAL_RETURNED"
      | "CHECK_IN_COMPLETED"
      | "CYCLE_PHASE_CHANGED";
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
  }) => {
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  };

  const addAudit = (current: AppState, action: string, entity: string, before?: string, after?: string) => ({
    ...current,
    auditLogs: [
      {
        id: crypto.randomUUID(),
        actor: activeUser?.name ?? "System",
        action,
        entity,
        before,
        after,
        createdAt: new Date().toISOString(),
      },
      ...current.auditLogs,
    ],
  });

  const updateGoal = (goalId: string, patch: Partial<Goal>) => {
    setAndAudit((current) => {
      const existing = current.goals.find((goal) => goal.id === goalId);
      const nextState = {
        ...current,
        goals: current.goals.map((goal) => (goal.id === goalId ? { ...goal, ...patch } : goal)),
      };

      if (
        existing &&
        activeUser &&
        (activeUser.role === "Manager" || activeUser.role === "Admin") &&
        ("targetValue" in patch || "weightage" in patch)
      ) {
        return addAudit(
          nextState,
          activeUser.role === "Manager" ? "Manager edited target/weightage inline" : "Admin edited goal exception",
          existing.title,
          JSON.stringify({ targetValue: existing.targetValue, weightage: existing.weightage }),
          JSON.stringify({
            targetValue: patch.targetValue ?? existing.targetValue,
            weightage: patch.weightage ?? existing.weightage,
          }),
        );
      }

      return nextState;
    });
  };

  const requestConfirmation = (nextConfirmation: Confirmation) => {
    setConfirmation(nextConfirmation);
  };

  const confirmPendingAction = () => {
    confirmation?.onConfirm();
    setConfirmation(null);
  };

  const isGoalSettingOpen = state.cycle.phase === "Goal Setting";
  const activeQuarter = quarterForPhase(state.cycle.phase);

  const changeCyclePhase = (phase: string) => {
    if (!activeUser || activeUser.role !== "Admin" || !cyclePhases.includes(phase)) return;
    setAndAudit((current) =>
      addAudit(
        { ...current, cycle: { ...current.cycle, phase } },
        "Admin changed active cycle phase",
        current.cycle.name,
        current.cycle.phase,
        phase,
      ),
    );
    notifyWorkflow({ event: "CYCLE_PHASE_CHANGED", phase });
  };

  const changeEmployeeManager = (employeeId: string, managerId: string) => {
    if (!activeUser || activeUser.role !== "Admin") return;
    const employee = state.users.find((user) => user.id === employeeId);
    const previousManager = state.users.find((user) => user.id === employee?.managerId);
    const nextManager = state.users.find((user) => user.id === managerId);
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          users: current.users.map((user) =>
            user.id === employeeId ? { ...user, managerId: managerId || undefined } : user,
          ),
        },
        "Admin updated reporting manager",
        employee?.name ?? employeeId,
        previousManager?.name ?? "Unassigned",
        nextManager?.name ?? "Unassigned",
      ),
    );
  };

  const submitGoals = (goalsToSubmit: Goal[]) => {
    if (!activeUser) return;
    if (!isGoalSettingOpen) return;
    const validation = validateGoals(goalsToSubmit);
    if (!validation.ok) return;
    const submittableGoalIds = new Set(
      goalsToSubmit
        .filter((goal) => goal.status === "Draft" || goal.status === "Returned")
        .map((goal) => goal.id),
    );
    if (submittableGoalIds.size === 0) return;
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          goals: current.goals.map((goal) =>
            submittableGoalIds.has(goal.id) ? { ...goal, status: "Submitted", locked: false } : goal,
          ),
        },
        "Submitted goal sheet",
        activeUser.name,
      ),
    );
    notifyWorkflow({
      event: "GOAL_SUBMITTED",
      employeeId: activeUser.id,
      managerId: activeUser.managerId,
      goalSummary: goalsToSubmit.map((goal) => ({
        title: goal.title,
        thrustArea: goal.thrustArea,
        uomType: goal.uomType,
        target: goal.uomType === "Timeline" ? goal.targetDate : String(goal.targetValue),
        weightage: goal.weightage,
      })),
    });
  };

  const approveGoals = () => {
    if (!activeUser || !selectedEmployee) return;
    if (!isGoalSettingOpen) return;
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          goals: current.goals.map((goal) =>
            goal.employeeId === selectedEmployee.id && !goal.sharedGoalId && goal.status === "Submitted"
              ? { ...goal, status: "Approved", locked: true }
              : goal,
          ),
        },
        "Approved and locked goal sheet",
        selectedEmployee.name,
      ),
    );
    notifyWorkflow({ event: "GOAL_APPROVED", employeeId: selectedEmployee.id, managerId: activeUser.id });
  };

  const returnGoals = (comment: string) => {
    if (!activeUser || !selectedEmployee) return;
    if (!isGoalSettingOpen) return;
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          goals: current.goals.map((goal) =>
            goal.employeeId === selectedEmployee.id && !goal.sharedGoalId && goal.status === "Submitted"
              ? { ...goal, status: "Returned", locked: false }
              : goal,
          ),
        },
        "Returned goal sheet for rework",
        selectedEmployee.name,
        undefined,
        comment.trim() || "No manager comment provided",
      ),
    );
    notifyWorkflow({ event: "GOAL_RETURNED", employeeId: selectedEmployee.id, managerId: activeUser.id, comment });
  };

  const unlockEmployee = (employeeId: string) => {
    if (!activeUser) return;
    const employee = state.users.find((user) => user.id === employeeId);
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          goals: current.goals.map((goal) =>
            goal.employeeId === employeeId && !goal.sharedGoalId && goal.status === "Approved"
              ? { ...goal, locked: false, status: "Returned" }
              : goal,
          ),
        },
        "Admin unlocked goal sheet",
        employee?.name ?? employeeId,
      ),
    );
  };

  const saveUpdate = (goal: Goal, actualValue: number, actualDate: string, status: ProgressStatus, comment: string) => {
    if (!activeUser) return;
    if (!activeQuarter || activeQuarter !== quarter) return;
    const progressScore = scoreGoal(goal, actualValue, actualDate);
    setAndAudit((current) => {
      const existing = current.updates.find(
        (update) => update.goalId === goal.id && update.quarter === quarter,
      );
      const nextUpdate: Update = {
        id: existing?.id ?? crypto.randomUUID(),
        goalId: goal.id,
        quarter,
        actualValue,
        actualDate,
        status,
        employeeComment: comment,
        progressScore,
      };
      const linkedGoalIds =
        goal.sharedGoalId && goal.primaryOwner
          ? current.goals
              .filter((candidate) => candidate.sharedGoalId === goal.sharedGoalId)
              .map((candidate) => candidate.id)
          : [goal.id];
      const withoutLinked = current.updates.filter(
        (update) => !(linkedGoalIds.includes(update.goalId) && update.quarter === quarter),
      );
      const linkedUpdates = linkedGoalIds.map((goalId) => ({
        ...nextUpdate,
        id: goalId === goal.id ? nextUpdate.id : crypto.randomUUID(),
        goalId,
      }));
      return addAudit(
        { ...current, updates: [...withoutLinked, ...linkedUpdates] },
        goal.sharedGoalId && goal.primaryOwner
          ? "Updated shared goal achievement and synced recipients"
          : "Updated quarterly achievement",
        goal.title,
      );
    });
    const employee = state.users.find((user) => user.id === goal.employeeId);
    notifyWorkflow({
      event: "GOAL_UPDATED",
      employeeId: goal.employeeId,
      managerId: employee?.managerId,
      updateSummary: {
        title: goal.title,
        thrustArea: goal.thrustArea,
        target: goal.uomType === "Timeline" ? goal.targetDate : String(goal.targetValue),
        actual: goal.uomType === "Timeline" ? actualDate : String(actualValue),
        status,
        progressScore,
        quarter,
        comment,
      },
    });
  };

  const completeCheckIn = (comment: string) => {
    if (!activeUser || !selectedEmployee) return;
    if (!activeQuarter || activeQuarter !== quarter) return;
    setAndAudit((current) => {
      const others = current.checkIns.filter(
        (checkIn) => !(checkIn.employeeId === selectedEmployee.id && checkIn.quarter === quarter),
      );
      return addAudit(
        {
          ...current,
          checkIns: [
            ...others,
            {
              id: crypto.randomUUID(),
              employeeId: selectedEmployee.id,
              managerId: activeUser.id,
              quarter,
              comment,
              completedAt: new Date().toISOString().slice(0, 10),
            },
          ],
        },
        "Completed manager check-in",
        `${selectedEmployee.name} ${quarter}`,
      );
    });
    notifyWorkflow({ event: "CHECK_IN_COMPLETED", employeeId: selectedEmployee.id, managerId: activeUser.id });
  };

  const pushSharedGoal = (draft: SharedGoalDraft, recipientIds: string[]) => {
    if (!activeUser) return;
    const recipients = activeUser.role === "Manager" ? team : employees;
    const teamIds = recipients.map((member) => member.id).filter((id) => recipientIds.includes(id));
    if (teamIds.length === 0) return;
    const shared: SharedGoal = {
      id: crypto.randomUUID(),
      ownerId: teamIds[0] ?? "u-employee",
      thrustArea: draft.thrustArea,
      title: draft.title,
      description: draft.description,
      uomType: draft.uomType,
      direction: draft.direction,
      targetValue: draft.targetValue,
      targetDate: draft.targetDate,
    };
    const linkedGoals: Goal[] = teamIds.map((employeeId, index) => ({
      id: crypto.randomUUID(),
      employeeId,
      thrustArea: shared.thrustArea,
      title: shared.title,
      description: shared.description,
      uomType: shared.uomType,
      direction: shared.direction,
      targetValue: shared.targetValue,
      targetDate: shared.targetDate,
      weightage: draft.weightage,
      status: "Draft",
      locked: false,
      sharedGoalId: shared.id,
      primaryOwner: index === 0,
    }));
    setAndAudit((current) =>
      addAudit(
        {
          ...current,
          sharedGoals: [...current.sharedGoals, shared],
          goals: [...current.goals, ...linkedGoals],
        },
        "Pushed shared departmental KPI",
        activeUser?.role === "Manager" ? "Operations team" : "All employees",
      ),
    );
  };

  const reloadDatabaseState = async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) {
      setLoadError("Could not reload database state.");
      return;
    }
    setState((await response.json()) as AppState);
    setSaveStatus("saved");
  };

  const exportCsv = () => {
    const rows = [
      [
        "Employee",
        "Manager",
        "Department",
        "Goal",
        "Thrust Area",
        "UoM",
        "Target",
        "Weightage",
        "Quarter",
        "Actual",
        "Status",
        "Progress Score",
      ],
      ...state.goals.flatMap((goal) => {
        const employee = state.users.find((user) => user.id === goal.employeeId);
        const manager = state.users.find((user) => user.id === employee?.managerId);
        const updates = state.updates.filter((update) => update.goalId === goal.id);
        const source = updates.length ? updates : [{ quarter: "", actualValue: "", status: "", progressScore: "" }];
        return source.map((update) => [
          employee?.name ?? "",
          manager?.name ?? "",
          employee?.department ?? "",
          goal.title,
          goal.thrustArea,
          goal.uomType,
          goal.uomType === "Timeline" ? goal.targetDate : goal.targetValue,
          goal.weightage,
          update.quarter,
          update.actualValue,
          update.status,
          update.progressScore,
        ]);
      }),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "worksphere-achievement-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={classNames("min-h-screen text-slate-950", activeUser ? "app-shell" : "auth-shell")}>
      {!activeUser && (
        <LoginScreen
          mode={authMode}
          name={signupName}
          email={loginEmail}
          password={loginPassword}
          role={signupRole}
          department={signupDepartment}
          managerEmail={signupManagerEmail}
          error={loginError || loadError}
          isLoading={!hasLoadedDatabase || isLoggingIn}
          setMode={setAuthMode}
          setName={setSignupName}
          setEmail={setLoginEmail}
          setPassword={setLoginPassword}
          setRole={setSignupRole}
          setDepartment={setSignupDepartment}
          setManagerEmail={setSignupManagerEmail}
          login={login}
          ssoConfigured={ssoConfigured}
          startMicrosoftSso={startMicrosoftSso}
        />
      )}

      {activeUser && (
        <>
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">WorkSphere</p>
            <h1 className="text-xl font-semibold">Goal Setting & Tracking Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="header-action-button header-refresh-button"
              onClick={reloadDatabaseState}
              title="Refresh database state"
            >
              <RotateCcw size={18} />
              <span>Refresh</span>
            </button>
            <button className="header-action-button header-logout-button" title="Logout" onClick={logout}>
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="app-layout mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-5 lg:grid-cols-[240px_1fr]">
        <aside className="app-sidebar h-fit p-3 lg:min-h-[calc(100vh-112px)]">
          <div className="user-card mb-4 rounded-md p-3">
            <p className="text-sm font-semibold">{activeUser.name}</p>
            <p className="text-xs text-slate-500">{activeUser.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              {activeUser.role}
            </span>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => (
              <button
                key={item}
                className={classNames("nav-button", view === item && "nav-button-active")}
                onClick={() => setView(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-5">
          <div className="sync-banner flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-slate-600">
            <span>{loadError ? loadError : hasLoadedDatabase ? "Connected to Neon database" : "Loading database state..."}</span>
            <span className={classNames("status-badge", saveStatus === "error" ? "status-returned" : "status-approved")}>
              {saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "Save issue" : "Synced"}
            </span>
          </div>

          {view === "Dashboard" && (
            <Dashboard
              state={state}
              activeUser={activeUser}
              selectedEmployee={selectedEmployee}
              setView={setView}
              exportCsv={exportCsv}
            />
          )}

          {activeUser.role === "Employee" && view === "Goals" && (
            <EmployeeGoals
              goalGroups={ownGoalGroups}
              isGoalSettingOpen={isGoalSettingOpen}
              updateGoal={updateGoal}
              addGoal={() =>
                setState((current) => ({
                  ...current,
                  goals: [...current.goals, emptyGoal(activeUser.id)],
                }))
              }
              removeGoal={(goalId) =>
                setState((current) => ({
                  ...current,
                  goals: current.goals.filter((goal) => goal.id !== goalId),
                }))
              }
              submitGoals={submitGoals}
            />
          )}

          {activeUser.role === "Employee" && view === "Quarterly Update" && (
            <QuarterlyUpdate
              goals={ownGoals.filter((goal) => goal.status === "Approved")}
              updates={state.updates}
              quarter={quarter}
              setQuarter={setQuarter}
              activeQuarter={activeQuarter}
              saveUpdate={saveUpdate}
            />
          )}

          {activeUser.role === "Manager" && view === "Approvals" && (
            <ManagerApprovals
              team={team}
              selectedEmployee={selectedEmployee}
              setActiveEmployeeId={setActiveEmployeeId}
              goals={submittedEmployeeGoals}
              updateGoal={updateGoal}
              isGoalSettingOpen={isGoalSettingOpen}
              approveGoals={() =>
                requestConfirmation({
                  title: "Approve Goal Sheet",
                  message: `Approve and lock ${selectedEmployee.name}'s goal sheet? Employee edits will stop until an Admin unlocks it.`,
                  confirmLabel: "Approve & lock",
                  onConfirm: approveGoals,
                })
              }
              returnGoals={(comment) =>
                requestConfirmation({
                  title: "Return For Rework",
                  message: `Return ${selectedEmployee.name}'s sheet with your manager comment? They can edit and resubmit after this.`,
                  confirmLabel: "Return sheet",
                  onConfirm: () => returnGoals(comment),
                })
              }
            />
          )}

          {activeUser.role === "Manager" && view === "Check-ins" && (
            <ManagerCheckIns
              team={team}
              selectedEmployee={selectedEmployee}
              setActiveEmployeeId={setActiveEmployeeId}
              goals={employeeGoals}
              updates={state.updates}
              checkIns={state.checkIns}
              quarter={quarter}
              setQuarter={setQuarter}
              activeQuarter={activeQuarter}
              completeCheckIn={completeCheckIn}
            />
          )}

          {(activeUser.role === "Manager" || activeUser.role === "Admin") && view === "Shared Goals" && (
            <SharedGoals
              state={state}
              recipients={activeUser.role === "Manager" ? team : employees}
              pushSharedGoal={(draft) =>
                requestConfirmation({
                  title: "Push Shared KPI",
                  message:
                    activeUser.role === "Manager"
                      ? "Create linked shared KPI goals for the selected employees in this manager's team."
                      : "Create linked shared KPI goals for the selected employees in the portal.",
                  confirmLabel: "Push KPI",
                  onConfirm: () => pushSharedGoal(draft, draft.recipientIds),
                })
              }
            />
          )}

          {activeUser.role === "Admin" && view === "Users & Cycles" && (
            <AdminUsers
              state={state}
              changeCyclePhase={changeCyclePhase}
              changeEmployeeManager={changeEmployeeManager}
              unlockEmployee={(employeeId) => {
                const employee = state.users.find((user) => user.id === employeeId);
                requestConfirmation({
                  title: "Unlock Goal Sheet",
                  message: `Unlock ${employee?.name ?? "this employee"}'s goals for exception handling? The sheet will return to employee rework state.`,
                  confirmLabel: "Unlock sheet",
                  tone: "danger",
                  onConfirm: () => unlockEmployee(employeeId),
                });
              }}
            />
          )}

          {activeUser.role === "Admin" && view === "Reports" && (
            <AdminReports state={state} exportCsv={exportCsv} />
          )}

          {activeUser.role === "Admin" && view === "Audit Trail" && (
            <AuditTrail logs={state.auditLogs} />
          )}

          {(activeUser.role === "Employee" || activeUser.role === "Manager") && view === "Meetings" && (
            <MeetingsView
              meetings={meetings}
              activeUser={activeUser}
              activeMeetingId={activeMeetingId}
              setActiveMeetingId={setActiveMeetingId}
              meetingMessages={meetingMessages}
              meetingChatInput={meetingChatInput}
              setMeetingChatInput={setMeetingChatInput}
              isCreatingMeeting={isCreatingMeeting}
              setIsCreatingMeeting={setIsCreatingMeeting}
              newMeetingTitle={newMeetingTitle}
              setNewMeetingTitle={setNewMeetingTitle}
              newMeetingAgenda={newMeetingAgenda}
              setNewMeetingAgenda={setNewMeetingAgenda}
              newMeetingDate={newMeetingDate}
              setNewMeetingDate={setNewMeetingDate}
              selectedParticipantIds={selectedParticipantIds}
              setSelectedParticipantIds={setSelectedParticipantIds}
              availableParticipants={activeUser.role === "Manager" ? team : []}
              meetingError={meetingError}
              createMeeting={createMeeting}
              updateMeetingStatus={updateMeetingStatus}
              sendMeetingMessage={sendMeetingMessage}
              attachDocument={attachDocument}
              loadMeetings={loadMeetings}
              livekitToken={livekitToken}
              livekitWsUrl={livekitWsUrl}
              livekitRoomName={livekitRoomName}
              isLoadingVideo={isLoadingVideo}
              videoError={videoError}
              loadLiveKitToken={loadLiveKitToken}
            />
          )}

          {activeUser.role === "Admin" && view === "Live Meetings" && (
            <AdminLiveMeetings
              meetings={meetings}
              activeMeetingId={activeMeetingId}
              setActiveMeetingId={setActiveMeetingId}
              meetingError={meetingError}
              updateMeetingStatus={updateMeetingStatus}
              loadMeetings={loadMeetings}
            />
          )}
        </section>
      </div>

      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmPendingAction}
        />
      )}
      </>
      )}
    </main>
  );
}

function validateGoals(goals: Goal[]) {
  const total = goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0);
  const messages = [];
  if (goals.length === 0) messages.push("Add at least one goal.");
  if (goals.length > 8) messages.push("Maximum 8 goals allowed.");
  if (goals.some((goal) => Number(goal.weightage) < 10)) messages.push("Each goal must have at least 10% weightage.");
  if (goals.some((goal) => Number(goal.weightage) > 100)) messages.push("Individual goal weightage cannot exceed 100%.");
  if (goals.some((goal) => Number(goal.weightage) <= 0)) messages.push("Goal weightage must be a positive number.");
  if (total !== 100) messages.push(`Total weightage must equal 100%. Current total: ${total}%.`);
  if (goals.some((goal) => !goal.title.trim())) messages.push("Every goal needs a title.");
  return { ok: messages.length === 0, messages, total };
}

function Dashboard({
  state,
  activeUser,
  setView,
  exportCsv,
}: {
  state: AppState;
  activeUser: User;
  selectedEmployee: User;
  setView: (view: string) => void;
  exportCsv: () => void;
}) {
  const employees = state.users.filter((user) => user.role === "Employee");
  const approved = employees.filter((employee) =>
    state.goals.some((goal) => goal.employeeId === employee.id && goal.status === "Approved"),
  ).length;
  const submitted = employees.filter((employee) =>
    state.goals.some((goal) => goal.employeeId === employee.id && goal.status === "Submitted"),
  ).length;
  const avgScore =
    state.updates.length === 0
      ? 0
      : Math.round(state.updates.reduce((sum, update) => sum + update.progressScore, 0) / state.updates.length);

  const chartData = employees.map((employee) => ({
    name: employee.name.split(" ")[0],
    goals: (() => {
      const goals = state.goals.filter((goal) => goal.employeeId === employee.id);
      if (goals.length === 0) return 0;
      return Math.round((goals.filter((goal) => goal.status === "Approved").length / goals.length) * 100);
    })(),
    checkIns: Math.round(
      (state.checkIns.filter((checkIn) => checkIn.employeeId === employee.id).length / quarters.length) * 100,
    ),
  }));

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{state.cycle.name}</p>
          <h2>{activeUser.role} Dashboard</h2>
          <p className="muted">Current phase: {state.cycle.phase}</p>
        </div>
        {activeUser.role === "Admin" && (
          <button className="primary-button" onClick={exportCsv}>
            <Download size={17} /> Export report
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<ClipboardList size={19} />} label="Employees" value={employees.length} />
        <Metric icon={<CheckCircle2 size={19} />} label="Approved sheets" value={approved} />
        <Metric icon={<Send size={19} />} label="Pending approval" value={submitted} />
        <Metric icon={<BarChart3 size={19} />} label="Avg progress" value={`${avgScore}%`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Completion Overview">
          <div className="chart-bars">
            {chartData.map((row) => (
              <div className="chart-row" key={row.name}>
                <span>{row.name}</span>
                <div className="bar-track">
                  <div className="bar-fill-blue" style={{ width: barWidth(row.goals) }} />
                </div>
                <div className="bar-track">
                  <div className="bar-fill-green" style={{ width: barWidth(row.checkIns) }} />
                </div>
              </div>
            ))}
            <div className="chart-legend">
              <span><i className="legend-blue" /> Goals</span>
              <span><i className="legend-green" /> Check-ins</span>
            </div>
          </div>
        </Panel>
        <Panel title="Quarterly Windows">
          <div className="space-y-3">
            {Object.entries(state.cycle.windows).map(([name, window]) => (
              <div key={name} className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-medium">{name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{window}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Suggested Demo Path">
        {activeUser.role === "Employee" && (
          <button className="text-card text-left" onClick={() => setView("Goals")}>
            <p className="font-semibold">Employee workflow</p>
            <p className="text-sm text-slate-600">Create goals, validate weightage, submit, and update quarterly achievement.</p>
          </button>
        )}
        {activeUser.role === "Manager" && (
          <div className="grid gap-3 md:grid-cols-2">
            <button className="text-card text-left" onClick={() => setView("Approvals")}>
              <p className="font-semibold">Approvals</p>
              <p className="text-sm text-slate-600">Review submitted team sheets, edit targets, approve, or return for rework.</p>
            </button>
            <button className="text-card text-left" onClick={() => setView("Check-ins")}>
              <p className="font-semibold">Check-ins</p>
              <p className="text-sm text-slate-600">Review planned vs actual progress and record structured discussion notes.</p>
            </button>
          </div>
        )}
        {activeUser.role === "Admin" && (
          <div className="grid gap-3 md:grid-cols-2">
            <button className="text-card text-left" onClick={() => setView("Reports")}>
              <p className="font-semibold">Reports</p>
              <p className="text-sm text-slate-600">Export achievement reports and inspect completion metrics.</p>
            </button>
            <button className="text-card text-left" onClick={() => setView("Audit Trail")}>
              <p className="font-semibold">Audit Trail</p>
              <p className="text-sm text-slate-600">Review who changed goal, approval, and check-in records.</p>
            </button>
          </div>
        )}
      </Panel>
    </>
  );
}

function EmployeeGoals({
  goalGroups,
  isGoalSettingOpen,
  updateGoal,
  addGoal,
  removeGoal,
  submitGoals,
}: {
  goalGroups: {
    current: Goal[];
    returned: Goal[];
    completed: Goal[];
    shared: Goal[];
  };
  isGoalSettingOpen: boolean;
  updateGoal: (goalId: string, patch: Partial<Goal>) => void;
  addGoal: () => void;
  removeGoal: (goalId: string) => void;
  submitGoals: (goals: Goal[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<GoalTab>("Current");
  const tabs: Array<{ id: GoalTab; label: string; goals: Goal[] }> = [
    { id: "Current", label: "Current goals", goals: goalGroups.current },
    { id: "Returned", label: "Returned for rework", goals: goalGroups.returned },
    { id: "Completed", label: "Approved & locked", goals: goalGroups.completed },
    { id: "Shared KPI", label: "Shared KPIs", goals: goalGroups.shared },
  ];
  const activeGoals = tabs.find((tab) => tab.id === activeTab)?.goals ?? [];
  const isEditableSubmissionTab = activeTab === "Current" || activeTab === "Returned";
  const validation = isEditableSubmissionTab ? validateGoals(activeGoals) : null;
  const sheetEditable =
    isGoalSettingOpen &&
    isEditableSubmissionTab &&
    activeGoals.every((goal) => !goal.locked && (goal.status === "Draft" || goal.status === "Returned"));
  const canAddCurrentGoal = activeTab === "Current" && sheetEditable && goalGroups.current.length < 8;
  const canSubmit = Boolean(validation?.ok) && activeGoals.length > 0 && sheetEditable;
  const emptyText =
    activeTab === "Current"
      ? isGoalSettingOpen
        ? "No current draft goals. Add goals for the active Goal Setting cycle."
        : "Goal creation opens during the Goal Setting phase."
      : activeTab === "Returned"
        ? "No returned goals are waiting for rework."
        : activeTab === "Completed"
          ? "No approved and locked goal sheet yet."
          : "No shared departmental KPIs have been assigned yet.";

  return (
    <Panel
      title="Goal Sheet"
      actions={
        <>
          <button className="secondary-button" onClick={addGoal} disabled={!canAddCurrentGoal}>
            <Plus size={17} /> Add goal
          </button>
          <button className="primary-button" onClick={() => submitGoals(activeGoals)} disabled={!canSubmit}>
            <Send size={17} /> Submit
          </button>
        </>
      }
    >
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={classNames("secondary-button justify-center", activeTab === tab.id && "ring-2 ring-blue-300")}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="status-badge">{tab.goals.length}</span>
          </button>
        ))}
      </div>
      {validation && <ValidationBox validation={validation} />}
      {!isGoalSettingOpen && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Goal creation, edits, and submission are available only during the Goal Setting phase.
        </div>
      )}
      {isEditableSubmissionTab && activeGoals.length > 0 && !sheetEditable && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          This sheet is waiting for manager action or already locked, so employee edits are paused until it is returned or unlocked.
        </div>
      )}
      {activeTab === "Shared KPI" && (
        <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
          Shared KPIs are separate from your 100% personal goal-sheet validation. Recipients can adjust only weightage before the KPI is locked.
        </div>
      )}
      <div className="space-y-4">
        {activeGoals.map((goal) => {
          const isShared = Boolean(goal.sharedGoalId);
          const canEditGoal =
            isGoalSettingOpen &&
            !goal.locked &&
            (goal.status === "Draft" || goal.status === "Returned") &&
            (isEditableSubmissionTab || activeTab === "Shared KPI");
          const readOnly = !canEditGoal || isShared;
          const canEditWeightage = canEditGoal && (!isShared || activeTab === "Shared KPI");
          return (
            <div key={goal.id} className="goal-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={classNames("status-badge", statusTone(goal.status))}>{goal.status}</span>
                  {goal.locked && <span className="ml-2 status-badge"><Lock size={12} /> Locked</span>}
                  {isShared && <span className="ml-2 status-badge"><Share2 size={12} /> Shared KPI</span>}
                </div>
                <button className="icon-button" disabled={!canEditGoal || isShared} onClick={() => removeGoal(goal.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="form-grid mt-4">
                <Field label="Thrust Area">
                  <input value={goal.thrustArea} disabled={readOnly} onChange={(e) => updateGoal(goal.id, { thrustArea: e.target.value })} />
                </Field>
                <Field label="Goal Title">
                  <input value={goal.title} disabled={readOnly} onChange={(e) => updateGoal(goal.id, { title: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea value={goal.description} disabled={readOnly} onChange={(e) => updateGoal(goal.id, { description: e.target.value })} />
                </Field>
                <Field label="UoM">
                  <select value={goal.uomType} disabled={readOnly} onChange={(e) => updateGoal(goal.id, { uomType: e.target.value as UomType })}>
                    <option>Numeric</option>
                    <option>Percentage</option>
                    <option>Timeline</option>
                    <option>Zero</option>
                  </select>
                </Field>
                <Field label="Direction">
                  <select value={goal.direction} disabled={readOnly || goal.uomType === "Zero"} onChange={(e) => updateGoal(goal.id, { direction: e.target.value as Direction })}>
                    <option value="Min">Higher is better</option>
                    <option value="Max">Lower is better</option>
                  </select>
                </Field>
                <Field label="Target">
                  <input type="number" value={goal.targetValue} disabled={readOnly || goal.uomType === "Timeline" || goal.uomType === "Zero"} onChange={(e) => updateGoal(goal.id, { targetValue: Number(e.target.value) })} />
                </Field>
                <Field label="Deadline">
                  <input type="date" value={goal.targetDate} disabled={readOnly} onChange={(e) => updateGoal(goal.id, { targetDate: e.target.value })} />
                </Field>
                <Field label="Weightage">
                  <input type="number" min={10} max={100} value={goal.weightage} disabled={!canEditWeightage} onChange={(e) => updateGoal(goal.id, { weightage: Number(e.target.value) })} />
                </Field>
              </div>
            </div>
          );
        })}
        {activeGoals.length === 0 && <Empty text={emptyText} />}
      </div>
    </Panel>
  );
}

function QuarterlyUpdate({
  goals,
  updates,
  quarter,
  setQuarter,
  activeQuarter,
  saveUpdate,
}: {
  goals: Goal[];
  updates: Update[];
  quarter: Quarter;
  setQuarter: (quarter: Quarter) => void;
  activeQuarter: Quarter | null;
  saveUpdate: (goal: Goal, actualValue: number, actualDate: string, status: ProgressStatus, comment: string) => void;
}) {
  const canUpdate = activeQuarter === quarter;
  return (
    <Panel title="Quarterly Achievement Update" actions={<QuarterSelect quarter={quarter} setQuarter={setQuarter} />}>
      {!activeQuarter && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Achievement capture is closed until a quarterly check-in phase is active.
        </div>
      )}
      {activeQuarter && !canUpdate && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {activeQuarter} is the active check-in window. You can view {quarter}, but updates are locked.
        </div>
      )}
      <div className="space-y-4">
        {goals.map((goal) => (
          <UpdateRow
            key={goal.id}
            goal={goal}
            existing={updates.find((update) => update.goalId === goal.id && update.quarter === quarter)}
            canUpdate={canUpdate}
            saveUpdate={saveUpdate}
          />
        ))}
        {goals.length === 0 && <Empty text="No approved goals yet. Ask the manager to approve the sheet first." />}
      </div>
    </Panel>
  );
}

function UpdateRow({
  goal,
  existing,
  canUpdate,
  saveUpdate,
}: {
  goal: Goal;
  existing?: Update;
  canUpdate: boolean;
  saveUpdate: (goal: Goal, actualValue: number, actualDate: string, status: ProgressStatus, comment: string) => void;
}) {
  const [actualValue, setActualValue] = useState(existing?.actualValue ?? 0);
  const [actualDate, setActualDate] = useState(existing?.actualDate ?? "2026-07-20");
  const [status, setStatus] = useState<ProgressStatus>(existing?.status ?? "On Track");
  const [comment, setComment] = useState(existing?.employeeComment ?? "");
  const score = scoreGoal(goal, Number(actualValue), actualDate);

  return (
    <div className="goal-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{goal.title}</h3>
          <p className="text-sm text-slate-600">Target: {goal.uomType === "Timeline" ? goal.targetDate : goal.targetValue} | Weightage: {goal.weightage}%</p>
        </div>
        <span className="score-pill">{score}% progress</span>
      </div>
      <div className="form-grid mt-4">
        <Field label="Actual Achievement">
          <input type="number" value={actualValue} disabled={!canUpdate} onChange={(e) => setActualValue(Number(e.target.value))} />
        </Field>
        <Field label="Actual Date">
          <input type="date" value={actualDate} disabled={!canUpdate} onChange={(e) => setActualDate(e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={status} disabled={!canUpdate} onChange={(e) => setStatus(e.target.value as ProgressStatus)}>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Comment">
          <textarea value={comment} disabled={!canUpdate} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      <button className="primary-button mt-4" disabled={!canUpdate} onClick={() => saveUpdate(goal, Number(actualValue), actualDate, status, comment)}>
        <CheckCircle2 size={17} /> Save update
      </button>
    </div>
  );
}

function ManagerApprovals(props: {
  team: User[];
  selectedEmployee?: User;
  setActiveEmployeeId: (id: string) => void;
  goals: Goal[];
  updateGoal: (goalId: string, patch: Partial<Goal>) => void;
  isGoalSettingOpen: boolean;
  approveGoals: () => void;
  returnGoals: (comment: string) => void;
}) {
  const [returnComment, setReturnComment] = useState("");

  if (!props.selectedEmployee) {
    return (
      <Panel title="L1 Goal Approval">
        <Empty text="No employees report to this manager yet. Ask employees to sign up with this manager's email, or have Admin update the hierarchy." />
      </Panel>
    );
  }

  const selectedEmployee = props.selectedEmployee;
  const validation = validateGoals(props.goals);
  const canReview =
    props.isGoalSettingOpen && props.goals.some((goal) => goal.status === "Submitted");
  return (
    <Panel
      title="L1 Goal Approval"
      actions={<EmployeeSelect team={props.team} value={selectedEmployee.id} onChange={props.setActiveEmployeeId} />}
    >
      <ValidationBox validation={validation} />
      {!props.isGoalSettingOpen && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          L1 review, inline edits, approval, and return-for-rework are available only during the Goal Setting phase.
        </div>
      )}
      <div className="space-y-3">
        {props.goals.map((goal) => (
          <div key={goal.id} className="goal-card">
            <div className="grid gap-3 md:grid-cols-[1fr_140px_120px]">
              <div>
                <p className="font-semibold">{goal.title}</p>
                <p className="text-sm text-slate-600">{goal.description}</p>
                <span className={classNames("status-badge mt-2", statusTone(goal.status))}>{goal.status}</span>
              </div>
              <Field label="Target">
                <input type="number" value={goal.targetValue} disabled={!canReview || goal.locked || goal.uomType === "Timeline"} onChange={(e) => props.updateGoal(goal.id, { targetValue: Number(e.target.value) })} />
              </Field>
              <Field label="Weightage">
                <input type="number" min={10} max={100} value={goal.weightage} disabled={!canReview || goal.locked} onChange={(e) => props.updateGoal(goal.id, { weightage: Number(e.target.value) })} />
              </Field>
            </div>
          </div>
        ))}
        {props.goals.length === 0 && (
          <Empty text="No submitted goal sheet is pending for this employee. Returned drafts stay with the employee until they resubmit." />
        )}
      </div>
      <Field label="Return Comment">
        <textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="Reason for rework, expected changes, and next action..." />
      </Field>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="primary-button" disabled={!validation.ok || !canReview} onClick={props.approveGoals}><ShieldCheck size={17} /> Approve & lock</button>
        <button className="secondary-button" disabled={!canReview || returnComment.trim().length === 0} onClick={() => props.returnGoals(returnComment)}><RotateCcw size={17} /> Return for rework</button>
      </div>
    </Panel>
  );
}

function ManagerCheckIns(props: {
  team: User[];
  selectedEmployee?: User;
  setActiveEmployeeId: (id: string) => void;
  goals: Goal[];
  updates: Update[];
  checkIns: CheckIn[];
  quarter: Quarter;
  setQuarter: (quarter: Quarter) => void;
  activeQuarter: Quarter | null;
  completeCheckIn: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  if (!props.selectedEmployee) {
    return (
      <Panel title="Manager Check-in">
        <Empty text="No employees report to this manager yet. Check-ins will appear once team members are assigned." />
      </Panel>
    );
  }

  const selectedEmployee = props.selectedEmployee;
  const existing = props.checkIns.find((checkIn) => checkIn.employeeId === selectedEmployee.id && checkIn.quarter === props.quarter);
  const approvedGoals = props.goals.filter((goal) => goal.status === "Approved");
  const allApprovedGoalsUpdated =
    approvedGoals.length > 0 &&
    approvedGoals.every((goal) =>
      props.updates.some((item) => item.goalId === goal.id && item.quarter === props.quarter),
    );
  const activeComment = comment || existing?.comment || "";
  const canComplete = props.activeQuarter === props.quarter && allApprovedGoalsUpdated && activeComment.trim().length > 0;

  return (
    <Panel
      title="Manager Check-in"
      actions={
        <div className="flex gap-2">
          <EmployeeSelect team={props.team} value={selectedEmployee.id} onChange={props.setActiveEmployeeId} />
          <QuarterSelect quarter={props.quarter} setQuarter={props.setQuarter} />
        </div>
      }
    >
      {!props.activeQuarter && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Manager check-ins are closed until a quarterly check-in phase is active.
        </div>
      )}
      {props.activeQuarter && !canComplete && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {props.activeQuarter === props.quarter
            ? "Complete all employee achievement updates and add a structured comment before closing this check-in."
            : `${props.activeQuarter} is the active check-in window. You can review ${props.quarter}, but completion is locked.`}
        </div>
      )}
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Goal</th><th>Planned</th><th>Actual</th><th>Status</th><th>Progress</th></tr></thead>
          <tbody>
            {approvedGoals.map((goal) => {
              const update = props.updates.find((item) => item.goalId === goal.id && item.quarter === props.quarter);
              const progress = update ? scoreGoal(goal, update.actualValue, update.actualDate) : null;
              return (
                <tr key={goal.id}>
                  <td>{goal.title}</td>
                  <td>{goal.uomType === "Timeline" ? goal.targetDate : goal.targetValue}</td>
                  <td>{update ? (goal.uomType === "Timeline" ? update.actualDate : update.actualValue) : "Pending"}</td>
                  <td>{update?.status ?? "Not updated"}</td>
                  <td>{progress !== null ? `${progress}%` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {approvedGoals.length === 0 && <Empty text="No approved goals are available for manager check-in yet." />}
      </div>
      <Field label="Structured Check-in Comment">
        <textarea
          value={activeComment}
          disabled={props.activeQuarter !== props.quarter}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Discussion summary, blockers, next actions..."
        />
      </Field>
      <button className="primary-button mt-4" disabled={!canComplete} onClick={() => props.completeCheckIn(activeComment)}>
        <MessageSquare size={17} /> Complete check-in
      </button>
    </Panel>
  );
}

function SharedGoals({
  state,
  recipients,
  pushSharedGoal,
}: {
  state: AppState;
  recipients: User[];
  pushSharedGoal: (draft: SharedGoalDraft) => void;
}) {
  const [draft, setDraft] = useState<SharedGoalDraft>({
    thrustArea: "Department KPI",
    title: "Department service SLA compliance",
    description: "Maintain SLA adherence across all assigned operational queues.",
    uomType: "Percentage",
    direction: "Min",
    targetValue: 95,
    targetDate: "2026-07-31",
    weightage: 10,
    recipientIds: recipients.map((recipient) => recipient.id),
  });
  const canPush = draft.title.trim().length > 0 && draft.weightage >= 10 && draft.weightage <= 100 && draft.recipientIds.length > 0;

  return (
    <Panel
      title="Shared Departmental Goals"
      actions={
        <button className="primary-button" disabled={!canPush} onClick={() => pushSharedGoal(draft)}>
          <Share2 size={17} /> Push KPI
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate-600">Shared goal title and target stay read-only for recipients; only weightage remains adjustable before submission.</p>
      <div className="form-grid mb-5">
        <Field label="Thrust Area">
          <input value={draft.thrustArea} onChange={(e) => setDraft({ ...draft, thrustArea: e.target.value })} />
        </Field>
        <Field label="Goal Title">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Field label="UoM">
          <select value={draft.uomType} onChange={(e) => setDraft({ ...draft, uomType: e.target.value as UomType })}>
            <option>Numeric</option>
            <option>Percentage</option>
            <option>Timeline</option>
            <option>Zero</option>
          </select>
        </Field>
        <Field label="Direction">
          <select value={draft.direction} disabled={draft.uomType === "Zero"} onChange={(e) => setDraft({ ...draft, direction: e.target.value as Direction })}>
            <option value="Min">Higher is better</option>
            <option value="Max">Lower is better</option>
          </select>
        </Field>
        <Field label="Target">
          <input type="number" value={draft.targetValue} disabled={draft.uomType === "Timeline" || draft.uomType === "Zero"} onChange={(e) => setDraft({ ...draft, targetValue: Number(e.target.value) })} />
        </Field>
        <Field label="Deadline">
          <input type="date" value={draft.targetDate} onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })} />
        </Field>
        <Field label="Recipient Weightage">
          <input type="number" min={10} max={100} value={draft.weightage} onChange={(e) => setDraft({ ...draft, weightage: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Select Recipients</p>
        <div className="grid gap-2 md:grid-cols-2">
          {recipients.map((recipient) => (
            <label key={recipient.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.recipientIds.includes(recipient.id)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    recipientIds: event.target.checked
                      ? [...draft.recipientIds, recipient.id]
                      : draft.recipientIds.filter((id) => id !== recipient.id),
                  })
                }
              />
              <span>{recipient.name} - {recipient.department}</span>
            </label>
          ))}
        </div>
        {recipients.length === 0 && <Empty text="No eligible recipients are available." />}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {state.sharedGoals.map((goal) => (
          <div className="text-card" key={goal.id}>
            <p className="font-semibold">{goal.title}</p>
            <p className="text-sm text-slate-600">{goal.description}</p>
            <p className="mt-2 text-xs text-slate-500">Target {goal.uomType === "Timeline" ? goal.targetDate : goal.targetValue} | Current recipients {state.goals.filter((item) => item.sharedGoalId === goal.id).length}</p>
          </div>
        ))}
        {state.sharedGoals.length === 0 && <Empty text="No shared KPIs yet. Push one for the demo." />}
      </div>
    </Panel>
  );
}

function AdminUsers({
  state,
  changeCyclePhase,
  changeEmployeeManager,
  unlockEmployee,
}: {
  state: AppState;
  changeCyclePhase: (phase: string) => void;
  changeEmployeeManager: (employeeId: string, managerId: string) => void;
  unlockEmployee: (id: string) => void;
}) {
  const employees = state.users.filter((user) => user.role === "Employee");
  const managers = state.users.filter((user) => user.role === "Manager");
  return (
    <Panel title="Users, Hierarchy & Cycle">
      <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="form-grid">
          <Field label="Active Cycle">
            <input value={state.cycle.name} disabled />
          </Field>
          <Field label="Active Phase">
            <select value={state.cycle.phase} onChange={(event) => changeCyclePhase(event.target.value)}>
              {cyclePhases.map((phase) => (
                <option key={phase}>{phase}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Admin controls the active window: Goal Setting enables creation and approval, quarterly phases enable only that quarter&apos;s achievement capture and check-ins.
        </p>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-5">
        {Object.entries(state.cycle.windows).map(([name, value]) => (
          <div key={name} className="text-card">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-xs text-slate-500">{value}</p>
          </div>
        ))}
      </div>
      <table>
        <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Manager</th><th>Exception</th></tr></thead>
        <tbody>
          {employees.map((employee) => {
            const manager = state.users.find((user) => user.id === employee.managerId);
            return (
              <tr key={employee.id}>
                <td>{employee.name}</td>
                <td>{employee.role}</td>
                <td>{employee.department}</td>
                <td>
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={manager?.id ?? ""}
                    onChange={(event) => changeEmployeeManager(employee.id, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {managers.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </td>
                <td><button className="secondary-button" onClick={() => unlockEmployee(employee.id)}><Unlock size={16} /> Unlock</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function AdminReports({ state, exportCsv }: { state: AppState; exportCsv: () => void }) {
  const [escalationConfig, setEscalationConfig] = useState<EscalationConfig>(defaultEscalationConfig);
  const [escalationRulesLocked, setEscalationRulesLocked] = useState(false);
  const [escalationRunStatus, setEscalationRunStatus] = useState("");
  const activeQuarter = quarterForPhase(state.cycle.phase);
  const escalations = buildEscalations(state, escalationConfig);
  const employees = state.users.filter((user) => user.role === "Employee");
  const managers = state.users.filter((user) => user.role === "Manager");
  const averageForGoals = (goals: Goal[], quarter: Quarter) => {
    const goalIds = new Set(goals.map((goal) => goal.id));
    const matchingUpdates = state.updates.filter(
      (update) => update.quarter === quarter && goalIds.has(update.goalId),
    );
    return matchingUpdates.length === 0
      ? 0
      : Math.round(matchingUpdates.reduce((sum, update) => sum + update.progressScore, 0) / matchingUpdates.length);
  };
  const qoqRows = quarters.map((item) => {
    const quarterUpdates = state.updates.filter((update) => update.quarter === item);
    const averageScore =
      quarterUpdates.length === 0
        ? 0
        : Math.round(quarterUpdates.reduce((sum, update) => sum + update.progressScore, 0) / quarterUpdates.length);
    return {
      quarter: item,
      averageScore,
      completed: quarterUpdates.filter((update) => update.status === "Completed").length,
      updatedGoals: new Set(quarterUpdates.map((update) => update.goalId)).size,
    };
  });
  const individualTrendRows = employees.map((employee) => ({
    name: employee.name,
    values: quarters.map((item) => averageForGoals(state.goals.filter((goal) => goal.employeeId === employee.id), item)),
  }));
  const departmentTrendRows = Object.entries(
    employees.reduce<Record<string, User[]>>((acc, employee) => {
      acc[employee.department] = [...(acc[employee.department] ?? []), employee];
      return acc;
    }, {}),
  ).map(([department, members]) => ({
    name: department,
    values: quarters.map((item) =>
      averageForGoals(
        state.goals.filter((goal) => members.some((member) => member.id === goal.employeeId)),
        item,
      ),
    ),
  }));
  const teamTrendRows = managers.map((manager) => {
    const team = employees.filter((employee) => employee.managerId === manager.id);
    return {
      name: `${manager.name} team`,
      values: quarters.map((item) =>
        averageForGoals(
          state.goals.filter((goal) => team.some((member) => member.id === goal.employeeId)),
          item,
        ),
      ),
    };
  });
  const byThrust = Object.values(
    state.goals.reduce<Record<string, { name: string; value: number }>>((acc, goal) => {
      acc[goal.thrustArea] = acc[goal.thrustArea] ?? { name: goal.thrustArea, value: 0 };
      acc[goal.thrustArea].value += 1;
      return acc;
    }, {}),
  );
  const byUom = Object.values(
    state.goals.reduce<Record<string, { name: string; value: number }>>((acc, goal) => {
      acc[goal.uomType] = acc[goal.uomType] ?? { name: goal.uomType, value: 0 };
      acc[goal.uomType].value += 1;
      return acc;
    }, {}),
  );
  const byStatus = Object.values(
    state.goals.reduce<Record<string, { name: string; value: number }>>((acc, goal) => {
      acc[goal.status] = acc[goal.status] ?? { name: goal.status, value: 0 };
      acc[goal.status].value += 1;
      return acc;
    }, {}),
  );
  const heatmapRows = employees.map((employee) => {
    const goals = state.goals.filter((goal) => goal.employeeId === employee.id);
    const approvedGoals = goals.filter((goal) => goal.status === "Approved");
    const goalSheetStatus = goals.some((goal) => goal.status === "Approved")
      ? "Approved"
      : goals.some((goal) => goal.status === "Submitted")
        ? "Submitted"
        : goals.length > 0
          ? "Draft"
          : "Missing";
    const quarterCells = quarters.map((item) => {
      const updatesDone = approvedGoals.filter((goal) =>
        state.updates.some((update) => update.goalId === goal.id && update.quarter === item),
      ).length;
      const updateRate = approvedGoals.length === 0 ? 0 : Math.round((updatesDone / approvedGoals.length) * 100);
      const checkInDone = state.checkIns.some((checkIn) => checkIn.employeeId === employee.id && checkIn.quarter === item);
      return {
        quarter: item,
        label: approvedGoals.length === 0 ? "N/A" : `${updateRate}%${checkInDone ? " + CI" : ""}`,
        tone: (approvedGoals.length === 0
          ? "neutral"
          : updateRate === 100 && checkInDone
            ? "good"
            : updateRate > 0
              ? "warn"
              : "bad") as "good" | "warn" | "bad" | "neutral",
      };
    });
    return { employee, goalSheetStatus, quarterCells };
  });
  const checkInRows = employees.map((employee) => ({
    name: employee.name,
    completed: state.checkIns.filter((checkIn) => checkIn.employeeId === employee.id).length,
  }));
  const managerRows = managers.map((manager) => {
    const team = employees.filter((user) => user.managerId === manager.id);
    const expected = Math.max(team.length * quarters.length, 1);
    const completed = state.checkIns.filter((checkIn) => checkIn.managerId === manager.id).length;
    return {
      name: manager.name,
      teamSize: team.length,
      completed,
      rate: Math.round((completed / expected) * 100),
    };
  });

  const lockEscalationRules = async () => {
    setEscalationRunStatus("Locking rules and starting automatic escalation check...");
    try {
      const response = await fetch("/api/cron/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(escalationConfig),
      });
      const result = (await response.json()) as { generated?: number; sent?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not lock escalation rules.");
      setEscalationRulesLocked(true);
      setEscalationRunStatus(
        `Rules locked. Automatic check found ${result.generated ?? 0} overdue case${result.generated === 1 ? "" : "s"} and sent ${result.sent ?? 0} notification${result.sent === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setEscalationRunStatus(error instanceof Error ? error.message : "Escalation rule lock failed.");
    }
  };

  const updateEscalationConfig = (patch: Partial<EscalationConfig>) => {
    if (escalationRulesLocked) return;
    setEscalationConfig({ ...escalationConfig, ...patch });
    setEscalationRunStatus("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Achievement Report" actions={<button className="primary-button" onClick={exportCsv}><Download size={17} /> CSV</button>}>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th>Employee</th><th>Goal</th><th>Actuals</th><th>Score</th></tr></thead>
            <tbody>
              {state.goals.map((goal) => {
                const employee = state.users.find((user) => user.id === goal.employeeId);
                const updates = state.updates.filter((update) => update.goalId === goal.id);
                return <tr key={goal.id}><td>{employee?.name}</td><td>{goal.title}</td><td>{updates.length}</td><td>{updates[0]?.progressScore ?? "-"} </td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="QoQ Achievement Trend">
        <div className="chart-bars">
          {qoqRows.map((row) => (
            <div className="chart-row" key={row.quarter}>
              <span>{row.quarter}</span>
              <div className="bar-track wide">
                <div className="bar-fill-blue" style={{ width: barWidth(row.averageScore) }} />
              </div>
              <strong>{row.averageScore}%</strong>
            </div>
          ))}
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Quarter</th><th>Updated Goals</th><th>Completed Statuses</th></tr></thead>
              <tbody>
                {qoqRows.map((row) => (
                  <tr key={row.quarter}><td>{row.quarter}</td><td>{row.updatedGoals}</td><td>{row.completed}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
      <Panel title="QoQ Drilldown">
        <div className="grid gap-5 xl:grid-cols-3">
          <TrendTable title="Individual" rows={individualTrendRows} />
          <TrendTable title="Team" rows={teamTrendRows} />
          <TrendTable title="Department" rows={departmentTrendRows} />
        </div>
      </Panel>
      <Panel title="Goal Distribution">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">By Thrust Area</p>
            <div className="space-y-3">
              {byThrust.map((item, index) => (
                <div className="distribution-row" key={item.name}>
                  <span className="distribution-dot" style={{ background: palette[index % palette.length] }} />
                  <span className="flex-1">{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">By UoM</p>
            <div className="space-y-3">
              {byUom.map((item, index) => (
                <div className="distribution-row" key={item.name}>
                  <span className="distribution-dot" style={{ background: palette[(index + 2) % palette.length] }} />
                  <span className="flex-1">{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">By Status</p>
            <div className="space-y-3">
              {byStatus.map((item, index) => (
                <div className="distribution-row" key={item.name}>
                  <span className="distribution-dot" style={{ background: palette[(index + 3) % palette.length] }} />
                  <span className="flex-1">{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Completion Heatmap">
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th>Employee</th><th>Goal Sheet</th>{quarters.map((item) => <th key={item}>{item}</th>)}</tr></thead>
            <tbody>
              {heatmapRows.map((row) => (
                <tr key={row.employee.id}>
                  <td>{row.employee.name}</td>
                  <td><HeatmapCell label={row.goalSheetStatus} tone={row.goalSheetStatus === "Approved" ? "good" : row.goalSheetStatus === "Submitted" ? "warn" : "bad"} /></td>
                  {row.quarterCells.map((cell) => (
                    <td key={cell.quarter}><HeatmapCell label={cell.label} tone={cell.tone} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Check-in Completion">
        <div className="chart-bars">
          {checkInRows.map((row) => (
            <div className="chart-row" key={row.name}>
              <span>{row.name}</span>
              <div className="bar-track wide">
                <div className="bar-fill-green" style={{ width: barWidth(Math.round((row.completed / quarters.length) * 100)) }} />
              </div>
              <strong>{row.completed}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Manager Effectiveness">
        <div className="chart-bars">
          {managerRows.map((row) => (
            <div className="chart-row" key={row.name}>
              <span>{row.name.split(" ")[0]}</span>
              <div className="bar-track wide">
                <div className="bar-fill-green" style={{ width: barWidth(row.rate) }} />
              </div>
              <strong>{row.rate}%</strong>
              <p className="col-span-3 text-xs text-slate-500">
                {row.completed} completed check-ins across {row.teamSize} team member{row.teamSize === 1 ? "" : "s"}
              </p>
            </div>
          ))}
          {managerRows.length === 0 && <Empty text="No managers exist yet." />}
        </div>
      </Panel>
      <Panel title="Rule-Based Escalation Log">
        <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Configurable Escalation Rules</p>
            <span className={classNames("status-badge", escalationRulesLocked ? "status-approved" : "status-draft")}>
              {escalationRulesLocked ? "Rules locked" : "Editable"}
            </span>
          </div>
          <div className="form-grid">
            <Field label="Employee Submission N Days">
              <input
                type="number"
                min={0}
                disabled={escalationRulesLocked}
                value={escalationConfig.employeeSubmissionDays}
                onChange={(event) =>
                  updateEscalationConfig({ employeeSubmissionDays: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Manager Approval N Days">
              <input
                type="number"
                min={0}
                disabled={escalationRulesLocked}
                value={escalationConfig.managerApprovalDays}
                onChange={(event) =>
                  updateEscalationConfig({ managerApprovalDays: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Quarterly Check-in N Days">
              <input
                type="number"
                min={0}
                disabled={escalationRulesLocked}
                value={escalationConfig.quarterlyCheckInDays}
                onChange={(event) =>
                  updateEscalationConfig({ quarterlyCheckInDays: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Notify Manager After">
              <input
                type="number"
                min={0}
                disabled={escalationRulesLocked}
                value={escalationConfig.managerNotifyAfterDays}
                onChange={(event) =>
                  updateEscalationConfig({ managerNotifyAfterDays: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Notify HR After">
              <input
                type="number"
                min={0}
                disabled={escalationRulesLocked}
                value={escalationConfig.hrNotifyAfterDays}
                onChange={(event) =>
                  updateEscalationConfig({ hrNotifyAfterDays: Number(event.target.value) })
                }
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={escalationRulesLocked ? "secondary-button" : "primary-button"}
              onClick={() => (escalationRulesLocked ? setEscalationRulesLocked(false) : lockEscalationRules())}
            >
              <Lock size={16} /> {escalationRulesLocked ? "Unlock rules" : "Lock rules"}
            </button>
          </div>
          {escalationRunStatus && <p className="mt-3 text-sm font-semibold text-slate-700">{escalationRunStatus}</p>}
          <p className="mt-3 text-xs text-slate-600">
            Locking rules starts the automatic escalation engine with these exact values. Set days to 0 for a live demo, or increase N days for stricter company policy.
          </p>
        </div>
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Active rule set: {state.cycle.phase === "Goal Setting" ? "goal submission and L1 approval" : activeQuarter ? `${activeQuarter} achievement and check-in completion` : "cycle closed"}.
        </div>
        <div className="space-y-3">
          {escalations.map((item) => (
            <div className="alert items-start" key={item.id}>
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{item.type}</strong>
                  <span className="status-badge">Level {item.level}</span>
                  <span className="status-badge">{item.chainStage}</span>
                </div>
                <p>{item.message}</p>
                <p className="text-xs text-slate-600">
                  Owner: {item.owner} | Trigger: {item.ageDays} day{item.ageDays === 1 ? "" : "s"} old / N={item.dueAfterDays}
                </p>
                <p className="text-xs text-slate-600">Auto-notification chain: {item.notifications.join(" -> ")}</p>
                <p className="text-xs text-slate-600">Resolution: {item.nextAction}</p>
              </div>
            </div>
          ))}
          {escalations.length === 0 && <Empty text="No active escalations for the current cycle phase." />}
        </div>
      </Panel>
    </div>
  );
}

function TrendTable({ title, rows }: { title: string; rows: { name: string; values: number[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
      <table>
        <thead><tr><th>Name</th>{quarters.map((item) => <th key={item}>{item}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              {row.values.map((value, index) => <td key={`${row.name}-${quarters[index]}`}>{value}%</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>No data yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function HeatmapCell({ label, tone }: { label: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = {
    good: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    bad: "bg-rose-100 text-rose-800",
    neutral: "bg-slate-100 text-slate-600",
  }[tone];
  return <span className={classNames("inline-flex rounded-md px-2 py-1 text-xs font-bold", toneClass)}>{label}</span>;
}

function AuditTrail({ logs }: { logs: AuditLog[] }) {
  return (
    <Panel title="Audit Trail">
      <table>
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.actor}</td>
              <td>{log.action}</td>
              <td>{log.entity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ValidationBox({ validation }: { validation: ReturnType<typeof validateGoals> }) {
  return (
    <div className={classNames("mb-4 rounded-md border p-3 text-sm", validation.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
      {validation.ok ? (
        <span className="flex items-center gap-2"><CheckCircle2 size={16} /> BRD validations passed. Total weightage: {validation.total}%.</span>
      ) : (
        <ul className="list-inside list-disc space-y-1">
          {validation.messages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      )}
    </div>
  );
}

function EmployeeSelect({ team, value, onChange }: { team: User[]; value: string; onChange: (id: string) => void }) {
  return (
    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {team.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
    </select>
  );
}

function QuarterSelect({ quarter, setQuarter }: { quarter: Quarter; setQuarter: (quarter: Quarter) => void }) {
  return (
    <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={quarter} onChange={(e) => setQuarter(e.target.value as Quarter)}>
      {quarters.map((item) => <option key={item}>{item}</option>)}
    </select>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">{text}</div>;
}

function LoginScreen({
  mode,
  name,
  email,
  password,
  role,
  department,
  managerEmail,
  error,
  isLoading,
  setMode,
  setName,
  setEmail,
  setPassword,
  setRole,
  setDepartment,
  setManagerEmail,
  login,
  ssoConfigured,
  startMicrosoftSso,
}: {
  mode: "login" | "signup";
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  managerEmail: string;
  error: string;
  isLoading: boolean;
  setMode: (mode: "login" | "signup") => void;
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setRole: (role: Role) => void;
  setDepartment: (department: string) => void;
  setManagerEmail: (email: string) => void;
  login: () => void;
  ssoConfigured: boolean;
  startMicrosoftSso: () => void;
}) {
  const canSubmit =
    mode === "login"
      ? Boolean(email && password)
      : Boolean(name && email && password && role && department && (role !== "Employee" || managerEmail));

  return (
    <section className="login-shell">
      <div className="login-panel">
        <p className="eyebrow">WorkSphere</p>
        <h1>Goal Setting & Tracking Portal</h1>
        <p className="muted">Create an account or sign in with your existing workplace credentials.</p>

        {ssoConfigured && (
          <>
            <button className="microsoft-sso-button mt-5" onClick={startMicrosoftSso}>
              <span className="microsoft-logo" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span>Sign in with Microsoft</span>
            </button>
            <div className="sso-divider"><span>or use portal credentials</span></div>
          </>
        )}

        <div className="auth-tabs">
          <button className={classNames(mode === "login" && "auth-tab-active")} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={classNames(mode === "signup" && "auth-tab-active")} onClick={() => setMode("signup")}>
            Sign up
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          {mode === "signup" && (
            <>
              <Field label="Full Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                />
              </Field>
              <div className="form-grid">
                <Field label="Role">
                  <select
                    value={role}
                    onChange={(event) => {
                      const nextRole = event.target.value as Role;
                      setRole(nextRole);
                      if (nextRole !== "Employee") setManagerEmail("");
                    }}
                  >
                    <option>Employee</option>
                    <option>Manager</option>
                    <option>Admin</option>
                  </select>
                </Field>
                <Field label="Department">
                  <input value={department} onChange={(event) => setDepartment(event.target.value)} />
                </Field>
              </div>
              {role === "Employee" && (
                <Field label="Manager Email">
                  <>
                    <input
                      value={managerEmail}
                      onChange={(event) => setManagerEmail(event.target.value)}
                      placeholder="manager@company.com"
                      autoComplete="email"
                    />
                    <p className="text-xs text-slate-500">Employee signup links this account to an existing manager.</p>
                  </>
                </Field>
              )}
            </>
          )}
          <Field label="Email">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) login();
              }}
              placeholder={mode === "login" ? "Enter password" : "Create password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </Field>
          {error && <div className="alert">{error}</div>}
          <button className="primary-button" disabled={isLoading || !canSubmit} onClick={login}>
            {isLoading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmationDialog({
  confirmation,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <h2 id="confirmation-title" className="text-lg font-semibold">
          {confirmation.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{confirmation.message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={classNames("primary-button", confirmation.tone === "danger" && "danger-button")}
            onClick={onConfirm}
          >
            {confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

// Custom video grid component that shows all participants in a grid
function MyVideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <GridLayout tracks={tracks} style={{ flex: 1 }}>
        <ParticipantTile />
      </GridLayout>
      <div style={{ padding: "8px", display: "flex", justifyContent: "center" }}>
        <ControlBar />
      </div>
    </div>
  );
}

function MeetingsView({
  meetings,
  activeUser,
  activeMeetingId,
  setActiveMeetingId,
  meetingMessages,
  meetingChatInput,
  setMeetingChatInput,
  isCreatingMeeting,
  setIsCreatingMeeting,
  newMeetingTitle,
  setNewMeetingTitle,
  newMeetingAgenda,
  setNewMeetingAgenda,
  newMeetingDate,
  setNewMeetingDate,
  selectedParticipantIds,
  setSelectedParticipantIds,
  availableParticipants,
  meetingError,
  createMeeting,
  updateMeetingStatus,
  sendMeetingMessage,
  attachDocument,
  loadMeetings,
  livekitToken,
  livekitWsUrl,
  livekitRoomName,
  isLoadingVideo,
  videoError,
  loadLiveKitToken,
}: {
  meetings: Meeting[];
  activeUser: User;
  activeMeetingId: string | null;
  setActiveMeetingId: (id: string | null) => void;
  meetingMessages: MeetingMessage[];
  meetingChatInput: string;
  setMeetingChatInput: (value: string) => void;
  isCreatingMeeting: boolean;
  setIsCreatingMeeting: (value: boolean) => void;
  newMeetingTitle: string;
  setNewMeetingTitle: (value: string) => void;
  newMeetingAgenda: string;
  setNewMeetingAgenda: (value: string) => void;
  newMeetingDate: string;
  setNewMeetingDate: (value: string) => void;
  selectedParticipantIds: string[];
  setSelectedParticipantIds: (ids: string[]) => void;
  availableParticipants: User[];
  meetingError: string;
  createMeeting: () => void;
  updateMeetingStatus: (meetingId: string, action: "start" | "join" | "leave" | "end" | "cancel") => void;
  sendMeetingMessage: (meetingId: string) => void;
  attachDocument: (meetingId: string, title: string, fileUrl: string) => void;
  loadMeetings: () => void;
  livekitToken: string | null;
  livekitWsUrl: string | null;
  livekitRoomName: string | null;
  isLoadingVideo: boolean;
  videoError: string | null;
  loadLiveKitToken: (meetingId: string) => Promise<void>;
}) {
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const activeMeeting = meetings.find((m) => m.id === activeMeetingId);
  const isHost = activeUser.role === "Manager" && activeMeeting?.hostId === activeUser.id;
  const userParticipant = activeMeeting?.participants.find((p) => p.userId === activeUser.id);
  const isJoined = userParticipant?.status === "JOINED";
  const canShowVideo = activeMeeting?.status === "LIVE" && isJoined && livekitToken && livekitWsUrl && livekitRoomName;

  if (activeMeetingId && activeMeeting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button className="secondary-button" onClick={() => setActiveMeetingId(null)}>
            ← Back to meetings
          </button>
          <div className="flex gap-2">
            <button
              className="secondary-button"
              onClick={loadMeetings}
              title="Refresh meeting data"
            >
              <RotateCcw size={16} /> Refresh
            </button>
          </div>
        </div>

        <Panel title={activeMeeting.title}>
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <span className={classNames(
                "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                activeMeeting.status === "SCHEDULED" && "bg-blue-50 text-blue-700",
                activeMeeting.status === "LIVE" && "bg-green-50 text-green-700",
                activeMeeting.status === "ENDED" && "bg-slate-50 text-slate-700",
                activeMeeting.status === "CANCELLED" && "bg-red-50 text-red-700"
              )}>
                {activeMeeting.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Host</p>
              <p className="text-sm font-medium">{activeMeeting.hostName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Scheduled</p>
              <p className="text-sm font-medium">
                {new Date(activeMeeting.scheduledAt).toLocaleString()}
              </p>
            </div>
          </div>

          {activeMeeting.agenda && (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Agenda</p>
              <p className="text-sm text-slate-700">{activeMeeting.agenda}</p>
            </div>
          )}

          <div className="mb-4 flex gap-2">
            {isHost && activeMeeting.status === "SCHEDULED" && (
              <button
                className="primary-button"
                onClick={() => updateMeetingStatus(activeMeeting.id, "start")}
              >
                <Video size={16} /> Start Meeting
              </button>
            )}
            {!isHost && activeMeeting.status === "SCHEDULED" && (
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                Meeting is scheduled. Waiting for host to start.
              </div>
            )}
            {activeMeeting.status === "LIVE" && userParticipant?.status !== "JOINED" && (
              <button
                className="primary-button"
                onClick={() => updateMeetingStatus(activeMeeting.id, "join")}
              >
                <Video size={16} /> Join Meeting
              </button>
            )}
            {activeMeeting.status === "LIVE" && userParticipant?.status === "JOINED" && (
              <button
                className="secondary-button"
                onClick={() => updateMeetingStatus(activeMeeting.id, "leave")}
              >
                Leave Meeting
              </button>
            )}
            {isHost && activeMeeting.status === "LIVE" && (
              <button
                className="danger-button"
                onClick={() => updateMeetingStatus(activeMeeting.id, "end")}
              >
                End Meeting
              </button>
            )}
            {activeMeeting.status === "ENDED" && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Meeting ended at {activeMeeting.endedAt ? new Date(activeMeeting.endedAt).toLocaleString() : "unknown"}
              </div>
            )}
          </div>

          {meetingError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {meetingError}
            </div>
          )}

          {videoError && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Video unavailable:</strong> {videoError}
            </div>
          )}

          {/* Debug: Show video status */}
          {activeMeeting.status === "LIVE" && isJoined && (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <strong>Video Status:</strong>
              <div>Meeting LIVE: ✅</div>
              <div>User Joined: ✅</div>
              <div>LiveKit Token: {livekitToken ? "✅" : "❌ Missing"}</div>
              <div>LiveKit URL: {livekitWsUrl ? "✅" : "❌ Missing"}</div>
              <div>Room Name: {livekitRoomName ? "✅" : "❌ Missing"}</div>
              <div>Can Show Video: {canShowVideo ? "✅ YES" : "❌ NO"}</div>
              {!livekitToken && (
                <button
                  className="mt-2 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                  onClick={() => loadLiveKitToken(activeMeeting.id)}
                >
                  🔄 Manually Load Video Token
                </button>
              )}
            </div>
          )}

          {isLoadingVideo && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              Loading video room...
            </div>
          )}

          {/* Video Room Section */}
          {canShowVideo && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Video size={16} /> Live Video Room
              </h3>
              <div className="rounded-lg overflow-hidden bg-slate-900" style={{ height: "500px" }}>
                <LiveKitRoom
                  token={livekitToken}
                  serverUrl={livekitWsUrl}
                  connect={true}
                  video={true}
                  audio={true}
                  style={{ height: "100%" }}
                  options={{
                    adaptiveStream: true,
                    dynacast: true,
                  }}
                >
                  <MyVideoGrid />
                  <RoomAudioRenderer />
                </LiveKitRoom>
              </div>
            </div>
          )}

          {/* Participants Section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users size={16} /> Participants ({activeMeeting.participants.length})
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {activeMeeting.participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{participant.name}</p>
                    <p className="text-xs text-slate-500">{participant.email}</p>
                  </div>
                  <span
                    className={classNames(
                      "rounded-full px-2 py-1 text-xs",
                      participant.status === "INVITED" && "bg-slate-100 text-slate-600",
                      participant.status === "JOINED" && "bg-green-100 text-green-700",
                      participant.status === "LEFT" && "bg-slate-100 text-slate-500"
                    )}
                  >
                    {participant.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText size={16} /> Documents ({activeMeeting.documents.length})
            </h3>
            {isJoined && activeMeeting.status !== "ENDED" && activeMeeting.status !== "CANCELLED" && (
              <div className="mb-2 grid gap-2 md:grid-cols-3">
                <input
                  placeholder="Document title"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
                <input
                  placeholder="https://docs.example.com/file"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                />
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (docTitle.trim() && docUrl.trim()) {
                      attachDocument(activeMeeting.id, docTitle.trim(), docUrl.trim());
                      setDocTitle("");
                      setDocUrl("");
                    }
                  }}
                >
                  <Plus size={16} /> Attach
                </button>
              </div>
            )}
            <div className="space-y-2">
              {activeMeeting.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-slate-400" />
                    <div>
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(doc.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Open →
                  </a>
                </div>
              ))}
              {activeMeeting.documents.length === 0 && (
                <div className="text-sm text-slate-500">No documents attached yet</div>
              )}
            </div>
          </div>

          {/* Chat Section */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MessageSquare size={16} /> Meeting Chat
            </h3>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 max-h-64 overflow-y-auto mb-2">
              {meetingMessages.length === 0 && (
                <div className="text-sm text-slate-500">No messages yet</div>
              )}
              {meetingMessages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <p className="text-xs text-slate-500">
                    {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-slate-900">{msg.body}</p>
                </div>
              ))}
            </div>
            {activeMeeting.status !== "ENDED" && activeMeeting.status !== "CANCELLED" && (
              <div className="flex gap-2">
                <input
                  placeholder="Type a message..."
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={meetingChatInput}
                  onChange={(e) => setMeetingChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && meetingChatInput.trim()) {
                      sendMeetingMessage(activeMeeting.id);
                    }
                  }}
                />
                <button
                  className="primary-button"
                  onClick={() => sendMeetingMessage(activeMeeting.id)}
                  disabled={!meetingChatInput.trim()}
                >
                  <Send size={16} /> Send
                </button>
              </div>
            )}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <Panel
      title="Meetings"
      actions={
        activeUser.role === "Manager" && (
          <button
            className="primary-button"
            onClick={() => setIsCreatingMeeting(true)}
          >
            <Plus size={16} /> Schedule Meeting
          </button>
        )
      }
    >
      {meetingError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {meetingError}
        </div>
      )}

      {isCreatingMeeting && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold mb-3">Schedule New Meeting</h3>
          <div className="grid gap-3">
            <Field label="Meeting Title">
              <input
                placeholder="Q1 Goal Check-in"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
              />
            </Field>
            <Field label="Agenda (Optional)">
              <textarea
                placeholder="Review Q1 progress, discuss blockers..."
                value={newMeetingAgenda}
                onChange={(e) => setNewMeetingAgenda(e.target.value)}
                rows={3}
              />
            </Field>
            <Field label="Scheduled Date & Time">
              <input
                type="datetime-local"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
              />
            </Field>
            <Field label="Participants">
              <>
                <div className="space-y-2">
                  {availableParticipants.map((participant) => (
                    <label key={participant.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedParticipantIds.includes(participant.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipantIds([...selectedParticipantIds, participant.id]);
                          } else {
                            setSelectedParticipantIds(
                              selectedParticipantIds.filter((id) => id !== participant.id)
                            );
                          }
                        }}
                      />
                      <span className="text-sm">{participant.name}</span>
                    </label>
                  ))}
                  {availableParticipants.length === 0 && (
                    <div className="text-sm text-slate-500">No team members available</div>
                  )}
                </div>
              </>
            </Field>
            <div className="flex gap-2">
              <button className="primary-button" onClick={createMeeting}>
                <Calendar size={16} /> Create Meeting
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setIsCreatingMeeting(false);
                  setNewMeetingTitle("");
                  setNewMeetingAgenda("");
                  setNewMeetingDate("");
                  setSelectedParticipantIds([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {meetings.length === 0 && (
          <Empty text="No meetings scheduled yet" />
        )}
        {meetings.map((meeting) => {
          const userParticipant = meeting.participants.find((p) => p.userId === activeUser.id);
          const isUserHost = meeting.hostId === activeUser.id;

          return (
            <div
              key={meeting.id}
              className="rounded-md border border-slate-200 p-4 hover:border-blue-300 cursor-pointer transition-colors"
              onClick={() => setActiveMeetingId(meeting.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{meeting.title}</h3>
                  <p className="text-sm text-slate-600">
                    Host: {meeting.hostName} • {new Date(meeting.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={classNames(
                    "rounded-full px-2 py-1 text-xs font-medium",
                    meeting.status === "SCHEDULED" && "bg-blue-50 text-blue-700",
                    meeting.status === "LIVE" && "bg-green-50 text-green-700",
                    meeting.status === "ENDED" && "bg-slate-50 text-slate-700"
                  )}
                >
                  {meeting.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users size={12} /> {meeting.participantCount} participants
                </span>
                {userParticipant && (
                  <span className="flex items-center gap-1">
                    You: {userParticipant.status}
                  </span>
                )}
                {isUserHost && (
                  <span className="text-blue-600 font-medium">Host</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function AdminLiveMeetings({
  meetings,
  activeMeetingId,
  setActiveMeetingId,
  meetingError,
  updateMeetingStatus,
  loadMeetings,
}: {
  meetings: Meeting[];
  activeMeetingId: string | null;
  setActiveMeetingId: (id: string | null) => void;
  meetingError: string;
  updateMeetingStatus: (meetingId: string, action: "start" | "join" | "leave" | "end" | "cancel") => void;
  loadMeetings: () => void;
}) {
  const [filterStatus, setFilterStatus] = useState<MeetingStatus | "ALL">("ALL");
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");

  const activeMeeting = meetings.find((m) => m.id === activeMeetingId);
  const departments = ["ALL", ...new Set(meetings.map((m) => m.department))];

  const filteredMeetings = meetings.filter((meeting) => {
    if (filterStatus !== "ALL" && meeting.status !== filterStatus) return false;
    if (filterDepartment !== "ALL" && meeting.department !== filterDepartment) return false;
    return true;
  });

  const liveMeetings = meetings.filter((m) => m.status === "LIVE");
  const scheduledMeetings = meetings.filter((m) => m.status === "SCHEDULED");

  if (activeMeetingId && activeMeeting) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button className="secondary-button" onClick={() => setActiveMeetingId(null)}>
            ← Back to live meetings
          </button>
          <button className="secondary-button" onClick={loadMeetings}>
            <RotateCcw size={16} /> Refresh
          </button>
        </div>

        <Panel title={`${activeMeeting.title} (Admin View)`}>
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <span
                className={classNames(
                  "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                  activeMeeting.status === "SCHEDULED" && "bg-blue-50 text-blue-700",
                  activeMeeting.status === "LIVE" && "bg-green-50 text-green-700",
                  activeMeeting.status === "ENDED" && "bg-slate-50 text-slate-700"
                )}
              >
                {activeMeeting.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Host</p>
              <p className="text-sm font-medium">{activeMeeting.hostName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Department</p>
              <p className="text-sm font-medium">{activeMeeting.department}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Participants</p>
              <p className="text-sm font-medium">{activeMeeting.participants.length}</p>
            </div>
          </div>

          {activeMeeting.status === "LIVE" && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                <Clock size={14} className="inline mr-1" />
                Meeting started:{" "}
                {activeMeeting.startedAt
                  ? new Date(activeMeeting.startedAt).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Participants</h3>
            <div className="space-y-2">
              {activeMeeting.participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center justify-between rounded-md border border-slate-200 p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{participant.name}</p>
                    <p className="text-xs text-slate-500">{participant.role}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={classNames(
                        "rounded-full px-2 py-1 text-xs",
                        participant.status === "INVITED" && "bg-slate-100 text-slate-600",
                        participant.status === "JOINED" && "bg-green-100 text-green-700",
                        participant.status === "LEFT" && "bg-slate-100 text-slate-500"
                      )}
                    >
                      {participant.status}
                    </span>
                    {participant.joinedAt && (
                      <p className="text-xs text-slate-500 mt-1">
                        Joined: {new Date(participant.joinedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Documents ({activeMeeting.documents.length})</h3>
            {activeMeeting.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-md border border-slate-200 p-2 mb-2"
              >
                <div>
                  <p className="text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(doc.createdAt).toLocaleString()}
                  </p>
                </div>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Open →
                </a>
              </div>
            ))}
            {activeMeeting.documents.length === 0 && (
              <div className="text-sm text-slate-500">No documents attached</div>
            )}
          </div>

          {activeMeeting.status === "LIVE" && (
            <button
              className="danger-button"
              onClick={() => updateMeetingStatus(activeMeeting.id, "end")}
            >
              End Meeting (Admin)
            </button>
          )}
        </Panel>
      </div>
    );
  }

  return (
    <Panel
      title="Live Meetings Dashboard"
      actions={
        <button className="secondary-button" onClick={loadMeetings}>
          <RotateCcw size={16} /> Refresh
        </button>
      }
    >
      {meetingError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {meetingError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Metric
          icon={<Video size={19} />}
          label="Live Meetings"
          value={liveMeetings.length}
        />
        <Metric
          icon={<Calendar size={19} />}
          label="Scheduled"
          value={scheduledMeetings.length}
        />
        <Metric
          icon={<Users size={19} />}
          label="Total Meetings"
          value={meetings.length}
        />
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <Field label="Filter by Status">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MeetingStatus | "ALL")}
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="LIVE">Live</option>
            <option value="ENDED">Ended</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>
        <Field label="Filter by Department">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
          >
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept === "ALL" ? "All Departments" : dept}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        {filteredMeetings.length === 0 && (
          <Empty text="No meetings match the selected filters" />
        )}
        {filteredMeetings.map((meeting) => {
          const duration =
            meeting.status === "LIVE" && meeting.startedAt
              ? Math.floor(
                  (new Date().getTime() - new Date(meeting.startedAt).getTime()) / 60000
                )
              : 0;

          return (
            <div
              key={meeting.id}
              className="rounded-md border border-slate-200 p-4 hover:border-blue-300 cursor-pointer transition-colors"
              onClick={() => setActiveMeetingId(meeting.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{meeting.title}</h3>
                  <p className="text-sm text-slate-600">
                    {meeting.hostName} • {meeting.department}
                  </p>
                </div>
                <span
                  className={classNames(
                    "rounded-full px-2 py-1 text-xs font-medium",
                    meeting.status === "SCHEDULED" && "bg-blue-50 text-blue-700",
                    meeting.status === "LIVE" && "bg-green-50 text-green-700",
                    meeting.status === "ENDED" && "bg-slate-50 text-slate-700"
                  )}
                >
                  {meeting.status}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-4 text-xs text-slate-500">
                <div>
                  <p className="font-medium text-slate-700">Scheduled</p>
                  <p>{new Date(meeting.scheduledAt).toLocaleString()}</p>
                </div>
                {meeting.status === "LIVE" && duration > 0 && (
                  <div>
                    <p className="font-medium text-slate-700">Duration</p>
                    <p>{duration} min</p>
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-700">Participants</p>
                  <p>
                    {meeting.participants.filter((p) => p.status === "JOINED").length} /{" "}
                    {meeting.participants.length}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">Documents</p>
                  <p>{meeting.documents.length}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

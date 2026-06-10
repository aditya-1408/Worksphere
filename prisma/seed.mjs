import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$transaction([
    prisma.escalationLog.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.quarterlyUpdate.deleteMany(),
    prisma.goalSubmission.deleteMany(),
    prisma.goal.deleteMany(),
    prisma.sharedGoal.deleteMany(),
    prisma.cycle.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const admin = await prisma.user.create({
    data: {
      id: "u-admin",
      name: "Ananya HR",
      email: "admin@worksphere.demo",
      role: "ADMIN",
      department: "People Success",
    },
  });

  const manager = await prisma.user.create({
    data: {
      id: "u-manager",
      name: "Rohan Mehta",
      email: "manager@worksphere.demo",
      role: "MANAGER",
      department: "Operations",
    },
  });

  const priya = await prisma.user.create({
    data: {
      id: "u-employee",
      name: "Priya Shah",
      email: "employee@worksphere.demo",
      role: "EMPLOYEE",
      department: "Operations",
      managerId: manager.id,
    },
  });

  const karan = await prisma.user.create({
    data: {
      id: "u-employee-2",
      name: "Karan Iyer",
      email: "employee2@worksphere.demo",
      role: "EMPLOYEE",
      department: "Operations",
      managerId: manager.id,
    },
  });

  const cycle = await prisma.cycle.create({
    data: {
      id: "cycle-fy-2026",
      name: "FY 2026-27 Goal Cycle",
      year: 2026,
      phase: "Q1_CHECK_IN",
      goalSettingOpenDate: new Date("2026-05-01"),
      q1OpenDate: new Date("2026-07-01"),
      q2OpenDate: new Date("2026-10-01"),
      q3OpenDate: new Date("2027-01-01"),
      q4OpenDate: new Date("2027-03-01"),
    },
  });

  const sharedGoal = await prisma.sharedGoal.create({
    data: {
      id: "sg-1",
      ownerId: priya.id,
      cycleId: cycle.id,
      department: "Operations",
      thrustArea: "Department KPI",
      title: "Department service SLA compliance",
      description: "Maintain SLA adherence across assigned operational queues.",
      uomType: "PERCENTAGE",
      direction: "MIN",
      targetValue: 95,
      targetDate: new Date("2026-07-31"),
    },
  });

  await prisma.goal.createMany({
    data: [
      {
        id: "g-1",
        employeeId: priya.id,
        cycleId: cycle.id,
        thrustArea: "Business Growth",
        title: "Improve service closure rate",
        description: "Increase first-time-right closures for assigned service tickets.",
        uomType: "PERCENTAGE",
        direction: "MIN",
        targetValue: 92,
        targetDate: new Date("2026-07-31"),
        weightage: 35,
        status: "APPROVED",
        isLocked: true,
      },
      {
        id: "g-2",
        employeeId: priya.id,
        cycleId: cycle.id,
        thrustArea: "Customer Experience",
        title: "Reduce customer escalation TAT",
        description: "Lower average closure time for escalated requests.",
        uomType: "NUMERIC",
        direction: "MAX",
        targetValue: 24,
        targetDate: new Date("2026-07-31"),
        weightage: 25,
        status: "APPROVED",
        isLocked: true,
      },
      {
        id: "g-3",
        employeeId: priya.id,
        cycleId: cycle.id,
        thrustArea: "Quality",
        title: "Maintain zero safety incidents",
        description: "Ensure process discipline and report unsafe conditions.",
        uomType: "ZERO",
        direction: "MAX",
        targetValue: 0,
        targetDate: new Date("2026-07-31"),
        weightage: 30,
        status: "APPROVED",
        isLocked: true,
      },
      {
        id: "g-4",
        employeeId: karan.id,
        cycleId: cycle.id,
        thrustArea: "Business Growth",
        title: "Launch dealer onboarding tracker",
        description: "Create and roll out a tracker for top-priority dealer onboarding.",
        uomType: "TIMELINE",
        direction: "MIN",
        targetValue: 100,
        targetDate: new Date("2026-07-31"),
        weightage: 50,
        status: "SUBMITTED",
        isLocked: false,
      },
      {
        id: "g-5",
        employeeId: karan.id,
        cycleId: cycle.id,
        thrustArea: "Customer Experience",
        title: "Improve monthly NPS follow-up coverage",
        description: "Call back detractors and close feedback loops within defined time.",
        uomType: "PERCENTAGE",
        direction: "MIN",
        targetValue: 95,
        targetDate: new Date("2026-07-31"),
        weightage: 40,
        status: "SUBMITTED",
        isLocked: false,
      },
      {
        id: "g-shared-1-primary",
        employeeId: priya.id,
        cycleId: cycle.id,
        sharedGoalId: sharedGoal.id,
        thrustArea: sharedGoal.thrustArea,
        title: sharedGoal.title,
        description: sharedGoal.description,
        uomType: sharedGoal.uomType,
        direction: sharedGoal.direction,
        targetValue: sharedGoal.targetValue,
        targetDate: sharedGoal.targetDate,
        weightage: 10,
        status: "APPROVED",
        isLocked: true,
        primaryOwner: true,
      },
      {
        id: "g-shared-1-recipient",
        employeeId: karan.id,
        cycleId: cycle.id,
        sharedGoalId: sharedGoal.id,
        thrustArea: sharedGoal.thrustArea,
        title: sharedGoal.title,
        description: sharedGoal.description,
        uomType: sharedGoal.uomType,
        direction: sharedGoal.direction,
        targetValue: sharedGoal.targetValue,
        targetDate: sharedGoal.targetDate,
        weightage: 10,
        status: "SUBMITTED",
        isLocked: false,
        primaryOwner: false,
      },
    ],
  });

  await prisma.goalSubmission.createMany({
    data: [
      {
        employeeId: priya.id,
        cycleId: cycle.id,
        status: "APPROVED",
        submittedAt: new Date("2026-07-12"),
        approvedAt: new Date("2026-07-25"),
      },
      {
        employeeId: karan.id,
        cycleId: cycle.id,
        status: "SUBMITTED",
        submittedAt: new Date("2026-07-20"),
      },
    ],
  });

  await prisma.quarterlyUpdate.createMany({
    data: [
      {
        goalId: "g-1",
        quarter: "Q1",
        actualValue: 86,
        actualDate: new Date("2026-07-20"),
        status: "ON_TRACK",
        employeeComment: "Process adherence improved; two complex cases are pending.",
        progressScore: 93,
      },
      {
        goalId: "g-2",
        quarter: "Q1",
        actualValue: 28,
        actualDate: new Date("2026-07-22"),
        status: "ON_TRACK",
        employeeComment: "Need faster closure from field team.",
        progressScore: 86,
      },
      {
        goalId: "g-shared-1-primary",
        quarter: "Q1",
        actualValue: 91,
        actualDate: new Date("2026-07-24"),
        status: "ON_TRACK",
        employeeComment: "Shared SLA is improving across service queues.",
        progressScore: 96,
      },
      {
        goalId: "g-shared-1-recipient",
        quarter: "Q1",
        actualValue: 91,
        actualDate: new Date("2026-07-24"),
        status: "ON_TRACK",
        employeeComment: "Shared SLA is improving across service queues.",
        progressScore: 96,
      },
    ],
  });

  await prisma.checkIn.create({
    data: {
      employeeId: priya.id,
      managerId: manager.id,
      cycleId: cycle.id,
      quarter: "Q1",
      comment: "Good progress. Prioritize escalation aging in the next sprint.",
      completedAt: new Date("2026-07-25"),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: manager.id,
      entityType: "GoalSubmission",
      entityId: priya.id,
      action: "Approved and locked goal sheet",
      afterJson: { employee: priya.name, cycle: cycle.name },
    },
  });

  await prisma.escalationLog.createMany({
    data: [
      {
        userId: karan.id,
        type: "MANAGER_APPROVAL_PENDING",
        level: 1,
        message: "Submitted sheet is pending manager approval.",
      },
      {
        userId: karan.id,
        type: "Q1_CHECK_IN_MISSING",
        level: 1,
        message: "Q1 check-in is not completed yet.",
      },
    ],
  });

  console.log(`Seeded WorkSphere demo data for ${admin.email}, ${manager.email}, ${priya.email}, and ${karan.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

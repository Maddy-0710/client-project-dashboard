import { PrismaClient, Role, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.activity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.create({ data: { name: "Admin", email: "admin@example.com", passwordHash, role: Role.ADMIN } });
  const pm1 = await prisma.user.create({ data: { name: "Ravi PM", email: "pm1@example.com", passwordHash, role: Role.PM } });
  const pm2 = await prisma.user.create({ data: { name: "Priya PM", email: "pm2@example.com", passwordHash, role: Role.PM } });
  const devs = await Promise.all(
    [1,2,3,4].map(i => prisma.user.create({ data: { name: `Developer ${i}`, email: `dev${i}@example.com`, passwordHash, role: Role.DEVELOPER } }))
  );

  const clients = await Promise.all(
    ["Acme Corp", "Northwind", "Globex"].map((name, i) =>
      prisma.client.create({ data: { name, email: `client${i+1}@example.com` } })
    )
  );

  const projects = [];
  for (let i = 0; i < 3; i++) {
    projects.push(await prisma.project.create({
      data: {
        name: ["Acme Website", "Northwind Mobile", "Globex Analytics"][i],
        description: "Seed project for the hiring assessment dashboard.",
        ownerId: i === 2 ? pm2.id : pm1.id,
        clientId: clients[i].id
      }
    }));
  }

  let taskNumber = 0;
  for (let p = 0; p < projects.length; p++) {
    for (let i = 0; i < 6; i++) {
      taskNumber++;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i < 2 ? -2 : i + 1));
      const status = i === 0 ? TaskStatus.DONE : i === 1 ? TaskStatus.IN_REVIEW : i === 2 ? TaskStatus.IN_PROGRESS : TaskStatus.TODO;
      await prisma.task.create({
        data: {
          title: `Task #${taskNumber}`,
          description: `Seed task ${taskNumber}`,
          projectId: projects[p].id,
          developerId: devs[(p + i) % devs.length].id,
          status,
          priority: [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW][i % 4],
          dueDate
        }
      });
    }
  }

  const tasks = await prisma.task.findMany({ orderBy: { id: "asc" } });
  for (const task of tasks.slice(0, 8)) {
    await prisma.activity.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        userId: task.developerId,
        fromStatus: TaskStatus.TODO,
        toStatus: task.status === TaskStatus.TODO ? TaskStatus.IN_PROGRESS : task.status
      }
    });
  }

  await prisma.notification.create({
    data: { userId: devs[0].id, message: "You have been assigned a new task." }
  });
  await prisma.notification.create({
    data: { userId: pm1.id, message: "A task in your project was moved to In Review." }
  });

  console.log(`Seeded ${admin.email}, 2 PMs, 4 developers, 3 projects and ${tasks.length} tasks.`);
}

main().finally(() => prisma.$disconnect());

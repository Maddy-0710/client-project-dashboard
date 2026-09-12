# Project Pulse

Real-time client project dashboard built for the Velozity Global Solutions Full Stack Developer Technical Hiring Assessment.

## Overview

Project Pulse is a role-based project management dashboard that allows Admins, Project Managers, and Developers to manage projects and tasks with real-time activity updates and notifications.

The application provides:

- Role-based authentication and authorization
- JWT access and refresh token authentication
- Project and task management
- Developer task assignment
- Task status and priority management
- Real-time activity updates using Socket.IO
- Real-time notifications
- Online user presence for Admins
- Background overdue-task processing
- PostgreSQL persistence using Prisma
- Server-side validation
- Role-filtered dashboards and activity feeds

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Axios
- Socket.IO Client

### Backend

- Node.js
- Express
- TypeScript
- Socket.IO
- JWT
- Zod
- node-cron

### Database

- PostgreSQL
- Prisma ORM

### Development

- Docker
- Docker Compose

---

## Project Structure

```text
client-project-dashboard/
│
├── backend/
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.ts
│   ├── prisma/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.ts
│
├── prisma/
│
├── docker-compose.yml
├── .gitignore
├── .env
└── README.md
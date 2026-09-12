import { useEffect, useRef, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { API, auth } from "./api";
import { io, Socket } from "socket.io-client";

// =========================================================
// TYPES
// =========================================================

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PM" | "DEVELOPER";
};

type Project = {
  id: string;
  name: string;
  description?: string;
  client?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
  _count?: {
    tasks: number;
  };
};

type Developer = {
  id: string;
  name: string;
  email: string;
};

type Task = {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string;

  developer: {
    name: string;
  };

  project: {
    id: string;
    name: string;
  };
};

type Activity = {
  id: number;
  projectId: string;
  taskId: number;
  userId: string;
  fromStatus: string;
  toStatus: string;
  createdAt: string;

  user?: {
    id?: string;
    name: string;
  };
};

type Notification = {
  id: number;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type AdminStats = {
  totalProjects: number;
  tasksByStatus: {
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
  };
  overdue: number;
};

// =========================================================
// LOGIN
// =========================================================

function Login({
  onLogin,
}: {
  onLogin: (u: User) => void;
}) {
  const [email, setEmail] =
    useState("admin@example.com");

  const [password, setPassword] =
    useState("Password123!");

  const [error, setError] =
    useState("");

  const nav = useNavigate();

  async function submit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");

    try {
      const response =
        await API.post("/auth/login", {
          email,
          password,
        });

      auth.token =
        response.data.accessToken;

      onLogin(response.data.user);

      nav("/");
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Project Pulse</h1>

        <p>
          Real-time client project dashboard
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "13px",
            color: "#555",
          }}
        >
          Email
        </label>

        <input
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          placeholder="Email"
        />

        <label
          style={{
            display: "block",
            marginBottom: "6px",
            marginTop: "4px",
            fontSize: "13px",
            color: "#555",
          }}
        >
          Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          placeholder="Password"
        />

        <button type="submit">
          Sign in
        </button>

        {error && (
          <small>{error}</small>
        )}
      </form>
    </div>
  );
}

// =========================================================
// CREATE TASK
// =========================================================

function CreateTask({
  projects,
  developers,
  onCreated,
}: {
  projects: Project[];
  developers: Developer[];
  onCreated: () => void;
}) {
  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [projectId, setProjectId] =
    useState("");

  const [developerId, setDeveloperId] =
    useState("");

  const [priority, setPriority] =
    useState("MEDIUM");

  const [dueDate, setDueDate] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function submit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError(
        "Task title is required."
      );
      return;
    }

    if (!projectId) {
      setError(
        "Please select a project."
      );
      return;
    }

    if (!developerId) {
      setError(
        "Please select a developer."
      );
      return;
    }

    if (!dueDate) {
      setError(
        "Please select a due date."
      );
      return;
    }

    try {
      setSaving(true);

      await API.post("/tasks", {
        title: title.trim(),
        description:
          description.trim(),
        projectId,
        developerId,
        priority,
        dueDate,
      });

      setTitle("");
      setDescription("");
      setProjectId("");
      setDeveloperId("");
      setPriority("MEDIUM");
      setDueDate("");

      setSuccess(
        "Task created successfully."
      );

      onCreated();
    } catch (error: any) {
      console.error(
        "Failed to create task:",
        error
      );

      setError(
        error?.response?.data?.error
          ?.message ||
          "Failed to create task."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h3>Create Task</h3>

      <form onSubmit={submit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              Task title
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              Project
            </label>

            <select
              value={projectId}
              onChange={(e) =>
                setProjectId(
                  e.target.value
                )
              }
            >
              <option value="">
                Select project
              </option>

              {projects.map(
                (project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              Developer
            </label>

            <select
              value={developerId}
              onChange={(e) =>
                setDeveloperId(
                  e.target.value
                )
              }
            >
              <option value="">
                Assign developer
              </option>

              {developers.map(
                (developer) => (
                  <option
                    key={developer.id}
                    value={developer.id}
                  >
                    {developer.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              Priority
            </label>

            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value
                )
              }
            >
              <option value="CRITICAL">
                Critical
              </option>

              <option value="HIGH">
                High
              </option>

              <option value="MEDIUM">
                Medium
              </option>

              <option value="LOW">
                Low
              </option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "13px",
                color: "#555",
              }}
            >
              Due date
            </label>

            <input
              type="date"
              value={dueDate}
              onChange={(e) =>
                setDueDate(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "12px",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "13px",
              color: "#555",
            }}
          >
            Description
          </label>

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            placeholder="Enter task description"
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontFamily:
                "Arial, Helvetica, sans-serif",
              fontSize: "14px",
            }}
          />
        </div>

        {error && (
          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
              color: "#b00020",
              fontSize: "13px",
            }}
          >
            {error}
          </p>
        )}

        {success && (
          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
              color: "#267326",
              fontSize: "13px",
            }}
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: "14px",
          }}
        >
          {saving
            ? "Creating..."
            : "Create Task"}
        </button>
      </form>
    </section>
  );
}

// =========================================================
// ADMIN DASHBOARD SUMMARY
// =========================================================

function AdminSummary({
  stats,
  onlineUsers,
}: {
  stats: AdminStats | null;
  onlineUsers: number;
}) {
  if (!stats) {
    return (
      <section className="stats">
        <div>
          <b>...</b>
          <span>Total Projects</span>
        </div>

        <div>
          <b>...</b>
          <span>Online Users</span>
        </div>

        <div>
          <b>...</b>
          <span>Overdue</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="stats">
        <div>
          <b>{stats.totalProjects}</b>
          <span>Total Projects</span>
        </div>

        <div>
          <b>
            {stats.tasksByStatus.todo}
          </b>
          <span>To Do</span>
        </div>

        <div>
          <b>
            {stats.tasksByStatus.inProgress}
          </b>
          <span>In Progress</span>
        </div>

        <div>
          <b>
            {stats.tasksByStatus.inReview}
          </b>
          <span>In Review</span>
        </div>

        <div>
          <b>
            {stats.tasksByStatus.done}
          </b>
          <span>Done</span>
        </div>

        <div>
          <b>{stats.overdue}</b>
          <span>Overdue</span>
        </div>

        <div>
          <b>{onlineUsers}</b>
          <span>Online Users</span>
        </div>
      </section>
    </>
  );
}

// =========================================================
// PM DASHBOARD SUMMARY
// =========================================================

function PMSummary({
  projects,
  tasks,
}: {
  projects: Project[];
  tasks: Task[];
}) {
  const now = new Date();

  const startOfWeek =
    new Date(now);

  const day =
    startOfWeek.getDay();

  const difference =
    day === 0 ? 6 : day - 1;

  startOfWeek.setDate(
    startOfWeek.getDate() -
      difference
  );

  startOfWeek.setHours(
    0,
    0,
    0,
    0
  );

  const endOfWeek =
    new Date(startOfWeek);

  endOfWeek.setDate(
    startOfWeek.getDate() + 6
  );

  endOfWeek.setHours(
    23,
    59,
    59,
    999
  );

  const dueThisWeek =
    tasks.filter((task) => {
      const date =
        new Date(task.dueDate);

      return (
        date >= startOfWeek &&
        date <= endOfWeek
      );
    }).length;

  const critical =
    tasks.filter(
      (task) =>
        task.priority ===
        "CRITICAL"
    ).length;

  const high =
    tasks.filter(
      (task) =>
        task.priority === "HIGH"
    ).length;

  const medium =
    tasks.filter(
      (task) =>
        task.priority === "MEDIUM"
    ).length;

  const low =
    tasks.filter(
      (task) =>
        task.priority === "LOW"
    ).length;

  return (
    <section className="stats">
      <div>
        <b>{projects.length}</b>
        <span>My Projects</span>
      </div>

      <div>
        <b>{critical}</b>
        <span>Critical</span>
      </div>

      <div>
        <b>{high}</b>
        <span>High Priority</span>
      </div>

      <div>
        <b>{medium}</b>
        <span>Medium Priority</span>
      </div>

      <div>
        <b>{low}</b>
        <span>Low Priority</span>
      </div>

      <div>
        <b>{dueThisWeek}</b>
        <span>Due This Week</span>
      </div>
    </section>
  );
}

// =========================================================
// DASHBOARD
// =========================================================

function Dashboard({
  user,
}: {
  user: User;
}) {
  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [
    showNotifications,
    setShowNotifications,
  ] = useState(false);

  const [status, setStatus] =
    useState("");

  const [priority, setPriority] =
    useState("");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [developers, setDevelopers] =
    useState<Developer[]>([]);

  const [adminStats, setAdminStats] =
    useState<AdminStats | null>(null);

  const [onlineUsers, setOnlineUsers] =
    useState(0);

  const socketRef =
    useRef<Socket | null>(null);

  // =======================================================
  // LOAD TASKS
  // =======================================================

  async function loadTasks() {
    try {
      const response =
        await API.get("/tasks", {
          params: {
            ...(status && {
              status,
            }),

            ...(priority && {
              priority,
            }),

            ...(fromDate && {
              from: fromDate,
            }),

            ...(toDate && {
              to: toDate,
            }),
          },
        });

      setTasks(
        response.data.tasks || []
      );
    } catch (error) {
      console.error(
        "Failed to load tasks:",
        error
      );
    }
  }

  useEffect(() => {
    loadTasks();
  }, [
    status,
    priority,
    fromDate,
    toDate,
  ]);

  // =======================================================
  // LOAD PROJECTS
  // =======================================================

  useEffect(() => {
    if (
      user.role !== "PM" &&
      user.role !== "ADMIN"
    ) {
      return;
    }

    API.get("/projects")
      .then((response) => {
        setProjects(
          response.data.projects || []
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load projects:",
          error
        );
      });
  }, [user.role]);

  // =======================================================
  // LOAD DEVELOPERS
  // =======================================================

  useEffect(() => {
    if (
      user.role !== "PM" &&
      user.role !== "ADMIN"
    ) {
      return;
    }

    API.get("/users/developers")
      .then((response) => {
        setDevelopers(
          response.data.developers || []
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load developers:",
          error
        );
      });
  }, [user.role]);

  // =======================================================
  // LOAD ADMIN STATS
  // =======================================================

  useEffect(() => {
    if (user.role !== "ADMIN") {
      return;
    }

    API.get("/admin/stats")
      .then((response) => {
        setAdminStats(
          response.data
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load admin statistics:",
          error
        );
      });
  }, [user.role, tasks]);

  // =======================================================
  // LOAD LAST 20 ACTIVITIES
  // =======================================================

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    API.get("/activities")
      .then((response) => {
        const dbActivities =
          response.data.activities ||
          [];

        setActivities(
          dbActivities.slice(0, 20)
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load activities:",
          error
        );
      });
  }, []);

  // =======================================================
  // LOAD NOTIFICATIONS
  // =======================================================

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    API.get("/notifications")
      .then((response) => {
        setNotifications(
          response.data.notifications ||
            []
        );

        setUnreadCount(
          response.data.unreadCount ||
            0
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load notifications:",
          error
        );
      });
  }, []);

  // =======================================================
  // SOCKET CONNECTION
  // =======================================================

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    const socket: Socket = io(
      import.meta.env
        .VITE_SOCKET_URL ||
        "http://localhost:4000",
      {
        auth: {
          token: auth.token,
        },
      }
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log(
        "Socket connected:",
        socket.id
      );
    });

    // =====================================================
    // SOCKET ERROR
    // =====================================================

    socket.on(
      "connect_error",
      (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );
      }
    );

    // =====================================================
    // LIVE ACTIVITY
    // =====================================================

    socket.on(
      "activity:new",
      (activity: Activity) => {
        setActivities(
          (current) => {
            if (
              current.some(
                (item) =>
                  item.id ===
                  activity.id
              )
            ) {
              return current;
            }

            return [
              activity,
              ...current,
            ].slice(0, 20);
          }
        );
      }
    );

    // =====================================================
    // NEW NOTIFICATION
    // =====================================================

    socket.on(
      "notification:new",
      (
        notification: Notification
      ) => {
        setNotifications(
          (current) => {
            if (
              current.some(
                (item) =>
                  item.id ===
                  notification.id
              )
            ) {
              return current;
            }

            return [
              notification,
              ...current,
            ].slice(0, 50);
          }
        );
      }
    );

    // =====================================================
    // REALTIME UNREAD COUNT
    // =====================================================

    socket.on(
      "notification:count",
      (count: number) => {
        setUnreadCount(count);
      }
    );

    // =====================================================
    // LIVE ONLINE USER COUNT
    // =====================================================

    socket.on(
      "presence:count",
      (count: number) => {
        console.log(
          "Online users:",
          count
        );

        setOnlineUsers(count);
      }
    );

    // =====================================================
    // CLEANUP
    // =====================================================

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user.role]);

  // =======================================================
  // JOIN APPROPRIATE SOCKET ROOMS
  // =======================================================

  useEffect(() => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      !socket.connected
    ) {
      return;
    }

    // -----------------------------------------------------
    // DEVELOPER
    // -----------------------------------------------------

    if (
      user.role === "DEVELOPER"
    ) {
      const taskIds =
        tasks.map(
          (task) => task.id
        );

      taskIds.forEach(
        (taskId) => {
          socket.emit(
            "task:join",
            taskId
          );
        }
      );

      console.log(
        "Joined task rooms:",
        taskIds
      );
    }

    // -----------------------------------------------------
    // PM / ADMIN
    // -----------------------------------------------------

    if (
      user.role === "PM" ||
      user.role === "ADMIN"
    ) {
      const projectIds = [
        ...new Set(
          tasks.map(
            (task) =>
              task.project.id
          )
        ),
      ];

      projectIds.forEach(
        (projectId) => {
          socket.emit(
            "project:join",
            projectId
          );
        }
      );

      console.log(
        "Joined project rooms:",
        projectIds
      );
    }
  }, [
    tasks,
    user.role,
  ]);

  // =======================================================
  // UPDATE TASK STATUS
  // =======================================================

  async function update(
    id: number,
    next: string
  ) {
    try {
      await API.patch(
        `/tasks/${id}/status`,
        {
          status: next,
        }
      );

      setTasks(
        (current) =>
          current.map(
            (task) =>
              task.id === id
                ? {
                    ...task,
                    status: next,
                  }
                : task
          )
      );
    } catch (error) {
      console.error(
        "Failed to update task:",
        error
      );
    }
  }

  // =======================================================
  // MARK ONE NOTIFICATION AS READ
  // =======================================================

  async function markNotificationRead(
    id: number
  ) {
    try {
      const response =
        await API.patch(
          `/notifications/${id}/read`
        );

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id === id
                ? {
                    ...notification,
                    read: true,
                  }
                : notification
          )
      );

      setUnreadCount(
        response.data.unreadCount ??
          0
      );
    } catch (error) {
      console.error(
        "Failed to mark notification as read:",
        error
      );
    }
  }

  // =======================================================
  // MARK ALL NOTIFICATIONS AS READ
  // =======================================================

  async function markAllNotificationsRead() {
    try {
      await API.post(
        "/notifications/read-all"
      );

      setNotifications(
        (current) =>
          current.map(
            (notification) => ({
              ...notification,
              read: true,
            })
          )
      );

      setUnreadCount(0);
    } catch (error) {
      console.error(
        "Failed to mark notifications as read:",
        error
      );
    }
  }

  // =======================================================
  // LOGOUT
  // =======================================================

  async function logout() {
    try {
      await API.post(
        "/auth/logout"
      );
    } catch {
      // Ignore logout error
    }

    auth.token = "";

    location.href = "/";
  }

  // =======================================================
  // DASHBOARD UI
  // =======================================================

  return (
    <div className="app">
      {/* =================================================
          HEADER
      ================================================= */}

      <header>
        <div>
          <h2>Project Pulse</h2>

          <span>
            {user.name} · {user.role}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* =================================================
              NOTIFICATIONS
          ================================================= */}

          <div
            style={{
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setShowNotifications(
                  (current) =>
                    !current
                )
              }
              style={{
                minWidth: "42px",
                height: "38px",
                padding: "0 10px",
                border:
                  "1px solid #ccc",
                borderRadius: "4px",
                background: "#fff",
                color: "#333",
                cursor: "pointer",
                position: "relative",
              }}
            >
              Notifications

              {unreadCount > 0 && (
                <span
                  style={{
                    position:
                      "absolute",
                    top: "-7px",
                    right: "-7px",
                    minWidth: "20px",
                    height: "20px",
                    padding: "0 5px",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    borderRadius:
                      "10px",
                    background: "#222",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                style={{
                  position:
                    "absolute",
                  top: "46px",
                  right: 0,
                  width: "340px",
                  maxWidth:
                    "calc(100vw - 30px)",
                  background: "#fff",
                  border:
                    "1px solid #d8d8d8",
                  borderRadius: "5px",
                  zIndex: 1000,
                  boxShadow:
                    "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    padding:
                      "14px 16px",
                    borderBottom:
                      "1px solid #eee",
                  }}
                >
                  <strong
                    style={{
                      fontSize:
                        "14px",
                      fontWeight: 600,
                    }}
                  >
                    Notifications
                  </strong>

                  {unreadCount >
                    0 && (
                    <button
                      type="button"
                      onClick={
                        markAllNotificationsRead
                      }
                      style={{
                        border: 0,
                        background:
                          "none",
                        color:
                          "#444",
                        fontSize:
                          "12px",
                        cursor:
                          "pointer",
                        padding: 0,
                      }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div
                  style={{
                    maxHeight:
                      "360px",
                    overflowY:
                      "auto",
                  }}
                >
                  {notifications.length ===
                  0 ? (
                    <div
                      style={{
                        padding:
                          "24px 16px",
                        textAlign:
                          "center",
                        color:
                          "#777",
                        fontSize:
                          "13px",
                      }}
                    >
                      No notifications.
                    </div>
                  ) : (
                    notifications.map(
                      (
                        notification
                      ) => (
                        <div
                          key={
                            notification.id
                          }
                          style={{
                            padding:
                              "13px 16px",
                            borderBottom:
                              "1px solid #eee",
                            background:
                              notification.read
                                ? "#fff"
                                : "#f7f7f7",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              gap: "10px",
                              alignItems:
                                "flex-start",
                            }}
                          >
                            {!notification.read && (
                              <span
                                style={{
                                  width:
                                    "7px",
                                  height:
                                    "7px",
                                  minWidth:
                                    "7px",
                                  marginTop:
                                    "5px",
                                  borderRadius:
                                    "50%",
                                  background:
                                    "#222",
                                }}
                              />
                            )}

                            <div
                              style={{
                                flex: 1,
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  fontSize:
                                    "13px",
                                  lineHeight:
                                    1.5,
                                  color:
                                    "#333",
                                }}
                              >
                                {
                                  notification.message
                                }
                              </p>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  justifyContent:
                                    "space-between",
                                  alignItems:
                                    "center",
                                  marginTop:
                                    "7px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize:
                                      "11px",
                                    color:
                                      "#888",
                                  }}
                                >
                                  {new Date(
                                    notification.createdAt
                                  ).toLocaleString()}
                                </span>

                                {!notification.read && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      markNotificationRead(
                                        notification.id
                                      )
                                    }
                                    style={{
                                      border:
                                        "1px solid #ccc",
                                      borderRadius:
                                        "3px",
                                      background:
                                        "#fff",
                                      color:
                                        "#444",
                                      fontSize:
                                        "11px",
                                      padding:
                                        "4px 7px",
                                      cursor:
                                        "pointer",
                                    }}
                                  >
                                    Mark as read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              LOGOUT
          ================================================= */}

          <button
            type="button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main>
        {/* =================================================
            ADMIN SUMMARY
        ================================================= */}

        {user.role === "ADMIN" && (
          <AdminSummary
            stats={adminStats}
            onlineUsers={onlineUsers}
          />
        )}

        {/* =================================================
            PM SUMMARY
        ================================================= */}

        {user.role === "PM" && (
          <PMSummary
            projects={projects}
            tasks={tasks}
          />
        )}

        {/* =================================================
            DEVELOPER SUMMARY
        ================================================= */}

        {user.role ===
          "DEVELOPER" && (
          <section className="stats">
            <div>
              <b>{tasks.length}</b>
              <span>
                Assigned Tasks
              </span>
            </div>

            <div>
              <b>
                {
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "TODO"
                  ).length
                }
              </b>
              <span>To Do</span>
            </div>

            <div>
              <b>
                {
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "IN_PROGRESS"
                  ).length
                }
              </b>
              <span>
                In Progress
              </span>
            </div>

            <div>
              <b>
                {
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "DONE"
                  ).length
                }
              </b>
              <span>Done</span>
            </div>

            <div>
              <b>
                {
                  tasks.filter(
                    (task) =>
                      task.status ===
                      "OVERDUE"
                  ).length
                }
              </b>
              <span>Overdue</span>
            </div>
          </section>
        )}

        {/* =================================================
            CREATE TASK
        ================================================= */}

        {(user.role === "PM" ||
          user.role === "ADMIN") && (
          <CreateTask
            projects={projects}
            developers={developers}
            onCreated={loadTasks}
          />
        )}

        {/* =================================================
            TASK PANEL
        ================================================= */}

        <section className="panel">
          {/* =================================================
              FILTERS
          ================================================= */}

          <div
            className="filters"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems:
                "center",
            }}
          >
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value
                )
              }
            >
              <option value="">
                All status
              </option>

              <option value="TODO">
                To Do
              </option>

              <option value="IN_PROGRESS">
                In Progress
              </option>

              <option value="IN_REVIEW">
                In Review
              </option>

              <option value="DONE">
                Done
              </option>

              <option value="OVERDUE">
                Overdue
              </option>
            </select>

            <select
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value
                )
              }
            >
              <option value="">
                All priority
              </option>

              <option value="CRITICAL">
                Critical
              </option>

              <option value="HIGH">
                High
              </option>

              <option value="MEDIUM">
                Medium
              </option>

              <option value="LOW">
                Low
              </option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) =>
                setFromDate(
                  e.target.value
                )
              }
              title="From date"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) =>
                setToDate(
                  e.target.value
                )
              }
              title="To date"
            />

            {(status ||
              priority ||
              fromDate ||
              toDate) && (
              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  setPriority("");
                  setFromDate("");
                  setToDate("");
                }}
                style={{
                  padding:
                    "8px 12px",
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <h3>Tasks</h3>

          <div className="task-grid">
            {tasks.length ===
            0 ? (
              <p>
                No tasks found.
              </p>
            ) : (
              tasks.map(
                (task) => (
                  <article
                    className="task"
                    key={task.id}
                  >
                    <div className="pill">
                      {task.priority}
                    </div>

                    <h4>
                      #{task.id}{" "}
                      {task.title}
                    </h4>

                    <p>
                      {
                        task.project
                          .name
                      }
                    </p>

                    <p>
                      Developer:{" "}
                      {
                        task
                          .developer
                          .name
                      }
                    </p>

                    <p>
                      Due:{" "}
                      {new Date(
                        task.dueDate
                      ).toLocaleDateString()}
                    </p>

                    {user.role ===
                    "DEVELOPER" ? (
                      <select
                        value={
                          task.status
                        }
                        onChange={(
                          e
                        ) =>
                          update(
                            task.id,
                            e.target
                              .value
                          )
                        }
                      >
                        <option value="TODO">
                          To Do
                        </option>

                        <option value="IN_PROGRESS">
                          In Progress
                        </option>

                        <option value="IN_REVIEW">
                          In Review
                        </option>

                        <option value="DONE">
                          Done
                        </option>
                      </select>
                    ) : (
                      <span className="status">
                        {task.status}
                      </span>
                    )}
                  </article>
                )
              )
            )}
          </div>
        </section>

        {/* =================================================
            LIVE ACTIVITY
        ================================================= */}

        <section className="panel">
          <h3>
            Live Activity
          </h3>

          {activities.length ===
          0 ? (
            <p>
              No activity yet.
            </p>
          ) : (
            activities.map(
              (activity) => (
                <p
                  key={
                    activity.id
                  }
                >
                  <b>
                    {activity
                      .user
                      ?.name ||
                      "User"}
                  </b>

                  {" moved Task #"}

                  {activity.taskId}

                  {" from "}

                  {
                    activity.fromStatus
                  }

                  {" → "}

                  {
                    activity.toStatus
                  }

                  {" · "}

                  {new Date(
                    activity.createdAt
                  ).toLocaleTimeString()}
                </p>
              )
            )
          )}
        </section>
      </main>
    </div>
  );
}

// =========================================================
// APP
// =========================================================

export default function App() {
  const [user, setUser] =
    useState<User | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  // =======================================================
  // REFRESH ACCESS TOKEN
  // =======================================================

  useEffect(() => {
    API.post("/auth/refresh")
      .then((response) => {
        auth.token =
          response.data.accessToken;

        setUser(
          response.data.user
        );
      })
      .catch(() => {
        // No valid refresh cookie/session.
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <div className="loading">
        Loading...
      </div>
    );
  }

  // =======================================================
  // ROUTES
  // =======================================================

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" />
          ) : (
            <Login
              onLogin={setUser}
            />
          )
        }
      />

      <Route
        path="/"
        element={
          user ? (
            <Dashboard
              user={user}
            />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}
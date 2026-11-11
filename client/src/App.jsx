import { useEffect, useState } from "react";
import "./App.css";

// Get today's date in local YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Get the previous calendar month's date range
function getPreviousMonthRange() {
  const today = new Date();
  const firstDayOfCurrentMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  );

  const lastDayOfPreviousMonth = new Date(
    firstDayOfCurrentMonth.getTime() - 24 * 60 * 60 * 1000,
  );

  const year = lastDayOfPreviousMonth.getFullYear();
  const month = String(lastDayOfPreviousMonth.getMonth() + 1).padStart(2, "0");

  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDayOfPreviousMonth.getDate()).padStart(
      2,
      "0",
    )}`,
  };
}

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("token"),
  );

  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingReading, setEditingReading] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Navigation
  const [activePage, setActivePage] = useState("dashboard");

  // Reports
  const [reportType, setReportType] = useState("daily");
  const [reportDate, setReportDate] = useState(getTodayDate());
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  // Fetch glucose readings (GET)
  async function fetchReadings() {
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/readings", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setReadings(data.readings);
      } else {
        alert(data.message || "Failed to load readings");

        if (response.status === 401) {
          handleLogout();
        }
      }
    } catch (error) {
      console.error(error);
      alert("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchReadings();
    }
  }, [isAuthenticated]);

  // Fetch selected report
  useEffect(() => {
    if (!isAuthenticated || activePage !== "reports") {
      return;
    }

    async function fetchReport() {
      setReportLoading(true);
      setReportError("");
      setReportData(null);

      try {
        let endpoint = "";

        if (reportType === "daily") {
          endpoint = `/api/readings/report/daily?date=${reportDate}`;
        } else if (reportType === "month-to-date") {
          endpoint = `/api/readings/report/month-to-date?date=${reportDate}`;
        } else {
          endpoint = "/api/readings/report/monthly";
        }

        const response = await fetch(`http://localhost:3000${endpoint}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setReportError(data.message || "Failed to load report");

          if (response.status === 401) {
            handleLogout();
          }

          return;
        }

        setReportData(data);
      } catch (error) {
        console.error(error);
        setReportError("Unable to connect to the server.");
      } finally {
        setReportLoading(false);
      }
    }

    fetchReport();
  }, [isAuthenticated, activePage, reportType, reportDate]);

  // Handle login and signup
  async function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const userData = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    if (!isLogin) {
      userData.name = formData.get("name");
    }

    const endpoint = isLogin ? "login" : "signup";

    try {
      const response = await fetch(
        `http://localhost:3000/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(userData),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Something went wrong");
        return;
      }

      if (isLogin) {
        localStorage.setItem("token", data.token);
        setIsAuthenticated(true);
      } else {
        alert("Account created successfully!");
        setIsLogin(true);
      }
    } catch (error) {
      console.error(error);
      alert("Unable to connect to the server");
    }
  }

  // Add or update glucose reading (POST / PUT)
  async function handleSaveReading(event) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const readingData = {
      reading_date: formData.get("reading_date"),
      time_slot: formData.get("time_slot"),
      glucose_value: Number(formData.get("glucose_value")),
    };

    setSubmitting(true);

    try {
      const isEditing = editingReading !== null;

      const url = isEditing
        ? `http://localhost:3000/api/readings/${editingReading.id}`
        : "http://localhost:3000/api/readings";

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(readingData),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessages = Object.values(data.errors || {});

        alert(
          errorMessages.join("\n") || data.message || "Something went wrong.",
        );

        return;
      }

      setShowForm(false);
      setEditingReading(null);
      setOpenMenuId(null);

      await fetchReadings();
    } catch (error) {
      console.error(error);
      alert("Unable to connect to the server");
    } finally {
      setSubmitting(false);
    }
  }

  // Open Add modal
  function handleAddReading() {
    setEditingReading(null);
    setShowForm(true);
  }

  // Open Edit modal
  function handleEditReading(reading) {
    setEditingReading(reading);
    setShowForm(true);
    setOpenMenuId(null);
  }

  // Delete glucose reading (DELETE)
  async function handleDeleteReading(reading) {
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${reading.time_slot} reading?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/readings/${reading.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to delete reading");
        return;
      }

      await fetchReadings();
    } catch (error) {
      console.error(error);
      alert("Unable to connect to the server");
    }
  }

  // Close modal
  function handleCloseForm() {
    setShowForm(false);
    setEditingReading(null);
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setReadings([]);
    setShowForm(false);
    setEditingReading(null);
    setOpenMenuId(null);
    setActivePage("dashboard");
    setIsLogin(true);
    setReportData(null);
    setReportError("");
  }

  // Format date without timezone shifting
  function formatDate(dateValue) {
    const date = String(dateValue).slice(0, 10);
    const [year, month, day] = date.split("-");

    return `${day} ${new Date(`${date}T00:00:00`).toLocaleString("en", {
      month: "short",
    })} ${year}`;
  }

  // Dashboard summary
  const glucoseValues = readings.map((reading) =>
    Number(reading.glucose_value),
  );

  const highest = glucoseValues.length ? Math.max(...glucoseValues) : "--";
  const lowest = glucoseValues.length ? Math.min(...glucoseValues) : "--";
  const recentReadings = readings.slice(0, 5);

  // Report display values
  const report = reportData?.report;
  const reportReadings = reportData?.readings || [];
  const previousMonthRange = getPreviousMonthRange();

  let reportPeriod = "";

  if (reportType === "daily") {
    reportPeriod = reportDate ? formatDate(reportDate) : "";
  } else if (reportType === "month-to-date") {
    reportPeriod = reportDate
      ? `${formatDate(`${reportDate.slice(0, 7)}-01`)} – ${formatDate(reportDate)}`
      : "";
  } else {
    reportPeriod = `${formatDate(previousMonthRange.start)} – ${formatDate(
      previousMonthRange.end,
    )}`;
  }

  // Dashboard
  if (isAuthenticated) {
    return (
      <div className="app dashboard-app">
        <div className="app-layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="brand-icon">S</div>
              <h1>Sweety</h1>
            </div>

            <nav className="sidebar-nav">
              <button
                className={`sidebar-link ${
                  activePage === "dashboard" ? "active" : ""
                }`}
                onClick={() => setActivePage("dashboard")}
              >
                <span className="sidebar-icon">▦</span>
                Dashboard
              </button>

              <button
                className={`sidebar-link ${
                  activePage === "reports" ? "active" : ""
                }`}
                onClick={() => setActivePage("reports")}
              >
                <span className="sidebar-icon">▤</span>
                Reports
              </button>
            </nav>

            <button className="sidebar-logout" onClick={handleLogout}>
              <span className="sidebar-icon">↪</span>
              Logout
            </button>
          </aside>

          {/* Main content */}
          <main className="main-content">
            <div className="dashboard">
              {/* Dashboard page */}
              {activePage === "dashboard" && (
                <>
                  <section className="welcome-section">
                    <h2>Welcome back!</h2>
                    <p>Here's your glucose overview.</p>
                  </section>

                  <section className="summary-cards">
                    <div className="summary-card">
                      <p>Highest</p>
                      <h3 className="highest-value">{highest}</h3>
                      <span>mg/dl</span>
                    </div>

                    <div className="summary-card">
                      <p>Lowest</p>
                      <h3 className="lowest-value">{lowest}</h3>
                      <span>mg/dl</span>
                    </div>

                    <div className="summary-card">
                      <p>Readings</p>
                      <h3 className="total-value">{readings.length}</h3>
                      <span>Total</span>
                    </div>
                  </section>

                  <section className="recent-section">
                    <div className="section-heading">
                      <h3>Recent readings</h3>

                      <button
                        className="view-all-button"
                        onClick={fetchReadings}
                        disabled={loading}
                      >
                        {loading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    {loading ? (
                      <p className="empty-message">Loading readings...</p>
                    ) : recentReadings.length === 0 ? (
                      <p className="empty-message">
                        No readings yet. Add your first glucose reading!
                      </p>
                    ) : (
                      <div className="reading-list">
                        {recentReadings.map((reading) => (
                          <div className="reading-item" key={reading.id}>
                            <div>
                              <h4>{reading.time_slot}</h4>
                              <p>{formatDate(reading.reading_date)}</p>
                            </div>

                            <div className="reading-value-actions">
                              <strong>{reading.glucose_value} mg/dl</strong>

                              <div className="reading-menu">
                                <button
                                  className="menu-button"
                                  onClick={() =>
                                    setOpenMenuId(
                                      openMenuId === reading.id
                                        ? null
                                        : reading.id,
                                    )
                                  }
                                >
                                  ⋮
                                </button>

                                {openMenuId === reading.id && (
                                  <div className="menu-options">
                                    <button
                                      onClick={() => handleEditReading(reading)}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      className="menu-delete"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleDeleteReading(reading);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <button
                    className="add-reading-button"
                    onClick={handleAddReading}
                  >
                    + Add glucose reading
                  </button>

                  {/* Floating Add / Edit modal */}
                  {showForm && (
                    <div className="modal-overlay" onClick={handleCloseForm}>
                      <section
                        className="add-reading-section edit-modal"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="modal-heading">
                          <div>
                            <h3>
                              {editingReading
                                ? "Edit glucose reading"
                                : "Add glucose reading"}
                            </h3>

                            <p>
                              {editingReading
                                ? "Update your glucose reading details."
                                : "Record your blood glucose level."}
                            </p>
                          </div>

                          <button
                            type="button"
                            className="modal-close-button"
                            onClick={handleCloseForm}
                          >
                            ×
                          </button>
                        </div>

                        <form
                          key={
                            editingReading ? editingReading.id : "new-reading"
                          }
                          onSubmit={handleSaveReading}
                        >
                          <div className="form-group">
                            <label>Reading date</label>
                            <input
                              type="date"
                              name="reading_date"
                              defaultValue={
                                editingReading
                                  ? String(editingReading.reading_date).slice(
                                      0,
                                      10,
                                    )
                                  : ""
                              }
                              max={getTodayDate()}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label>Time slot</label>
                            <select
                              name="time_slot"
                              required
                              defaultValue={editingReading?.time_slot || ""}
                            >
                              <option value="" disabled>
                                Select time slot
                              </option>
                              <option value="Morning fasting">
                                Morning fasting
                              </option>
                              <option value="After breakfast">
                                After breakfast
                              </option>
                              <option value="After lunch">After lunch</option>
                              <option value="After dinner">After dinner</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Glucose value (mg/dl)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              name="glucose_value"
                              placeholder="Enter glucose value"
                              defaultValue={editingReading?.glucose_value ?? ""}
                              required
                            />
                          </div>

                          <button type="submit" disabled={submitting}>
                            {submitting
                              ? editingReading
                                ? "Updating..."
                                : "Saving..."
                              : editingReading
                                ? "Update reading"
                                : "Save reading"}
                          </button>

                          <button
                            type="button"
                            className="cancel-button"
                            onClick={handleCloseForm}
                          >
                            Cancel
                          </button>
                        </form>
                      </section>
                    </div>
                  )}
                </>
              )}

              {/* Reports page */}
              {activePage === "reports" && (
                <section className="reports-page">
                  <div className="reports-heading">
                    <div>
                      <h2>Reports</h2>
                      <p>View and analyse your blood glucose readings.</p>
                    </div>
                  </div>

                  {/* Report type selector */}
                  <div className="report-tabs">
                    <button
                      className={
                        reportType === "daily"
                          ? "report-tab active"
                          : "report-tab"
                      }
                      onClick={() => setReportType("daily")}
                    >
                      Daily
                    </button>

                    <button
                      className={
                        reportType === "month-to-date"
                          ? "report-tab active"
                          : "report-tab"
                      }
                      onClick={() => setReportType("month-to-date")}
                    >
                      Month to date
                    </button>

                    <button
                      className={
                        reportType === "monthly"
                          ? "report-tab active"
                          : "report-tab"
                      }
                      onClick={() => setReportType("monthly")}
                    >
                      Previous month
                    </button>
                  </div>

                  {/* Date selection */}
                  <div className="report-filter">
                    {reportType !== "monthly" ? (
                      <div className="report-date-field">
                        <label htmlFor="report-date">
                          {reportType === "daily"
                            ? "Select date"
                            : "Select ending date"}
                        </label>

                        <input
                          id="report-date"
                          type="date"
                          value={reportDate}
                          max={getTodayDate()}
                          onChange={(event) =>
                            setReportDate(event.target.value)
                          }
                        />
                      </div>
                    ) : (
                      <div className="report-date-field">
                        <label>Report period</label>
                        <p>{reportPeriod}</p>
                      </div>
                    )}
                  </div>

                  {reportLoading ? (
                    <div className="report-message">
                      <p>Loading report...</p>
                    </div>
                  ) : reportError ? (
                    <div className="report-message report-error">
                      <p>{reportError}</p>
                      <button
                        onClick={() => {
                          setReportType((current) => current);
                          setReportDate((current) => current);
                        }}
                      >
                        Try again
                      </button>
                    </div>
                  ) : reportData ? (
                    <>
                      <div className="report-period-heading">
                        <h3>
                          {reportType === "daily"
                            ? "Daily report"
                            : reportType === "month-to-date"
                              ? "Month-to-date report"
                              : "Previous month report"}
                        </h3>
                        <p>{reportPeriod}</p>
                      </div>

                      {/* Report summary cards */}
                      <section className="summary-cards report-summary-cards">
                        <div className="summary-card">
                          <p>Highest</p>
                          <h3 className="highest-value">
                            {report?.highest ?? "--"}
                          </h3>
                          <span>mg/dl</span>
                        </div>

                        <div className="summary-card">
                          <p>Lowest</p>
                          <h3 className="lowest-value">
                            {report?.lowest ?? "--"}
                          </h3>
                          <span>mg/dl</span>
                        </div>

                        <div className="summary-card">
                          <p>Average</p>
                          <h3 className="total-value">
                            {report?.average ?? "--"}
                          </h3>
                          <span>mg/dl</span>
                        </div>

                        <div className="summary-card">
                          <p>Readings</p>
                          <h3 className="total-value">{report?.count ?? 0}</h3>
                          <span>Total</span>
                        </div>
                      </section>

                      {/* Individual readings */}
                      <section className="report-readings-section">
                        <div className="section-heading">
                          <h3>Readings</h3>
                          <span>{report?.count ?? 0} records</span>
                        </div>

                        {reportReadings.length === 0 ? (
                          <div className="report-empty-state">
                            <div className="reports-placeholder-icon">▤</div>
                            <h3>No readings found</h3>
                            <p>
                              There are no glucose readings for this report
                              period.
                            </p>
                          </div>
                        ) : (
                          <div className="report-table-wrapper">
                            <table className="report-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Time slot</th>
                                  <th>Glucose value</th>
                                </tr>
                              </thead>

                              <tbody>
                                {reportReadings.map((reading) => (
                                  <tr key={reading.id}>
                                    <td>{formatDate(reading.reading_date)}</td>
                                    <td>{reading.time_slot}</td>
                                    <td>
                                      <strong>
                                        {reading.glucose_value} mg/dl
                                      </strong>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </>
                  ) : null}
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Login and signup page
  return (
    <div className="app auth-page">
      <div className="auth-container">
        <div className="brand-icon auth-icon">S</div>
        <h1>Sweety</h1>
        <p className="auth-subtitle">Blood Glucose Tracker</p>

        <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input type="text" name="name" placeholder="Name" required />
          )}

          <input type="email" name="email" placeholder="Email" required />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
          />

          <button type="submit">{isLogin ? "Login" : "Sign Up"}</button>
        </form>

        <p className="auth-toggle">
          {isLogin ? "Don't have an account?" : "Already have an account?"}

          <button
            className="toggle-button"
            type="button"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;

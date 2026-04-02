import { useAuth } from "@admin/auth/context";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

/*
 * Inline SVG icon components (16x16). Small enough to keep in this file
 * rather than pulling in an icon library.
 */

function IconList() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 2v12M3 2h8l-2 3 2 3H3" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 14V6l4-4 4 5 4-3v10H2z" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M1 8h3l2-5 2 10 2-5h5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-3 2.5-5 5-5s5 2 5 5" />
      <circle cx="12" cy="5" r="1.5" />
      <path d="M12.5 8.5c1.5.5 2.5 2 2.5 4" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" />
      <path d="M2 5l6 3 6-3" />
      <path d="M8 8v7" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 2H3v12h3M10 4l4 4-4 4M14 8H6" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" />
    </svg>
  );
}

/**
 * Main application shell — sidebar + content outlet.
 */
export function Shell() {
  const { moderator, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-text">Ovation</span>
          <span className="sidebar-brand-tag">admin</span>
        </div>

        {/* Main navigation */}
        <nav className="sidebar-section">
          <div className="sidebar-section-label">Reviews</div>
          <NavLink
            to="/reviews"
            className="sidebar-link"
            data-active={undefined}
            end
          >
            {({ isActive }) => (
              <span
                className="sidebar-link"
                data-active={isActive || undefined}
              >
                <IconList />
                All Reviews
              </span>
            )}
          </NavLink>
          <NavLink to="/reviews/reported" className="sidebar-link">
            {({ isActive }) => (
              <span
                className="sidebar-link"
                data-active={isActive || undefined}
              >
                <IconFlag />
                Reported
              </span>
            )}
          </NavLink>
          <NavLink to="/search" className="sidebar-link">
            {({ isActive }) => (
              <span
                className="sidebar-link"
                data-active={isActive || undefined}
              >
                <IconSearch />
                Search
              </span>
            )}
          </NavLink>
        </nav>

        {isAdmin && (
          <nav className="sidebar-section">
            <div className="sidebar-section-label">Admin</div>
            <NavLink to="/stats" className="sidebar-link">
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconChart />
                  Statistics
                </span>
              )}
            </NavLink>
            <NavLink to="/usage" className="sidebar-link">
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconActivity />
                  Usage Graphs
                </span>
              )}
            </NavLink>
            <NavLink to="/moderators" className="sidebar-link">
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconUsers />
                  Moderators
                </span>
              )}
            </NavLink>
            <NavLink to="/taboos" className="sidebar-link">
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconShield />
                  Taboos
                </span>
              )}
            </NavLink>
            <NavLink to="/components" className="sidebar-link">
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconBox />
                  Components
                </span>
              )}
            </NavLink>
          </nav>
        )}

        <div className="sidebar-spacer" />

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {moderator?.display_name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {moderator?.display_name ?? "Unknown"}
              </div>
              <div className="sidebar-user-role">
                {isAdmin ? "admin" : "moderator"}
              </div>
            </div>
          </div>
          <div className="mt-2" style={{ display: "flex", gap: "0.5rem" }}>
            <NavLink to="/profile" className="sidebar-link" style={{ flex: 1 }}>
              {({ isActive }) => (
                <span
                  className="sidebar-link"
                  data-active={isActive || undefined}
                >
                  <IconUser />
                  Profile
                </span>
              )}
            </NavLink>
            <button
              type="button"
              className="sidebar-link"
              onClick={handleLogout}
              style={{
                flex: 1,
                border: "none",
                background: "none",
                textAlign: "left",
              }}
            >
              <IconLogout />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

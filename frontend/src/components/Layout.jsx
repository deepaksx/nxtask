import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.seniority_level === 1;

  return (
    <div className="app-fullscreen">
      <header className="header-compact">
        <Link to="/" className="header-brand">
          <img src="/nxsys-logo.png" alt="NXSYS" className="nxsys-logo" />
          <span className="header-logo">
            <span className="logo-nx">NX</span><span className="logo-task">TASK</span>
          </span>
        </Link>
        <div className="header-user">
          {isAdmin && (
            <Link to="/users" className="btn-header" title="Manage Users">
              Users
            </Link>
          )}
          <span className="header-user-name">{user?.name}</span>
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            Logout
          </button>
        </div>
      </header>
      <main className="main-fullscreen">
        <Outlet />
      </main>
    </div>
  );
}

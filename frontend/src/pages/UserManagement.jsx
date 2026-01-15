import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SENIORITY_LEVELS = [
  { value: 1, label: 'Level 1 - Senior Executive' },
  { value: 2, label: 'Level 2 - Manager' },
  { value: 3, label: 'Level 3 - Senior' },
  { value: 4, label: 'Level 4 - Mid' },
  { value: 5, label: 'Level 5 - Junior' }
];

const CATEGORIES = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    seniority_level: 5
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSeniorityChange = async (userId, newLevel) => {
    setSaving(userId);
    setError('');

    try {
      await api.put(`/users/${userId}`, { seniority_level: parseInt(newLevel) });
      setUsers(users.map(u =>
        u.id === userId ? { ...u, seniority_level: parseInt(newLevel) } : u
      ));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;

    setError('');
    try {
      await api.delete(`/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const user = await api.post('/auth/register', newUser);
      setUsers([...users, user].sort((a, b) => a.seniority_level - b.seniority_level || a.name.localeCompare(b.name)));
      setShowCreateForm(false);
      setNewUser({ name: '', email: '', password: '', seniority_level: 5 });
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCategoryToggle = async (userId, category, currentCategories) => {
    setError('');
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];

    try {
      await api.put(`/users/${userId}/categories`, { categories: newCategories });
      setUsers(users.map(u =>
        u.id === userId ? { ...u, categories: newCategories } : u
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  const getSeniorityLabel = (level) => {
    const found = SENIORITY_LEVELS.find(s => s.value === level);
    return found ? found.label : `Level ${level}`;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  // Only Level 1 can access this page
  if (currentUser?.seniority_level !== 1) {
    return (
      <div className="user-management-page">
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <div className="empty-state-title">Access Denied</div>
          <p>Only Senior Executives (Level 1) can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-page">
      <div className="user-management-header">
        <h2>User Management</h2>
        <span className="user-count">{users.length} users</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateForm(true)}
          style={{ marginLeft: 'auto' }}
        >
          + New User
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showCreateForm && (
        <div className="create-user-form">
          <form onSubmit={handleCreateUser}>
            <div className="create-user-fields">
              <input
                type="text"
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
                className="form-input"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
                className="form-input"
              />
              <input
                type="password"
                placeholder="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                className="form-input"
              />
              <select
                value={newUser.seniority_level}
                onChange={(e) => setNewUser({ ...newUser, seniority_level: parseInt(e.target.value) })}
                className="seniority-select"
              >
                {SENIORITY_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="create-user-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Seniority Level</th>
              <th>Categories</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={user.id === currentUser.id ? 'current-user' : ''}>
                <td>
                  <div className="user-name">
                    {user.name}
                    {user.id === currentUser.id && <span className="you-badge">You</span>}
                  </div>
                </td>
                <td className="user-email">{user.email}</td>
                <td>
                  <select
                    value={user.seniority_level}
                    onChange={(e) => handleSeniorityChange(user.id, e.target.value)}
                    disabled={saving === user.id}
                    className="seniority-select"
                  >
                    {SENIORITY_LEVELS.map(level => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="category-checkboxes">
                    {CATEGORIES.map(cat => (
                      <label key={cat} className="category-checkbox">
                        <input
                          type="checkbox"
                          checked={user.categories?.includes(cat) || false}
                          onChange={() => handleCategoryToggle(user.id, cat, user.categories || [])}
                        />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  {user.id !== currentUser.id && (
                    <button
                      className="btn-delete-user"
                      onClick={() => handleDelete(user.id, user.name)}
                      title="Delete user"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

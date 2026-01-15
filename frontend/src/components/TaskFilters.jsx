import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function TaskFilters({ filters, onChange }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({
      search: '',
      status: '',
      priority: '',
      assignee: ''
    });
  };

  const hasFilters = filters.search || filters.status || filters.priority || filters.assignee;

  return (
    <div className="filters">
      <div className="filter-group" style={{ flex: 2 }}>
        <label className="filter-label">Search</label>
        <input
          type="text"
          className="filter-input"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Status</label>
        <select
          className="filter-input"
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="not started">Not Started</option>
          <option value="in progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Priority</label>
        <select
          className="filter-input"
          value={filters.priority}
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Assignee</label>
        <select
          className="filter-input"
          value={filters.assignee}
          onChange={(e) => handleChange('assignee', e.target.value)}
        >
          <option value="">All Assignees</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}

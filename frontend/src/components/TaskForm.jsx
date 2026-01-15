import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const CATEGORIES = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];

export default function TaskForm({ task, parentTask, onSubmit, onCancel }) {
  // Category is only for root tasks (no parent)
  const isRootTask = !parentTask && !task?.parent_task_id;

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    start_date: task?.start_date || '',
    due_date: task?.due_date || '',
    priority: task?.priority || 'medium',
    assigned_to: task?.assigned_to || '',
    category: task?.category || ''
  });
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get('/users/assignable');
      setUsers(data);
      if (!formData.assigned_to && data.length > 0) {
        setFormData(prev => ({ ...prev, assigned_to: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        assigned_to: parseInt(formData.assigned_to)
      };

      if (parentTask) {
        payload.parent_task_id = parentTask.id;
      }

      // Only include category for root tasks
      if (!isRootTask) {
        delete payload.category;
      }

      if (task) {
        await api.put(`/tasks/${task.id}`, payload);
      } else {
        await api.post('/tasks', payload);
      }

      onSubmit?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      {parentTask && (
        <div className="alert" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }}>
          Adding subtask under: <strong>{parentTask.title}</strong>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Title *</label>
        <input
          type="text"
          name="title"
          className="form-input"
          value={formData.title}
          onChange={handleChange}
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          name="description"
          className="form-textarea"
          value={formData.description}
          onChange={handleChange}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Assign To *</label>
        <select
          name="assigned_to"
          className="form-select"
          value={formData.assigned_to}
          onChange={handleChange}
          required
        >
          <option value="">Select assignee</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} (Level {user.seniority_level})
            </option>
          ))}
        </select>
        <small className="text-muted">You can assign to yourself or junior members</small>
      </div>

      {isRootTask && (
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            name="category"
            className="form-select"
            value={formData.category}
            onChange={handleChange}
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <small className="text-muted">Categorize this task for easier filtering</small>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            name="start_date"
            className="form-input"
            value={formData.start_date}
            onChange={handleChange}
            min={parentTask?.start_date || ''}
          />
          {parentTask?.start_date && (
            <small className="text-muted">Cannot be before {parentTask.start_date}</small>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input
            type="date"
            name="due_date"
            className="form-input"
            value={formData.due_date}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Priority</label>
        <select
          name="priority"
          className="form-select"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="modal-footer" style={{ padding: '16px 0 0', margin: '16px 0 0', borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}

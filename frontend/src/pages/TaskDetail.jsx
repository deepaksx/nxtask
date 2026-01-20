import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];

// Format date for HTML date input (requires YYYY-MM-DD)
const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  // Handle ISO format (2026-01-20T00:00:00.000Z) or plain date (2026-01-20)
  return dateStr.split('T')[0];
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    due_date: '',
    priority: 'medium',
    status: 'not started',
    assigned_to: '',
    category: ''
  });

  useEffect(() => {
    loadTask();
    loadUsers();
  }, [id]);

  const loadTask = async () => {
    try {
      const data = await api.get(`/tasks/${id}`);
      setTask(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        start_date: formatDateForInput(data.start_date),
        due_date: formatDateForInput(data.due_date),
        priority: data.priority || 'medium',
        status: data.status || 'not started',
        assigned_to: data.assigned_to || '',
        category: data.category || ''
      });
    } catch (err) {
      console.error('Failed to load task:', err);
      setError('Task not found');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Update task details (only if creator)
      if (task.created_by === user.id) {
        const updateData = {
          title: formData.title,
          description: formData.description,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          priority: formData.priority,
          assigned_to: parseInt(formData.assigned_to)
        };
        // Include category only for root tasks
        if (!task.parent_task_id) {
          updateData.category = formData.category || null;
        }
        await api.put(`/tasks/${id}`, updateData);
      }

      // Update status (only if assignee)
      if (task.assigned_to === user.id && formData.status !== task.status) {
        await api.patch(`/tasks/${id}/status`, {
          status: formData.status
        });
      }

      navigate(-1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await api.delete(`/tasks/${id}`);
      navigate(-1);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Task not found</div>
        <button onClick={() => navigate(-1)} className="btn btn-primary mt-4">
          Go Back
        </button>
      </div>
    );
  }

  const isCreator = task.created_by === user.id;
  const isAssignee = task.assigned_to === user.id;
  const canEdit = isCreator;
  const canChangeStatus = isAssignee;
  const canDelete = isCreator && (!task.subtasks || task.subtasks.length === 0);
  const isRootTask = !task.parent_task_id;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="btn btn-secondary mb-4"
        style={{ gap: '4px' }}
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>&larr;</span> Back
      </button>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Edit Task</h2>
          {canDelete && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>

        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}

          {!canEdit && !canChangeStatus && (
            <div className="alert" style={{ background: '#fefce8', border: '1px solid #fde047', color: '#a16207', marginBottom: '16px' }}>
              You can only view this task. Only the creator can edit details, and only the assignee can change status.
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                name="title"
                className="form-input"
                value={formData.title}
                onChange={handleChange}
                disabled={!canEdit}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                value={formData.description}
                onChange={handleChange}
                disabled={!canEdit}
                rows={4}
              />
            </div>

            {isRootTask && (
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  name="category"
                  className="form-select"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={!canEdit}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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
                  disabled={!canEdit}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  name="due_date"
                  className="form-input"
                  value={formData.due_date}
                  onChange={handleChange}
                  disabled={!canEdit}
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
                disabled={!canEdit}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <select
                  name="assigned_to"
                  className="form-select"
                  value={formData.assigned_to}
                  onChange={handleChange}
                  disabled={!canEdit}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} (Level {u.seniority_level})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-select"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={!canChangeStatus}
                >
                  <option value="not started">Not Started</option>
                  <option value="in progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
                {!canChangeStatus && (
                  <small className="text-muted">Only assignee can change status</small>
                )}
              </div>
            </div>

            {/* Task Info */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div>
                  <strong>Created by:</strong> {task.creator_name}
                </div>
                <div>
                  <strong>Created:</strong> {new Date(task.created_at).toLocaleDateString()}
                </div>
                {task.completed_at && (
                  <div>
                    <strong>Completed:</strong> {new Date(task.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>
              {(canEdit || canChangeStatus) && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

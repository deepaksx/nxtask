import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function TaskCard({ task, onUpdate, onAddSubtask }) {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';
  const isAssignee = task.assigned_to === user.id;
  const isCreator = task.created_by === user.id;
  const canComplete = isAssignee;
  const canEdit = isCreator;
  const canAddSubtask = isAssignee;

  const handleStatusChange = async (newStatus) => {
    if (!canComplete || updating) return;

    setUpdating(true);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status: newStatus });
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleCheckboxChange = (e) => {
    if (e.target.checked) {
      handleStatusChange('completed');
    } else {
      handleStatusChange('in progress');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`task-card ${isOverdue ? 'overdue' : ''} ${isCompleted ? 'completed' : ''}`}>
      <div className="task-header">
        <div className="tooltip-wrapper">
          <input
            type="checkbox"
            className="task-checkbox"
            checked={isCompleted}
            onChange={handleCheckboxChange}
            disabled={!canComplete || updating}
          />
          {!canComplete && (
            <span className="tooltip">Only the assignee can complete this task</span>
          )}
        </div>

        <Link to={`/task/${task.id}`} className={`task-title ${isCompleted ? 'completed' : ''}`}>
          {task.title}
        </Link>

        <span className={`priority priority-${task.priority}`}>
          {task.priority}
        </span>
      </div>

      <div className="task-meta">
        <span className="task-meta-item">
          <span className={`status status-${task.status.replace(' ', '-')}`}>
            {task.status}
          </span>
        </span>

        <span className="task-meta-item">
          Assigned to: <strong>{task.assignee_name}</strong>
        </span>

        <span className={`task-meta-item ${isOverdue ? 'text-danger' : ''}`}>
          Due: {formatDate(task.due_date)}
          {isOverdue && ' (Overdue)'}
        </span>

        {task.creator_name && (
          <span className="task-meta-item">
            Created by: {task.creator_name}
          </span>
        )}
      </div>

      <div className="task-actions">
        {canAddSubtask && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onAddSubtask?.(task)}
          >
            + Add Subtask
          </button>
        )}

        {!canAddSubtask && (
          <div className="tooltip-wrapper">
            <button className="btn btn-secondary btn-sm" disabled>
              + Add Subtask
            </button>
            <span className="tooltip">You can only add subtasks to tasks assigned to you</span>
          </div>
        )}

        {canEdit && (
          <Link to={`/task/${task.id}?edit=true`} className="btn btn-secondary btn-sm">
            Edit
          </Link>
        )}

        {!canEdit && (
          <div className="tooltip-wrapper">
            <button className="btn btn-secondary btn-sm" disabled>
              Edit
            </button>
            <span className="tooltip">You can only edit tasks you created</span>
          </div>
        )}

        {!isCompleted && canComplete && (
          <select
            className="form-select"
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
            disabled={updating}
          >
            <option value="not started">Not Started</option>
            <option value="in progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        )}
      </div>
    </div>
  );
}

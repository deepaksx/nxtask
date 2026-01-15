import { useState } from 'react';
import TaskCard from './TaskCard';

function TaskTreeItem({ task, onUpdate, onAddSubtask, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return (
    <div className="task-tree-item">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {hasSubtasks && (
          <button
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
            style={{ marginTop: '16px' }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasSubtasks && <div style={{ width: '24px' }} />}

        <div style={{ flex: 1 }}>
          <TaskCard
            task={task}
            onUpdate={onUpdate}
            onAddSubtask={onAddSubtask}
          />
        </div>
      </div>

      {hasSubtasks && expanded && (
        <div className="task-tree-children">
          {task.subtasks.map((subtask) => (
            <TaskTreeItem
              key={subtask.id}
              task={subtask}
              onUpdate={onUpdate}
              onAddSubtask={onAddSubtask}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskTree({ tasks, onUpdate, onAddSubtask }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No tasks found</div>
        <p>Tasks will appear here when created.</p>
      </div>
    );
  }

  return (
    <div className="task-tree">
      {tasks.map((task) => (
        <TaskTreeItem
          key={task.id}
          task={task}
          onUpdate={onUpdate}
          onAddSubtask={onAddSubtask}
        />
      ))}
    </div>
  );
}

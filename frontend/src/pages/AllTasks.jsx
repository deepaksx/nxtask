import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import TaskTree from '../components/TaskTree';
import TaskFilters from '../components/TaskFilters';
import Modal from '../components/Modal';
import TaskForm from '../components/TaskForm';

export default function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [parentTask, setParentTask] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    assignee: ''
  });

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.assignee) params.append('assignee', filters.assignee);

      const queryString = params.toString();
      const url = `/tasks${queryString ? `?${queryString}` : ''}`;

      const data = await api.get(url);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadTasks();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [loadTasks]);

  const handleCreateTask = () => {
    setParentTask(null);
    setShowModal(true);
  };

  const handleAddSubtask = (task) => {
    setParentTask(task);
    setShowModal(true);
  };

  const handleFormSubmit = () => {
    setShowModal(false);
    setParentTask(null);
    loadTasks();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setParentTask(null);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">All Tasks</h1>
        <button className="btn btn-primary" onClick={handleCreateTask}>
          + Create Task
        </button>
      </div>

      <p className="text-muted mb-4">
        View all tasks in the organization. Use filters to find specific tasks.
      </p>

      <TaskFilters filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <TaskTree
          tasks={tasks}
          onUpdate={loadTasks}
          onAddSubtask={handleAddSubtask}
        />
      )}

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={parentTask ? 'Add Subtask' : 'Create New Task'}
      >
        <TaskForm
          parentTask={parentTask}
          onSubmit={handleFormSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
}

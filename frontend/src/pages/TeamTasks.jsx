import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import TaskTree from '../components/TaskTree';
import Modal from '../components/Modal';
import TaskForm from '../components/TaskForm';

export default function TeamTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [parentTask, setParentTask] = useState(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.get('/tasks/team');
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Team Tasks</h1>
        <button className="btn btn-primary" onClick={handleCreateTask}>
          + Create Task
        </button>
      </div>

      <p className="text-muted mb-4">
        Tasks assigned to your team members (users with lower seniority than you).
        Create tasks here to assign to your juniors.
      </p>

      <TaskTree
        tasks={tasks}
        onUpdate={loadTasks}
        onAddSubtask={handleAddSubtask}
      />

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

import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import GanttChart from '../components/GanttChart';
import Modal from '../components/Modal';
import TaskForm from '../components/TaskForm';

export default function GanttView() {
  const { user } = useAuth();
  const canCreateMainTask = user?.seniority_level === 1;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [parentTask, setParentTask] = useState(null);
  const [hideCompleted, setHideCompleted] = useState(true); // Default: hide completed
  const [selectedCategories, setSelectedCategories] = useState([]); // Empty = all categories
  const [showMyTasks, setShowMyTasks] = useState(false); // Filter to show only my tasks

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.get('/tasks');
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
    <div className="gantt-page">
      <GanttChart
        tasks={tasks}
        hideCompletedRoots={hideCompleted}
        onHideCompletedChange={setHideCompleted}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        highlightMyTasks={showMyTasks}
        onHighlightMyTasksChange={setShowMyTasks}
        onCreateTask={canCreateMainTask ? handleCreateTask : null}
        onAddSubtask={handleAddSubtask}
        onRefresh={loadTasks}
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

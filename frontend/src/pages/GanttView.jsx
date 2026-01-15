import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import GanttChart from '../components/GanttChart';
import Modal from '../components/Modal';
import TaskForm from '../components/TaskForm';

export default function GanttView() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(true);
  };

  const handleFormSubmit = () => {
    setShowModal(false);
    loadTasks();
  };

  const handleCloseModal = () => {
    setShowModal(false);
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
        onCreateTask={handleCreateTask}
        onRefresh={loadTasks}
      />

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Create New Task"
      >
        <TaskForm
          onSubmit={handleFormSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
}

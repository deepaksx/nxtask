import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROW_HEIGHT = 36;
const LIST_WIDTH = 320;

// Width per day for each view mode
const VIEW_MODES = {
  day: { width: 36, label: 'Day' },
  week: { width: 12, label: 'Week' },
  month: { width: 4, label: 'Month' }
};

function getDateRange(tasks) {
  let minDate = new Date();
  let maxDate = new Date();

  // Ensure enough days before and after today for planning
  // Show 6 months before and 12 months after today minimum
  minDate.setDate(minDate.getDate() - 180);
  maxDate.setDate(maxDate.getDate() + 365);

  const findDates = (taskList) => {
    taskList.forEach(task => {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate > maxDate) maxDate = new Date(dueDate);
      }
      if (task.start_date) {
        const startDate = new Date(task.start_date);
        if (startDate < minDate) minDate = new Date(startDate);
      }
      if (task.subtasks?.length) {
        findDates(task.subtasks);
      }
    });
  };

  findDates(tasks);
  // Add buffer after finding task dates
  minDate.setDate(minDate.getDate() - 14);
  maxDate.setDate(maxDate.getDate() + 60);

  return { minDate, maxDate };
}

function getDaysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

function generateDays(minDate, maxDate) {
  const days = [];
  const current = new Date(minDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(maxDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function flattenTasks(tasks, level = 0, expanded = {}, collapseByDefault = false, maxLevel = Infinity) {
  const result = [];
  tasks.forEach(task => {
    const hasChildren = task.subtasks?.length > 0;
    result.push({ ...task, level, hasChildren });

    // Check if we should expand based on maxLevel
    if (maxLevel !== Infinity) {
      // Level-based expansion: expand if current level is less than maxLevel
      if (hasChildren && level < maxLevel) {
        result.push(...flattenTasks(task.subtasks, level + 1, expanded, collapseByDefault, maxLevel));
      }
    } else {
      // Manual expansion mode
      // If collapseByDefault: only expand if explicitly set to true
      // Otherwise: expand unless explicitly set to false
      const isExpanded = collapseByDefault
        ? expanded[task.id] === true
        : expanded[task.id] !== false;

      if (hasChildren && isExpanded) {
        result.push(...flattenTasks(task.subtasks, level + 1, expanded, collapseByDefault, maxLevel));
      }
    }
  });
  return result;
}

// Find all ancestor task IDs that need to be expanded to show user's tasks
function findPathsToUserTasks(tasks, userId, ancestors = []) {
  const expandedIds = new Set();

  tasks.forEach(task => {
    const isMyTask = task.assigned_to === userId;

    if (isMyTask) {
      // Add all ancestors to expanded set
      ancestors.forEach(id => expandedIds.add(id));
    }

    if (task.subtasks?.length) {
      const childExpanded = findPathsToUserTasks(
        task.subtasks,
        userId,
        [...ancestors, task.id]
      );
      childExpanded.forEach(id => expandedIds.add(id));
    }
  });

  return expandedIds;
}

// Check if a task or any of its descendants is assigned to the user
function hasUserTaskInHierarchy(task, userId) {
  if (task.assigned_to === userId) return true;
  if (task.subtasks?.length) {
    return task.subtasks.some(subtask => hasUserTaskInHierarchy(subtask, userId));
  }
  return false;
}

const ALL_CATEGORIES = ['Projects', 'Pre-Sales', 'Admin', 'Miscellaneous'];

export default function GanttChart({
  tasks,
  highlightMyTasks = false,
  onHighlightMyTasksChange = null,
  hideCompletedRoots = false,
  onHideCompletedChange = null,
  selectedCategories = [],
  onCategoryChange = null,
  onCreateTask = null,
  onRefresh = null
}) {
  const { user } = useAuth();
  const [expandedInitialized, setExpandedInitialized] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [viewMode, setViewMode] = useState('day');
  const [expandLevel, setExpandLevel] = useState('all'); // 'all', '1', '2', '3'
  const bodyRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const timelineHeaderRef = useRef(null);

  const DAY_WIDTH = VIEW_MODES[viewMode].width;

  // Filter tasks based on conditions
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter out completed root-level tasks if hideCompletedRoots is true
    if (hideCompletedRoots) {
      result = result.filter(task => task.status !== 'completed');
    }

    // Filter by selected categories (only affects root tasks which have categories)
    if (selectedCategories.length > 0) {
      result = result.filter(task => selectedCategories.includes(task.category));
    }

    // In "My Tasks" mode, only show hierarchies that contain user's tasks
    if (highlightMyTasks && user) {
      result = result.filter(task => hasUserTaskInHierarchy(task, user.id));
    }

    return result;
  }, [tasks, hideCompletedRoots, highlightMyTasks, user, selectedCategories]);

  // Initialize expanded state based on mode
  useEffect(() => {
    if (highlightMyTasks && user && filteredTasks.length > 0 && !expandedInitialized) {
      // For "My Tasks" - collapse all except paths to user's tasks
      const pathsToExpand = findPathsToUserTasks(filteredTasks, user.id);
      const initialExpanded = {};
      pathsToExpand.forEach(id => {
        initialExpanded[id] = true;
      });
      setExpanded(initialExpanded);
      setExpandedInitialized(true);
    }
  }, [highlightMyTasks, user, filteredTasks, expandedInitialized]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { minDate, maxDate } = useMemo(() => getDateRange(filteredTasks), [filteredTasks]);
  const days = useMemo(() => generateDays(minDate, maxDate), [minDate, maxDate]);
  const maxExpandLevel = expandLevel === 'all' ? Infinity : parseInt(expandLevel) - 1;
  const flatTasks = useMemo(() => flattenTasks(filteredTasks, 0, expanded, highlightMyTasks, maxExpandLevel), [filteredTasks, expanded, highlightMyTasks, maxExpandLevel]);

  const todayOffset = getDaysBetween(minDate, today);
  const timelineWidth = days.length * DAY_WIDTH;

  const handleToggle = (taskId) => {
    // Switch to manual mode when user clicks a toggle
    setExpandLevel('all');
    setExpanded(prev => {
      const currentState = prev[taskId];
      let newState;

      if (highlightMyTasks) {
        // Collapse by default mode: toggle between true and undefined/false
        newState = currentState === true ? false : true;
      } else {
        // Expand by default mode: toggle between false and undefined/true
        newState = currentState === false ? true : false;
      }

      return { ...prev, [taskId]: newState };
    });
  };

  const handleTimelineScroll = (e) => {
    // Sync header scroll with body scroll
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const scrollToToday = () => {
    if (timelineScrollRef.current) {
      const containerWidth = timelineScrollRef.current.clientWidth;
      const todayPosition = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;
      const scrollPosition = todayPosition - containerWidth / 2;

      timelineScrollRef.current.scrollLeft = Math.max(0, scrollPosition);
      if (timelineHeaderRef.current) {
        timelineHeaderRef.current.scrollLeft = Math.max(0, scrollPosition);
      }
    }
  };

  // Auto-scroll to today when view mode changes
  useEffect(() => {
    // Use double requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (timelineScrollRef.current) {
          const containerWidth = timelineScrollRef.current.clientWidth;
          const todayPosition = todayOffset * DAY_WIDTH + DAY_WIDTH / 2;
          const scrollPosition = todayPosition - containerWidth / 2;

          timelineScrollRef.current.scrollLeft = Math.max(0, scrollPosition);
          if (timelineHeaderRef.current) {
            timelineHeaderRef.current.scrollLeft = Math.max(0, scrollPosition);
          }
        }
      });
    });
  }, [viewMode, DAY_WIDTH, todayOffset]);

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const isToday = (date) => {
    return date.toDateString() === today.toDateString();
  };

  const months = useMemo(() => {
    const result = [];
    let currentMonth = null;
    let startIndex = 0;

    days.forEach((day, index) => {
      const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
      if (monthKey !== currentMonth) {
        if (currentMonth !== null) {
          result.push({
            label: days[startIndex].toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            count: index - startIndex
          });
        }
        currentMonth = monthKey;
        startIndex = index;
      }
    });

    if (currentMonth !== null) {
      result.push({
        label: days[startIndex].toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: days.length - startIndex
      });
    }

    return result;
  }, [days]);

  const getBarStyle = (task) => {
    // Use start_date if available, otherwise fall back to today
    const startDate = task.start_date ? new Date(task.start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate;
    if (task.due_date) {
      endDate = new Date(task.due_date);
    } else {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);
    }
    endDate.setHours(0, 0, 0, 0);

    const startOffset = getDaysBetween(minDate, startDate);
    const duration = Math.max(getDaysBetween(startDate, endDate), 1);

    const isOverdue = task.due_date && new Date(task.due_date) < today && task.status !== 'completed';
    const isCompleted = task.status === 'completed';

    // Colors based on STATUS only
    let color;
    if (isCompleted) {
      color = '#22c55e'; // Green for completed
    } else if (isOverdue) {
      color = '#ef4444'; // Red for overdue
    } else {
      color = '#3b82f6'; // Blue for in-progress/not started
    }

    const minBarWidth = viewMode === 'day' ? 30 : viewMode === 'week' ? 10 : 4;

    return {
      left: startOffset * DAY_WIDTH,
      width: Math.max(duration * DAY_WIDTH - 2, minBarWidth),
      color,
      isOverdue,
      isCompleted
    };
  };

  if (!filteredTasks || filteredTasks.length === 0) {
    return (
      <div className="gantt-empty">
        <div className="gantt-toolbar">
          <div className="gantt-toolbar-left">
            {onHideCompletedChange && (
              <label className="gantt-checkbox" title="Hide completed root tasks">
                <input
                  type="checkbox"
                  checked={hideCompletedRoots}
                  onChange={(e) => onHideCompletedChange(e.target.checked)}
                />
                <span>Hide Completed</span>
              </label>
            )}
          </div>
          <div className="gantt-toolbar-right">
            {onCreateTask && (
              <button className="btn btn-primary btn-sm" onClick={onCreateTask}>
                + New Task
              </button>
            )}
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No tasks to display</div>
          <p>{hideCompletedRoots ? 'All top-level tasks are completed. Turn off "Hide Completed" to see them.' : 'Click "+ New Task" to get started.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-wrapper">
      {/* Toolbar */}
      <div className="gantt-toolbar">
        <div className="gantt-toolbar-left">
        </div>
        {onCategoryChange && (
          <div className="gantt-toolbar-center">
            <div className="gantt-toolbar-group">
              <span className="gantt-toolbar-label">Filter:</span>
              {user?.categories?.length > 1 && (
                <button
                  className={`btn-view ${selectedCategories.length === 0 ? 'active' : ''}`}
                  onClick={() => onCategoryChange([])}
                  title="Show all categories"
                >
                  All
                </button>
              )}
              {(user?.categories || ALL_CATEGORIES).map(cat => (
                <button
                  key={cat}
                  className={`btn-view ${selectedCategories.includes(cat) ? 'active' : ''}`}
                  onClick={() => {
                    if (selectedCategories.includes(cat)) {
                      onCategoryChange(selectedCategories.filter(c => c !== cat));
                    } else {
                      onCategoryChange([...selectedCategories, cat]);
                    }
                  }}
                  title={`Filter by ${cat}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {onHideCompletedChange && (
              <label className="gantt-checkbox" title="Hide completed root tasks">
                <input
                  type="checkbox"
                  checked={hideCompletedRoots}
                  onChange={(e) => onHideCompletedChange(e.target.checked)}
                />
                <span>Hide Completed</span>
              </label>
            )}
            {onHighlightMyTasksChange && (
              <button
                className={`btn-view btn-my-tasks ${highlightMyTasks ? 'active' : ''}`}
                onClick={() => onHighlightMyTasksChange(!highlightMyTasks)}
                title="Show only my tasks"
              >
                My Tasks
              </button>
            )}
          </div>
        )}
        <div className="gantt-toolbar-right">
          <div className="gantt-toolbar-group">
            <span className="gantt-toolbar-label">Zoom:</span>
            {Object.entries(VIEW_MODES).map(([mode, config]) => (
              <button
                key={mode}
                className={`btn-view ${viewMode === mode ? 'active' : ''}`}
                onClick={() => setViewMode(mode)}
                title={`${config.label} view`}
              >
                {config.label}
              </button>
            ))}
            <button className="btn-today" onClick={scrollToToday} title="Scroll to today">
              Today
            </button>
          </div>
          {onCreateTask && (
            <button className="btn btn-primary btn-sm" onClick={onCreateTask}>
              + New Task
            </button>
          )}
          {onRefresh && (
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Refresh tasks">
              ↻
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="gantt-header-row">
        <div className="gantt-list-header">
          <span>Task</span>
          <div className="gantt-expand-controls">
            <button
              className="btn-expand-header"
              onClick={() => {
                const current = expandLevel === 'all' ? 4 : parseInt(expandLevel);
                if (current > 1) setExpandLevel(String(current - 1));
              }}
              title="Collapse one level"
            >
              −
            </button>
            <button
              className="btn-expand-header"
              onClick={() => {
                const current = expandLevel === 'all' ? 4 : parseInt(expandLevel);
                if (current < 4) setExpandLevel(current === 3 ? 'all' : String(current + 1));
              }}
              title="Expand one level"
            >
              +
            </button>
          </div>
        </div>
        <div className="gantt-timeline-header" ref={timelineHeaderRef}>
          <div className="gantt-header-inner" style={{ width: timelineWidth }}>
            <div className="gantt-months-row">
              {months.map((month, i) => (
                <div
                  key={i}
                  className="gantt-month-cell"
                  style={{ width: month.count * DAY_WIDTH }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div className="gantt-days-row">
              {days.map((day, i) => {
                const showDate = viewMode === 'day' ||
                  (viewMode === 'week' && day.getDay() === 1) ||
                  (viewMode === 'month' && day.getDate() === 1);
                return (
                  <div
                    key={i}
                    className={`gantt-day-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''} view-${viewMode}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    {showDate ? day.getDate() : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="gantt-body-row" ref={bodyRef}>
        {/* Task List */}
        <div className="gantt-list-body">
          {flatTasks.map((task) => {
            const isMyTask = task.assigned_to === user?.id;
            const isDimmed = highlightMyTasks && !isMyTask;
            const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';

            return (
              <div
                key={task.id}
                className={`gantt-list-row ${isMyTask && highlightMyTasks ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
                style={{ height: ROW_HEIGHT, paddingLeft: 12 + task.level * 16 }}
              >
                {task.hasChildren ? (
                  <button className="gantt-toggle" onClick={() => handleToggle(task.id)}>
                    {expanded[task.id] === false ? '▶' : '▼'}
                  </button>
                ) : (
                  <span className="gantt-toggle-space" />
                )}
                <span className="gantt-priority" title={`${task.priority} priority`}>{priorityEmoji}</span>
                <Link to={`/task/${task.id}`} className={`gantt-task-name ${task.status === 'completed' ? 'completed' : ''}`}>
                  {task.title}
                </Link>
                {isMyTask && highlightMyTasks && <span className="gantt-my-badge">ME</span>}
                <span className="gantt-task-assignee">{task.assignee_name?.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="gantt-timeline-body" ref={timelineScrollRef} onScroll={handleTimelineScroll}>
          <div className="gantt-timeline-inner" style={{ width: timelineWidth, height: flatTasks.length * ROW_HEIGHT }}>
            {/* Grid */}
            {days.map((day, i) => (
              <div
                key={i}
                className={`gantt-grid-col ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''}`}
                style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, height: flatTasks.length * ROW_HEIGHT }}
              />
            ))}

            {/* Today line */}
            <div
              className="gantt-today-line"
              style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
            />

            {/* Bars */}
            {flatTasks.map((task, index) => {
              const bar = getBarStyle(task);
              const isMyTask = task.assigned_to === user?.id;
              const isDimmed = highlightMyTasks && !isMyTask;

              return (
                <Link
                  key={task.id}
                  to={`/task/${task.id}`}
                  className={`gantt-bar ${bar.isCompleted ? 'completed' : ''} ${bar.isOverdue ? 'overdue' : ''} ${isMyTask && highlightMyTasks ? 'my-task' : ''} ${isDimmed ? 'dimmed' : ''}`}
                  style={{
                    top: index * ROW_HEIGHT + 4,
                    left: bar.left,
                    width: bar.width,
                    height: ROW_HEIGHT - 8,
                    backgroundColor: bar.color
                  }}
                  title={`${task.title}\nStatus: ${task.status}\nDue: ${task.due_date || 'Not set'}${isMyTask ? '\n(Assigned to you)' : ''}`}
                >
                  <span className="gantt-bar-text">{task.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

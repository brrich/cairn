import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Task } from "@/types";
import { TaskStatus } from "@/types/task";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import TaskDetailsSidebar from "./TaskDetailsSidebar";
import TaskLogsDialog from "./TaskLogsDialog";
import TaskDetailsModal from "./TaskDetailsModal";
import { useTasks } from "@/contexts/TaskContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTask as deleteTaskService } from "@/services/taskService";

interface KanbanBoardProps {
  project?: string;
}

// Mock logs data
const mockLogs = {
  columnId: "Running",
  tasks: [
    {
      taskId: "task-123",
      title: "Implement user authentication",
      events: [
        {
          timestamp: "2023-07-15T12:30:45Z",
          type: "status_change",
          data: { from: "Queued", to: "Running" }
        },
        {
          timestamp: "2023-07-15T12:45:22Z",
          type: "agent_assigned",
          data: { agent: "Fullstack" }
        }
      ]
    },
    {
      taskId: "task-124",
      title: "Create dashboard UI",
      events: [
        {
          timestamp: "2023-07-16T09:15:30Z",
          type: "status_change",
          data: { from: "Queued", to: "Running" }
        },
        {
          timestamp: "2023-07-16T10:20:45Z",
          type: "comment_added",
          data: { comment: "Working on implementing the feature" }
        }
      ]
    }
  ]
};

// Helper function to sort tasks by due date
const sortTasksByDueDate = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
};

// Helper function to check if a task is a child task
const isChildTask = (task: Task): boolean => {
  return !!task.parent_run_id || !!task.parent_fullstack_id;
};

// Helper function to check if a task has subtasks in its agent_output
const hasSubtasksInOutput = (task: Task): boolean => {
  return (
    task.agent_type === "Fullstack" &&
    (task.status === "Done" || task.status === "Waiting for Input") &&
    !!task.agent_output &&
    !!task.agent_output.list_of_subtasks &&
    Array.isArray(task.agent_output.list_of_subtasks) &&
    task.agent_output.list_of_subtasks.length > 0
  );
};

// Interface for virtual subtasks created from agent output
interface VirtualSubtask {
  id: string;
  title: string;
  description: string;
  repo: string;
  difficulty: string;
  assignment: string;
  index: number;
  parentTaskId: string;
}

export default function KanbanBoard({ project }: KanbanBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isDetailsSidebarOpen, setIsDetailsSidebarOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedTaskIdForLogs, setSelectedTaskIdForLogs] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);
  const [currentSubtaskIndex, setCurrentSubtaskIndex] = useState<number | null>(null);
  const [currentParentTaskId, setCurrentParentTaskId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [isCreatingAllSubtasks, setIsCreatingAllSubtasks] = useState(false);
  const [currentRunAllTaskId, setCurrentRunAllTaskId] = useState<string | null>(null);
  const { tasks, isLoading, error, deleteTask: removeTaskFromState, refreshTasks } = useTasks();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Toggle task expansion
  const toggleTaskExpansion = (taskId: string) => {
    const newExpandedTasks = new Set(expandedTasks);
    if (newExpandedTasks.has(taskId)) {
      newExpandedTasks.delete(taskId);
    } else {
      newExpandedTasks.add(taskId);
    }
    setExpandedTasks(newExpandedTasks);
  };

  // Create a subtask from fullstack planner output
  const createSubtask = async (parentTaskId: string, subtaskIndex: number) => {
    setIsCreatingSubtask(true);
    setCurrentSubtaskIndex(subtaskIndex);
    setCurrentParentTaskId(parentTaskId);

    try {
      const response = await fetch('http://localhost:8000/create-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullstack_planner_run_id: parentTaskId,
          subtask_index: subtaskIndex
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create subtask');
      }

      const result = await response.json();

      if (result.created_tasks.length > 0) {
        toast({
          title: "Success",
          description: `Created subtask successfully`,
        });
        // Refresh tasks to show the newly created subtask
        refreshTasks();
      } else {
        toast({
          title: "Note",
          description: result.message,
          variant: "default",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create subtask",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSubtask(false);
      setCurrentSubtaskIndex(null);
      setCurrentParentTaskId(null);
    }
  };

  // Run a subtask that's already been created
  const runSubtask = async (taskId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/run-task/${taskId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to run task');
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: "Task started successfully",
      });

      // Refresh tasks to show updated status
      refreshTasks();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run task",
        variant: "destructive",
      });
    }
  };

  // Handle task deletion
  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTaskService(task.id);
      // Remove task from local state
      removeTaskFromState(task.id);
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Memoize filtered tasks to prevent unnecessary re-renders
  const { projectTasks, queuedTasks, runningTasks, doneTasks, failedTasks, waitingForInputTasks, taskMap, childTaskMap, virtualSubtaskMap } = useMemo(() => {
    // Filter tasks by project if specified
    const filteredTasks = project
      ? tasks.filter(task => task.repos?.includes(project))
      : tasks;

    // Create a map of tasks by their IDs for quick lookup
    const taskMap = new Map<string, Task>();
    filteredTasks.forEach(task => {
      taskMap.set(task.id, task);
    });

    // Create a map of child tasks by their parent IDs
    const childTaskMap = new Map<string, Task[]>();
    filteredTasks.forEach(task => {
      // Check for parent relationship - either parent_fullstack_id or parent_run_id
      if (task.parent_fullstack_id || task.parent_run_id) {
        const parentId = task.parent_fullstack_id || task.parent_run_id;
        if (parentId) {
          const children = childTaskMap.get(parentId) || [];
          children.push(task);
          childTaskMap.set(parentId, children);
        }

        // For SWE tasks with parent_run_id (which is a PM task), also add them as children of the parent's parent (Fullstack task)
        if (task.parent_run_id) {
          const pmTask = taskMap.get(task.parent_run_id);
          if (pmTask && pmTask.parent_fullstack_id) {
            // This is a SWE task under a PM task under a Fullstack task
            // Add it as a direct child of the PM task, which we've done above

            // We don't need to add it as a direct child of the Fullstack task
            // because it will be shown nested under the PM task
          }
        }
      }
    });

    // Create virtual subtasks from fullstack planner output
    const virtualSubtaskMap = new Map<string, VirtualSubtask[]>();

    filteredTasks.forEach(task => {
      if (hasSubtasksInOutput(task)) {
        const subtasks = task.agent_output?.list_of_subtasks || [];
        const subtaskTitles = task.agent_output?.list_of_subtask_titles || [];
        const subtaskRepos = task.agent_output?.list_of_subtask_repos || [];
        const subtaskDifficulties = task.agent_output?.assessment_of_subtask_difficulty || [];
        const subtaskAssignments = task.agent_output?.assessment_of_subtask_assignment || [];

        // Check if there are already child tasks for this parent
        const existingChildTasks = childTaskMap.get(task.id) || [];

        // Track which subtask indices already have tasks created
        const existingSubtaskIndices = new Set();

        // Check both by subtask_index and by matching titles/descriptions
        existingChildTasks.forEach(childTask => {
          // Check by subtask_index if available
          if (childTask.agent_output && typeof childTask.agent_output.subtask_index !== 'undefined') {
            existingSubtaskIndices.add(childTask.agent_output.subtask_index);
          }

          // Also check by title/description match
          subtasks.forEach((subtaskDesc: string, idx: number) => {
            const subtaskTitle = subtaskTitles[idx] || `Subtask ${idx + 1}`;

            // If title or description matches, consider this subtask already created
            if (
              (childTask.title && subtaskTitle && childTask.title.includes(subtaskTitle)) ||
              (childTask.description && subtaskDesc && childTask.description.includes(subtaskDesc))
            ) {
              existingSubtaskIndices.add(idx);
            }
          });
        });

        // Only create virtual subtasks for those that don't have real tasks yet
        const virtualSubtasks: VirtualSubtask[] = [];

        subtasks.forEach((subtask: string, index: number) => {
          // Skip if this subtask index already has a real task
          if (existingSubtaskIndices.has(index)) {
            return;
          }

          virtualSubtasks.push({
            id: `virtual-${task.id}-${index}`,
            title: subtaskTitles[index] || `Subtask ${index + 1}`,
            description: subtask,
            repo: subtaskRepos[index] || '',
            difficulty: subtaskDifficulties[index] || 'Not specified',
            assignment: subtaskAssignments[index] || 'agent',
            index,
            parentTaskId: task.id
          });
        });

        if (virtualSubtasks.length > 0) {
          virtualSubtaskMap.set(task.id, virtualSubtasks);
        }
      }
    });

    // Get only parent tasks (tasks without parent_run_id or parent_fullstack_id)
    const getParentTasks = (tasks: Task[]): Task[] => {
      return tasks.filter(task => !isChildTask(task));
    };

    // Filter tasks by status and get only parent tasks
    const queued = sortTasksByDueDate(
      getParentTasks(filteredTasks.filter((task: Task) => task.status === "Queued"))
    );
    const running = sortTasksByDueDate(
      getParentTasks(filteredTasks.filter((task: Task) => task.status === "Running"))
    );
    const done = sortTasksByDueDate(
      getParentTasks(filteredTasks.filter((task: Task) => task.status === "Done"))
    );
    const failed = sortTasksByDueDate(
      getParentTasks(filteredTasks.filter((task: Task) => task.status === "Failed"))
    );
    const waitingForInput = sortTasksByDueDate(
      getParentTasks(filteredTasks.filter((task: Task) => task.status === "Waiting for Input"))
    );

    return {
      projectTasks: filteredTasks,
      queuedTasks: queued,
      runningTasks: running,
      doneTasks: done,
      failedTasks: failed,
      waitingForInputTasks: waitingForInput,
      taskMap,
      childTaskMap,
      virtualSubtaskMap
    };
  }, [tasks, project]);

  // Handle task click to show details modal
  const handleTaskClick = (task: Task) => {
    setSelectedTaskForDetails(task);
    setIsDetailsModalOpen(true);
  };

  // Handle task edit
  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setIsTaskFormOpen(true);
  };

  // Handle view logs click
  const handleViewLogsClick = useCallback((task: Task) => {
    console.log('[KanbanBoard] Opening logs dialog for task:', task.id);
    setSelectedTaskIdForLogs(task.id);
    setLogsDialogOpen(true);
  }, []);

  // This function is no longer used as logs are handled in TaskCard component

  // Render a virtual subtask card
  const renderVirtualSubtaskCard = (subtask: VirtualSubtask) => {
    const isCurrentlyCreating = isCreatingSubtask &&
                               currentSubtaskIndex === subtask.index &&
                               currentParentTaskId === subtask.parentTaskId;

    // Create a virtual task object that looks like a real Task
    const virtualTask: Partial<Task> = {
      id: subtask.id,
      title: subtask.title,
      description: subtask.description,
      status: "Queued", // Virtual tasks are always in "Queued" state
      repos: [subtask.repo],
      agent_type: subtask.assignment === "agent" ? "PM" : "SWE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "system"
    };

    // Create a custom expansion control component that includes our play button
    const customExpansionControl = (
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground border border-[#5d70d5] border-opacity-30 hover:border-opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          createSubtask(subtask.parentTaskId, subtask.index);
        }}
        disabled={isCurrentlyCreating}
        title="Run Task"
      >
        {isCurrentlyCreating ? (
          <>
            <span className="animate-spin text-xs mr-1">⟳</span>
            Creating...
          </>
        ) : (
          <>
            <span className="mr-1">▶</span>
            Run
          </>
        )}
      </Button>
    );

    return (
      <div key={subtask.id} className="relative">
        <TaskCard
          task={virtualTask as Task}
          onClick={() => {}} // No action on click for virtual tasks
          expansionControl={customExpansionControl}
          onViewLogs={handleViewLogsClick}
          onDeleteTask={handleDeleteTask}
          onRunAllChildTasks={undefined}
          isCreatingAllSubtasks={false}
          hasVirtualSubtasks={false}
        />
      </div>
    );
  };

  // Create all subtasks from fullstack planner output
  const runAllChildTasks = async (parentTaskId: string) => {
    setIsCreatingAllSubtasks(true);
    setCurrentRunAllTaskId(parentTaskId);

    try {
      const parentTask = tasks.find(task => task.id === parentTaskId);
      if (!parentTask || !hasSubtasksInOutput(parentTask)) {
        throw new Error('Parent task not found or has no subtasks');
      }

      const subtasks = parentTask.agent_output?.list_of_subtasks || [];
      const virtualSubtasks = virtualSubtaskMap.get(parentTaskId) || [];

      // Only create subtasks that haven't been created yet (i.e., the virtual ones)
      const createPromises = virtualSubtasks.map(async (virtualSubtask) => {
        try {
          const response = await fetch('http://localhost:8000/create-subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullstack_planner_run_id: parentTaskId,
              subtask_index: virtualSubtask.index
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to create subtask ${virtualSubtask.index}`);
          }

          return await response.json();
        } catch (error) {
          console.error(`Error creating subtask ${virtualSubtask.index}:`, error);
          throw error;
        }
      });

      const results = await Promise.allSettled(createPromises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      if (successful > 0) {
        toast({
          title: "Success",
          description: `Created ${successful} subtask${successful > 1 ? 's' : ''} successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        });
        // Refresh tasks to show the newly created subtasks
        refreshTasks();
      } else {
        toast({
          title: "Error",
          description: "Failed to create any subtasks",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create subtasks",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAllSubtasks(false);
      setCurrentRunAllTaskId(null);
    }
  };

  // Render a task card with expansion controls if needed
  const renderTaskCard = (task: Task, nestingLevel: number = 0) => {
    const hasChildren = task.sibling_subtask_ids && task.sibling_subtask_ids.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const childTasks = childTaskMap.get(task.id) || [];
    const virtualSubtasks = virtualSubtaskMap.get(task.id) || [];
    const hasChildTasks = childTasks.length > 0;
    const hasVirtualSubtasks = virtualSubtasks.length > 0;
    const shouldShowExpansionControl = hasChildren || hasChildTasks || hasVirtualSubtasks || hasSubtasksInOutput(task);
    const isCurrentlyCreatingAll = isCreatingAllSubtasks && currentRunAllTaskId === task.id;

        // Create expansion control if task has children or subtasks
    const controls = shouldShowExpansionControl ? (
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 p-0"
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskExpansion(task.id);
        }}
      >
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </Button>
    ) : null;

    // Function to recursively render nested child tasks
    const renderNestedChildTasks = (childTask: Task, level: number) => {
      const nestedChildren = childTaskMap.get(childTask.id) || [];
      const isSubtask = childTask.parent_fullstack_id === task.id || childTask.parent_run_id === task.id;
      const canRun = isSubtask && childTask.status !== "Running" && childTask.status !== "Done";

      return (
        <div key={childTask.id} className="relative">
          <div className={`pl-${level * 4} mt-2`}>
            <TaskCard
              task={childTask}
              onClick={() => handleTaskClick(childTask)}
              expansionControl={nestedChildren.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTaskExpansion(childTask.id);
                  }}
                >
                  {expandedTasks.has(childTask.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              ) : null}
              onViewLogs={handleViewLogsClick}
              onDeleteTask={handleDeleteTask}
              onRunAllChildTasks={undefined}
              isCreatingAllSubtasks={false}
              hasVirtualSubtasks={false}
            />
          </div>

          {/* Render this child's children if expanded */}
          {expandedTasks.has(childTask.id) && nestedChildren.map(nestedChild =>
            renderNestedChildTasks(nestedChild, level + 1)
          )}
        </div>
      );
    };

    return (
      <div key={task.id} className="transition-all duration-300 ease-in-out">
        <TaskCard
          task={task}
          onClick={() => handleTaskClick(task)}
          expansionControl={controls}
          onViewLogs={handleViewLogsClick}
          onDeleteTask={handleDeleteTask}
          onRunAllChildTasks={(task) => runAllChildTasks(task.id)}
          isCreatingAllSubtasks={isCurrentlyCreatingAll}
          hasVirtualSubtasks={virtualSubtasks.length > 0}
        />

        {/* Show child tasks and virtual subtasks when expanded */}
        {isExpanded && (
          <div className="pl-4 mt-2 border-l-2 border-slate-600 space-y-2">
            {/* Render real child tasks with proper nesting */}
            {childTasks.map((childTask: Task) => renderNestedChildTasks(childTask, 1))}

            {/* Render virtual subtasks from agent output */}
            {hasVirtualSubtasks && virtualSubtasks.map(renderVirtualSubtaskCard)}
          </div>
        )}
      </div>
    );
  };

  // Kanban column component
  const KanbanColumn = ({
    title,
    tasks,
    color,
    status,
    columnId
  }: {
    title: string;
    tasks: Task[];
    color: string;
    status: TaskStatus;
    columnId: string;
  }) => (
    <div className="bg-card rounded-lg shadow border border-border flex flex-col h-full">
      <div className="px-4 py-1 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-regular text-sm text-foreground flex items-center">
            <span className={`w-3 h-3 rounded-full ${color} mr-2`}></span>
            {title}
            <span className="ml-2 text-sm bg-muted px-2 py-0.5 rounded-full">{tasks.length}</span>
          </h3>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3 flex-grow overflow-y-auto border-b border-border/30">
        {isLoading ? (
          Array(3).fill(0).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))
        ) : tasks.length === 0 ? (
          <div className="text-center text-muted-foreground h-full flex items-center justify-center min-h-[200px]">
            <p>No tasks</p>
          </div>
        ) : (
          tasks.map(task => renderTaskCard(task))
        )}
      </div>
    </div>
  );

  if (error) {
    return <div className="text-center text-destructive py-4">Error loading tasks</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full">
        <KanbanColumn
          title="Queued"
          tasks={queuedTasks}
          color="bg-gray-500"
          status="Queued"
          columnId="Queued"
        />
        <KanbanColumn
          title="Running"
          tasks={runningTasks}
          color="bg-yellow-500"
          status="Running"
          columnId="Running"
        />
        <KanbanColumn
          title="Waiting for Input"
          tasks={waitingForInputTasks}
          color="bg-blue-500"
          status="Waiting for Input"
          columnId="Waiting for Input"
        />
        <KanbanColumn
          title="Done"
          tasks={doneTasks}
          color="bg-emerald-500"
          status="Done"
          columnId="Done"
        />
        <KanbanColumn
          title="Failed"
          tasks={failedTasks}
          color="bg-red-500"
          status="Failed"
          columnId="Failed"
        />
      </div>

      {/* Task Logs Dialog */}
      {selectedTaskIdForLogs && (
        <TaskLogsDialog
          key={selectedTaskIdForLogs}
          open={logsDialogOpen}
          onOpenChange={(open) => {
            console.log('[KanbanBoard] TaskLogsDialog onOpenChange called with:', open);
            if (!open) {
              setSelectedTaskIdForLogs(null);
            }
            setLogsDialogOpen(open);
          }}
          task={tasks.find(t => t.id === selectedTaskIdForLogs) || null}
        />
      )}

      {/* Task Details Sidebar */}
      {selectedTask && (
        <TaskDetailsSidebar
          task={selectedTask}
          isOpen={isDetailsSidebarOpen}
          onClose={() => setIsDetailsSidebarOpen(false)}
        />
      )}

      {/* Task Edit Form Dialog */}
      <TaskForm
        open={isTaskFormOpen}
        onOpenChange={setIsTaskFormOpen}
        initialData={selectedTask || undefined}
        mode="edit"
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        task={selectedTaskForDetails}
        open={isDetailsModalOpen}
        onOpenChange={setIsDetailsModalOpen}
      />
    </div>
  );
}

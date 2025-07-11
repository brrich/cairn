import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { TaskFormData, TeamUser } from "@/types";
import { AgentType, Task, TaskStatus } from "@/types/task";
import { useToast } from "@/components/ui/use-toast";
import { taskApi } from "@/lib/api/task";
import { useEffect, useRef, useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ChevronDown, Github, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useTasks } from "@/contexts/TaskContext";
import { useTaskProcessingToast } from "@/components/ui/task-processing-toast";

import { Badge } from "@/components/ui/badge";
import { fetchConnectedRepos } from "@/lib/api";
import { fetchModels, ModelsResponse } from "@/lib/api/models";

// Import logo images
import openaiLogo from "@/assets/openai.png";
import anthropicLogo from "@/assets/anthropic.png";
import geminiLogo from "@/assets/gemini.png";
import fullstackIcon from "@/assets/fullstack-icon.png";
import pmIcon from "@/assets/pm-icon.png";
import sweIcon from "@/assets/swe-icon.png";

const customStyles = `
  /* Select item styles */
  [data-radix-select-item]:hover,
  [data-highlighted],
  [role="option"]:hover {
    background-color: rgba(94, 106, 210, 0.1) !important;
  }

  [data-radix-select-item][data-state="checked"],
  [role="option"][aria-selected="true"] {
    background-color: rgb(94, 106, 210) !important;
    color: white !important;
  }

  /* Select all option */
  .select-all-option {
    font-weight: 500;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    margin-bottom: 4px;
    padding-bottom: 4px;
  }

  /* Input and textarea styles */
  .linear-input {
    border: none;
    outline: none;
    box-shadow: none;
    padding: 0;
    height: auto;
    background: transparent;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .linear-input:focus {
    outline: none;
    box-shadow: none;
    ring: none;
  }

  .linear-textarea {
    border: none;
    outline: none;
    box-shadow: none;
    padding: 0;
    background: transparent;
    resize: none;
    min-height: 80px;
  }

  .linear-textarea:focus {
    outline: none;
    box-shadow: none;
    ring: none;
  }

  /* Menu item styles */
  .linear-menu {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    font-size: 14px;
    color: #888;
    height: 28px;
  }

  .linear-menu:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  /* Status color dots */
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
  }

  .queued-dot { background-color: #4673fa; }
  .running-dot { background-color: #f2c94c; }
  .done-dot { background-color: #27ae60; }
  .failed-dot { background-color: #eb5757; }

  /* Hide chevron icons in buttons */
  .linear-menu .select-chevron {
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .linear-menu:hover .select-chevron {
    opacity: 0.7;
  }

  /* Footer styling */
  .linear-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 3px;
    margin-top: 3px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }

  /* Additional fields container */
  .additional-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 3px;
    margin-top: 2px;
    margin-bottom: -8px;
  }

  /* Additional field style */
  .additional-field {
    flex: 1 1 calc(33.333% - 6px);
    min-width: 100px;
  }

  /* Date button styles */
  .date-button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border-radius: 4px;
    width: 100%;
    padding: 5px 8px;
    font-size: 14px;
    color: #888;
    height: 28px;
    border: none;
    background: transparent;
  }

  .date-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .date-button .calendar-icon {
    opacity: 0;
    margin-left: auto;
    transition: opacity 0.2s;
  }

  .date-button:hover .calendar-icon {
    opacity: 0.5;
  }

  /* Tag styles */
  .tag-badge {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 4px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    margin-right: 4px;
    margin-bottom: 4px;
  }

  .tag-badge-bug {
    background-color: rgba(235, 87, 87, 0.12);
    color: #eb5757;
  }

  .tag-badge-feature {
    background-color: rgba(149, 128, 255, 0.12);
    color: #9580ff;
  }

  .tag-badge-improvement {
    background-color: rgba(71, 175, 255, 0.12);
    color: #47afff;
  }

  .tag-badge-custom {
    background-color: rgba(94, 106, 210, 0.12);
    color: #5e6ad2;
  }

  .tag-popover {
    width: 250px;
  }

  .tag-button {
    height: 28px;
    color: #888;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
  }

  .tag-button:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .tag-button .tag-icon {
    opacity: 0.7;
  }

  .tag-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    min-height: 0;
    padding: 0;
    margin-top: 1px;
  }
`;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Custom Repository Select Dropdown Component
interface RepoSelectDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  repositories: Record<string, Repository>;
  isLoading: boolean;
  mode: "create" | "edit";
  agentType: string;
  onRepositoryToggle: (repoId: string) => void;
  isRepositorySelected: (repoId: string) => boolean;
  getRepoDisplayName: (id: string) => string;
  allReposSelected: boolean;
  setAllReposSelected: (selected: boolean) => void;
  formSetValue: any;
}

function RepoSelectDropdown({
  value,
  repositories,
  isLoading,
  mode,
  agentType,
  onRepositoryToggle,
  isRepositorySelected,
  getRepoDisplayName,
  allReposSelected,
  setAllReposSelected,
  formSetValue
}: RepoSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

        // Build options array
   const options = useMemo(() => {
     const opts: Array<{id: string, label: string, type: 'option'}> = [];

     // Add individual repositories
     Object.entries(repositories).forEach(([id, repo]) => {
       opts.push({
         id,
         label: `${repo.owner}/${repo.repo}`,
         type: "option" as const
       });
     });

     return opts;
   }, [repositories]);

     // Handle keyboard navigation
   useEffect(() => {
     if (!isOpen) return;

     const handleKeyDown = (e: KeyboardEvent) => {
       switch (e.key) {
         case 'ArrowDown':
           e.preventDefault();
           setFocusedIndex(prev => (prev + 1) % options.length);
           break;
         case 'ArrowUp':
           e.preventDefault();
           setFocusedIndex(prev => (prev - 1 + options.length) % options.length);
           break;
         case 'Enter':
         case ' ':
           e.preventDefault();
           const focusedOption = options[focusedIndex];
           if (focusedOption) {
             onRepositoryToggle(focusedOption.id);
           }
           break;
         case 'Escape':
           e.preventDefault();
           setIsOpen(false);
           break;
         case 'Tab':
           // Let Tab behave normally (move to next form element)
           setIsOpen(false);
           break;
       }
     };

     document.addEventListener('keydown', handleKeyDown);
     return () => {
       document.removeEventListener('keydown', handleKeyDown);
     };
   }, [isOpen, focusedIndex, options, onRepositoryToggle]);

  // Reset focus when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen]);

  const displayText = useMemo(() => {
    if (isLoading) return "Loading repositories...";
    if (value?.length === 0 || (value?.length === 1 && value[0] === "none")) {
      return mode === "create" ? "All repositories" : "Repositories";
    }
    if (value?.filter(r => r !== "none").length === 1) {
      return getRepoDisplayName(value?.filter(r => r !== "none")[0]);
    }
    return `${value?.filter(r => r !== "none").length} repo${value?.filter(r => r !== "none").length > 1 ? 's' : ''}`;
  }, [value, isLoading, mode, getRepoDisplayName]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="linear-menu w-full flex justify-between"
        >
          <div className="flex items-center">
            <Github className="h-3.5 w-3.5 mr-1 opacity-70" />
            <span className="text-sm">{displayText}</span>
          </div>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
             <PopoverContent className="w-[220px] p-1 shadow-md" align="start">
        <div ref={dropdownRef} className="space-y-1">
                     {options.map((option: any, index: number) => (
            <div
              key={option.id}
                             className={`flex items-center space-x-2 px-2 py-1.5 rounded cursor-pointer transition-colors text-sm ${
                 index === focusedIndex
                   ? 'bg-[#5d70d5] bg-opacity-10'
                   : 'hover:bg-[#5d70d5] hover:bg-opacity-5'
               }`}
                             onClick={() => onRepositoryToggle(option.id)}
            >
                             <Checkbox
                 checked={isRepositorySelected(option.id)}
                 className="h-3.5 w-3.5 data-[state=checked]:bg-[#5d70d5] data-[state=checked]:border-[#5d70d5] pointer-events-none"
               />
                              <span>
                {option.label}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Task form validation schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["Queued", "Running", "Done", "Failed"]),
  agent_type: z.enum(["Fullstack", "PM", "SWE"]),
  dueDate: z.string().optional(),
  topic: z.string().optional(),
  project: z.string().optional(),
  repositories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  runOnCreate: z.boolean().default(true),
  model_provider: z.string().optional(),
  model_name: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Task;
  mode?: "create" | "edit";
}

// Repository interface
interface Repository {
  owner: string;
  repo: string;
  installation_id?: number;
  rules?: string[];
}

export default function TaskForm({ open, onOpenChange, initialData, mode = "create" }: TaskFormProps) {
  const { toast } = useToast();
  const { addTask, updateTask } = useTasks();
  const { showProcessingToast } = useTaskProcessingToast();
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [allReposSelected, setAllReposSelected] = useState(mode === "create");
  const [repositories, setRepositories] = useState<Record<string, Repository>>({});
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelProviders, setModelProviders] = useState<ModelsResponse["providers"]>({});
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Define agent types
  const agentTypes = ["Fullstack", "PM", "SWE"];

  // Helper function to get the logo for a model provider
  const getModelProviderLogo = (provider: string): string => {
    switch (provider.toLowerCase()) {
      case "openai":
        return openaiLogo;
      case "anthropic":
        return anthropicLogo;
      case "gemini":
        return geminiLogo;
      default:
        return "";
    }
  };

  const getAgentTypeIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case "fullstack":
        return fullstackIcon;
      case "pm":
        return pmIcon;
      case "swe":
        return sweIcon;
      default:
        return "";
    }
  };

  // Get saved model provider and model from localStorage
  const savedModelProvider = localStorage.getItem('lastModelProvider');
  const savedModelName = localStorage.getItem('lastModelName');

  // Form definition
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      status: (initialData?.status === "Queued" || initialData?.status === "Running" || initialData?.status === "Done" || initialData?.status === "Failed") ? initialData.status : "Queued",
      agent_type: (initialData?.agent_type === "Fullstack" || initialData?.agent_type === "PM" || initialData?.agent_type === "SWE") ? initialData.agent_type : "Fullstack",
      repositories: initialData?.repos || [],
      model_provider: initialData?.model_provider || savedModelProvider || "",
      model_name: initialData?.model_name || savedModelName || "",
      tags: initialData?.tags || [],
      runOnCreate: false,
    },
  });

  // Watch agent type to control repository selection behavior
  const selectedModelProvider = form.watch("model_provider");
  const isFullstack = form.watch("agent_type") === "Fullstack";

  // Fetch repositories from the backend
  const fetchRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const data = await fetchConnectedRepos();
      // Convert array of repos to a record with ids
      const reposRecord: Record<string, Repository> = {};
      data.repos.forEach((repo: Repository, index: number) => {
        const id = `repo-${index}`;
        reposRecord[id] = repo;
      });
      setRepositories(reposRecord);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      toast({
        title: "Error",
        description: "Failed to fetch repositories",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Fetch model providers and models
  const fetchModelProviders = async () => {
    setIsLoadingModels(true);
    try {
      const data = await fetchModels();
      setModelProviders(data.providers);

      // Update selectedModels if a provider is already selected
      const currentProvider = form.getValues("model_provider");
      if (currentProvider && data.providers[currentProvider]) {
        setSelectedModels(data.providers[currentProvider].models || []);
      }
    } catch (error) {
      console.error("Error fetching model providers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch model providers",
        variant: "destructive",
      });
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Save selected model provider and model to localStorage when they change
  useEffect(() => {
    const currentProvider = form.getValues("model_provider");
    const currentModel = form.getValues("model_name");

    if (currentProvider) {
      localStorage.setItem('lastModelProvider', currentProvider);
    }

    if (currentModel) {
      localStorage.setItem('lastModelName', currentModel);
    }
  }, [form.watch("model_provider"), form.watch("model_name")]);

  // Reset loading state and initialize when form opens
  useEffect(() => {
    if (open) {
      // Initialize default state for create mode
      if (mode === "create") {
        setAllReposSelected(true);
      }
      // Fetch repositories when the form opens
      fetchRepos();
      // Fetch model providers when the form opens
      fetchModelProviders();
    }
  }, [open, mode]);

  // Auto-select all repositories when they are loaded
  useEffect(() => {
    // Only auto-select repositories if we're creating a new task (not editing)
    if (mode === "create" && Object.keys(repositories).length > 0) {
      if (isFullstack) {
        // For Fullstack, select all repositories
        const allRepoIds = Object.keys(repositories);
        if (allRepoIds.length > 0) {
          form.setValue("repositories", allRepoIds);
          setAllReposSelected(true);
        }
      } else {
        // For non-Fullstack, select only the first repository if available
        const repoKeys = Object.keys(repositories);
        if (repoKeys.length > 0) {
          form.setValue("repositories", [repoKeys[0]]);
          setAllReposSelected(false);
        } else {
          form.setValue("repositories", ["none"]);
        }
      }
    } else if (mode === "edit" && initialData?.repos?.length && Object.keys(repositories).length > 0) {
      // Check if all repos are selected in edit mode
      const allRepoIds = Object.keys(repositories);
      const selectedRepoIds = initialData.repos;
      setAllReposSelected(
        allRepoIds.length > 0 &&
        selectedRepoIds.length === allRepoIds.length &&
        allRepoIds.every(id => selectedRepoIds.includes(id))
      );
    }
  }, [form, mode, initialData, repositories, isFullstack]);

  // Update repositories when agent type changes
  useEffect(() => {
    if (!isFullstack) {
      // For non-Fullstack, limit to a single repository
      const currentRepos = form.getValues("repositories") || [];
      if (currentRepos.length > 1) {
        // Keep only the first selected repository
        form.setValue("repositories", [currentRepos[0]]);
        setAllReposSelected(false);
      }
    }
  }, [isFullstack, form]);

  // Handle repository selection
  useEffect(() => {
    // Initialize selectedRepos when form or initialData changes
    const repos = form.getValues("repositories");
    if (repos.length === 0) {
      form.setValue("repositories", ["none"]);
    }
  }, [form, initialData]);

  const handleRepositoryToggle = (repoId: string) => {
    let newRepos: string[];

    if (repoId === "none") {
      // If "none" is selected, clear all selections
      newRepos = ["none"];
      setAllReposSelected(false);
    } else {
      // Get current repositories
      const currentRepos = form.getValues("repositories") || [];

      // Remove "none" if it exists
      const filteredRepos = currentRepos.filter(id => id !== "none");

      if (filteredRepos.includes(repoId)) {
        // Remove if already selected
        newRepos = filteredRepos.filter(id => id !== repoId);
        setAllReposSelected(false);
      } else {
        // Add if not selected
        if (!isFullstack) {
          // For non-Fullstack, replace the current selection with the new one
          newRepos = [repoId];
        } else {
          // For Fullstack, add to the current selection
          newRepos = [...filteredRepos, repoId];

          // Check if all repos are now selected
          const allRepoIds = Object.keys(repositories);
          setAllReposSelected(
            allRepoIds.length > 0 &&
            allRepoIds.every(id => newRepos.includes(id))
          );
        }
      }

      // If no repos selected, add "none"
      if (newRepos.length === 0) {
        newRepos = ["none"];
        setAllReposSelected(false);
      }
    }

    // Update form value
    form.setValue("repositories", newRepos);
  };

  // Check if repository is selected
  const isRepositorySelected = (repoId: string) => {
    const repos = form.getValues("repositories") || [];
    return repos.includes(repoId);
  };

  const onSubmit = async (values: TaskFormValues) => {
    try {
      // Map agent_type to API expected value
      let apiAgentType: "Fullstack" | "Fullstack Planner" | "PM" | "SWE" = values.agent_type;
      if (apiAgentType === "Fullstack") apiAgentType = "Fullstack Planner" as any; // API expects this string

      // Map repositories to owner/repo strings
      const selectedRepoIds: string[] = values.repositories?.filter((r: string) => r !== "none") || [];
      const repoStrings: string[] = selectedRepoIds.map((id: string) => {
        const repo = repositories[id];
        return repo ? `${repo.owner}/${repo.repo}` : id;
      });

      // Build payload
      const payload: Record<string, any> = {
        description: values.description || "",
        title: values.title,
        model_provider: values.model_provider,
        model_name: values.model_name,
      };

      if (apiAgentType === "Fullstack Planner") {
        payload.repos = repoStrings;
        if (!payload.repos.length) {
          toast({
            title: "Error",
            description: "At least one repository is required for Fullstack Planner",
            variant: "destructive",
          });
          return;
        }
      } else {
        // PM or SWE: only one repo allowed
        payload.repo = repoStrings[0] || "";
        // Optionally add branch if you have a branch field in the form (not present in current form)
        // payload.branch = values.branch || undefined;
        if (!payload.repo) {
          toast({
            title: "Error",
            description: "A repository is required for this agent type",
            variant: "destructive",
          });
          return;
        }
      }

      // Generate a temporary ID for the task
      const tempTaskId = `task-${Date.now()}`;

      // Create a local task object to add to state immediately
      const newTask: Task = {
        id: tempTaskId,
        title: values.title,
        description: values.description || "",
        status: "Queued" as TaskStatus, // Always set to Queued for new tasks
        agent_type: values.agent_type as AgentType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        repos: selectedRepoIds.filter(id => id !== "none"),
        created_by: "user-1",
        team: "team-1",
        model_provider: values.model_provider,
        model_name: values.model_name,
      };

      // Add task to local state immediately
      addTask(newTask);

      // Send POST request to /kickoff-agent
      const apiResponse = await fetch("http://localhost:8000/kickoff-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          agent_type: apiAgentType,
          payload,
        }),
        credentials: "include" // Include cookies if needed
      });

      if (!apiResponse.ok) {
        let errorData: { detail?: string } = {};
        try {
          errorData = await apiResponse.json();
        } catch {}
        throw new Error(errorData.detail || "Failed to create task");
      }

      const apiResult: { message?: string } = await apiResponse.json();
      toast({
        title: "Success",
        description: apiResult.message || "Task created successfully",
      });

      // Optionally: trigger a refresh of tasks here if you have a context or callback
      // Close or reset the form
      if (values.runOnCreate && mode === "create") {
        form.reset({
          ...form.getValues(),
          title: "",
          description: "",
          runOnCreate: true,
          model_provider: values.model_provider,
          model_name: values.model_name,
        });
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 50);
      } else {
        onOpenChange(false);
        form.reset();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save task",
        variant: "destructive",
      });
    }
  };

  // Add keyboard shortcuts for the form
  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Cmd+Enter to submit form
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          form.handleSubmit(onSubmit)();
        }

        // Cmd+L to toggle "Add more tasks" checkbox
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          const currentValue = form.getValues().runOnCreate;
          form.setValue('runOnCreate', !currentValue);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, form, onSubmit]);

  // Get status dot color based on status value
  const getStatusDot = (status: string) => {
    switch (status) {
      case "Queued":
        return "queued-dot";
      case "Running":
        return "running-dot";
      case "Done":
        return "done-dot";
      case "Failed":
        return "failed-dot";
      default:
        return "queued-dot";
    }
  };

  // Format repository display name
  const getRepoDisplayName = (id: string) => {
    const repo = repositories[id];
    if (repo) {
      return `${repo.owner}/${repo.repo}`;
    }
    return "Unknown Repository";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden border rounded-lg shadow-lg">


        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-3 space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Issue title"
                      {...field}
                      ref={titleInputRef}
                      className="linear-input focus-visible:ring-0 text-lg font-medium placeholder:text-gray-400/60"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add description..."
                      {...field}
                      value={field.value || ""}
                      className="linear-textarea focus-visible:ring-0 placeholder:text-gray-400/60"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col space-y-1">
              {mode === "edit" && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="linear-menu h-7 border-none shadow-none">
                            <SelectValue>
                              <div className="flex items-center">
                                <span className={`status-dot ${getStatusDot(field.value)}`}></span>
                                <span>{field.value}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {["Queued", "Running", "Done", "Failed"].map((status) => (
                              <SelectItem key={status} value={status}>
                                <div className="flex items-center">
                                  <span className={`status-dot ${getStatusDot(status)}`}></span>
                                  <span>{status}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="agent_type"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="linear-menu h-7 border-none shadow-none">
                          <SelectValue>
                            <div className="flex items-center">
                              {field.value && getAgentTypeIcon(field.value) ? (
                                <>
                                  <img
                                    src={getAgentTypeIcon(field.value)}
                                    alt={`${field.value} icon`}
                                    className="h-3.5 w-3.5 mr-1 object-contain"
                                  />
                                  <span>{field.value}</span>
                                </>
                              ) : (
                                <span>Select Agent Type</span>
                              )}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {agentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center">
                                {getAgentTypeIcon(type) && (
                                  <img
                                    src={getAgentTypeIcon(type)}
                                    alt={`${type} icon`}
                                    className="h-4 w-4 mr-2 object-contain"
                                  />
                                )}
                                <span>{type}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Model Provider and Model Selection - Side by side */}
              <div className="flex gap-2">
                {/* Model Provider Selection */}
                <FormField
                  control={form.control}
                  name="model_provider"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Update available models and always clear the current model selection
                            if (modelProviders[value]?.models) {
                              setSelectedModels(modelProviders[value].models);
                              // Clear the model selection when provider changes
                              form.setValue("model_name", "", { shouldValidate: true, shouldDirty: true });
                            } else {
                              setSelectedModels([]);
                              form.setValue("model_name", "", { shouldValidate: true, shouldDirty: true });
                            }
                          }}
                          value={field.value}
                          disabled={isLoadingModels}
                        >
                          <SelectTrigger className="linear-menu h-7 border-none shadow-none">
                            <SelectValue>
                              <div className="flex items-center">
                                {field.value && getModelProviderLogo(field.value) ? (
                                  <>
                                    <img
                                      src={getModelProviderLogo(field.value)}
                                      alt={`${field.value} logo`}
                                      className="h-3.5 w-3.5 mr-1 object-contain"
                                    />
                                    <span>{field.value}</span>
                                  </>
                                ) : (
                                  <>
                                    <Server className="h-3.5 w-3.5 mr-1 opacity-70" />
                                    <span>Select Provider</span>
                                  </>
                                )}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingModels ? (
                              <SelectItem value="loading" disabled>Loading providers...</SelectItem>
                            ) : Object.keys(modelProviders).length === 0 ? (
                              <SelectItem value="empty" disabled>No providers available</SelectItem>
                            ) : (
                              Object.keys(modelProviders).map((provider) => (
                                <SelectItem key={provider} value={provider}>
                                  <div className="flex items-center">
                                    {getModelProviderLogo(provider) && (
                                      <img
                                        src={getModelProviderLogo(provider)}
                                        alt={`${provider} logo`}
                                        className="h-4 w-4 mr-2 object-contain"
                                      />
                                    )}
                                    <span>{provider}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Model Selection */}
                <FormField
                  control={form.control}
                  name="model_name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedModelProvider}
                        >
                          <SelectTrigger className="linear-menu h-7 border-none shadow-none">
                            <SelectValue>
                              <div className="flex items-center">
                                {field.value ? (
                                  <span>{field.value}</span>
                                ) : (
                                  <span>{selectedModelProvider ? "Select Model" : "Select provider first"}</span>
                                )}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {!selectedModelProvider ? (
                              <SelectItem value="no-provider" disabled>Select a provider first</SelectItem>
                            ) : selectedModels.length === 0 ? (
                              <SelectItem value="no-models" disabled>No models available</SelectItem>
                            ) : (
                              selectedModels.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="additional-fields">
              <div className="additional-field">
                <FormField
                  control={form.control}
                  name="repositories"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RepoSelectDropdown
                          value={field.value || []}
                          onChange={field.onChange}
                          repositories={repositories}
                          isLoading={isLoadingRepos}
                          mode={mode}
                          agentType={form.getValues("agent_type")}
                          onRepositoryToggle={handleRepositoryToggle}
                          isRepositorySelected={isRepositorySelected}
                          getRepoDisplayName={getRepoDisplayName}
                          allReposSelected={allReposSelected}
                          setAllReposSelected={setAllReposSelected}
                          formSetValue={form.setValue}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="linear-footer">
              <FormField
                control={form.control}
                name="runOnCreate"
                render={({ field }) => (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="run-ai"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-4 w-4 data-[state=checked]:bg-[#5e6ad2] data-[state=checked]:border-[#5e6ad2] border-gray-300"
                    />
                    <label htmlFor="run-ai" className="text-sm text-muted-foreground cursor-pointer">
                      Add more tasks <span className="ml-1 opacity-70 text-xs">⌘+L</span>
                    </label>
                  </div>
                )}
              />

              <Button
                type="submit"
                className="bg-[#5e6ad2] hover:bg-[#5e6ad2]/90 text-white h-9 px-4 rounded-md"
              >
                {mode === "create" ? (
                  <>
                    Create issue <span className="ml-1 opacity-70 text-xs">⌘+↵</span>
                  </>
                ) : "Update issue"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

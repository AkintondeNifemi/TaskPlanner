// Register the Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully with scope:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}


class TaskManager {
    constructor() {
        this.tasks = [];
        this.dailyTop3 = [];
        this.deletedTasks = [];
        this.currentFilter = {
            category: 'all',
            status: 'all',
            priority: 'all',
            quick: null,
            search: ''
        };
        this.currentSort = 'created';
        this.currentTaskId = null;
        this.selectedTasks = new Set();
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.applyTheme();
        this.renderTasks();
        this.renderDailyTop3();
        this.startDeadlineChecker();

if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

    }

    // Data Management
    loadData() {
        const savedTasks = localStorage.getItem('taskmaster-tasks');
        const savedTop3 = localStorage.getItem('taskmaster-top3');
        const savedTheme = localStorage.getItem('taskmaster-theme');

        if (savedTasks) {
            this.tasks = JSON.parse(savedTasks);
        }
        if (savedTop3) {
            this.dailyTop3 = JSON.parse(savedTop3);
        }
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }

    saveData() {
        localStorage.setItem('taskmaster-tasks', JSON.stringify(this.tasks));
        localStorage.setItem('taskmaster-top3', JSON.stringify(this.dailyTop3));
    }


   // Inside TaskManager class

startDeadlineChecker() {
    setInterval(() => {
        const now = new Date();

        this.tasks.forEach(task => {
            if (task.deadline && !task.completed) {
                const deadline = new Date(task.deadline);

                // Check if deadline has passed and not already reminded
                if (deadline <= now && !task.reminded) {
                    this.notifyTaskDue(task);
                    task.reminded = true; // mark as reminded
                    this.saveData();
                }
            }
        });
    }, 60000); // check every 1 minute
}

notifyTaskDue(task) {
    const audio = document.getElementById('taskReminderSound');

    if (audio) {
        // Reset playback
        audio.currentTime = 0;

        // Play in a loop every 5 seconds until user stops it
        this.ringInterval = setInterval(() => {
            audio.play().catch(err => {
                console.log("Sound blocked until user interacts once with the page:", err);
            });
        }, 5000); // rings every 5 seconds
    }

    // Browser notification
    if (Notification.permission === "granted") {
        const notif = new Notification("⏰ Task Due!", {
            body: task.title + " (Click to stop alarm)",
            icon: "icon.png"
        });

        // Stop ringing if user clicks notification
        notif.onclick = () => {
            this.stopRinging();
            window.focus();
        };
    }
}

// Helper function to stop ringing
stopRinging() {
    if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
    }
}


    

    // Event Listeners
    setupEventListeners() {
        // Header controls
        document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));

        // Task controls
        document.getElementById('newTaskBtn').addEventListener('click', () => this.showTaskModal());
        document.getElementById('sortSelect').addEventListener('change', (e) => this.setSortOrder(e.target.value));
        document.getElementById('bulkComplete').addEventListener('click', () => this.bulkComplete());
        document.getElementById('bulkDelete').addEventListener('click', () => this.bulkDelete());

        // Modal controls
        document.getElementById('modalClose').addEventListener('click', () => this.hideTaskModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));
        document.getElementById('addSubtaskBtn').addEventListener('click', () => this.addSubtask());

        // Undo
        document.getElementById('undoBtn').addEventListener('click', () => this.undoDelete());

        // Filter chips
        this.setupFilterChips();

        // Modal backdrop click
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.hideTaskModal();
            }
        });
    }

    setupFilterChips() {
        // Category filters
        document.querySelectorAll('#categoryFilters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#categoryFilters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter.category = chip.dataset.category;
                this.renderTasks();
            });
        });

        // Status filters
        document.querySelectorAll('#statusFilters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#statusFilters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter.status = chip.dataset.status;
                this.renderTasks();
            });
        });

        // Priority filters
        document.querySelectorAll('#priorityFilters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#priorityFilters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentFilter.priority = chip.dataset.priority;
                this.renderTasks();
            });
        });

        // Quick filters
        document.querySelectorAll('#quickFilters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const isActive = chip.classList.contains('active');
                document.querySelectorAll('#quickFilters .chip').forEach(c => c.classList.remove('active'));
                
                if (!isActive) {
                    chip.classList.add('active');
                    this.currentFilter.quick = chip.dataset.filter;
                } else {
                    this.currentFilter.quick = null;
                }
                this.renderTasks();
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when modal is not open and not typing in input
            if (document.getElementById('taskModal').style.display === 'none' && 
                !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                
                switch(e.key.toLowerCase()) {
                    case 'n':
                        e.preventDefault();
                        this.showTaskModal();
                        break;
                    case 'delete':
                        e.preventDefault();
                        if (this.selectedTasks.size > 0) {
                            this.bulkDelete();
                        }
                        break;
                }
            }

            // Modal shortcuts
            if (document.getElementById('taskModal').style.display !== 'none') {
                if (e.key === 'Escape') {
                    this.hideTaskModal();
                }
            }
        });
    }

    // Theme Management
    toggleDarkMode() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('taskmaster-theme', newTheme);
    }

    applyTheme() {
        const savedTheme = localStorage.getItem('taskmaster-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }

    // Task Management
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    createTask(taskData) {
        const task = {
            id: this.generateId(),
            title: taskData.title,
            description: taskData.description || '',
            category: taskData.category,
            priority: taskData.priority,
            deadline: taskData.deadline || null,
            subtasks: taskData.subtasks || [],
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        this.tasks.push(task);
        this.saveData();
        this.renderTasks();
        return task;
    }

    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveData();
            this.renderTasks();
            this.renderDailyTop3();
        }
    }

    deleteTask(taskId) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const deletedTask = this.tasks.splice(taskIndex, 1)[0];
            this.deletedTasks.push(deletedTask);
            
            // Remove from daily top 3 if present
            this.dailyTop3 = this.dailyTop3.filter(id => id !== taskId);
            
            this.saveData();
            this.renderTasks();
            this.renderDailyTop3();
            this.showUndoBar();
        }
    }

    toggleTaskCompletion(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            // Update subtasks if completing main task
            if (task.completed && task.subtasks.length > 0) {
                task.subtasks.forEach(subtask => subtask.completed = true);
            }
            
            this.saveData();
            this.renderTasks();
            this.renderDailyTop3();
            this.stopRinging();

        }
    }

    toggleSubtask(taskId, subtaskIndex) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.subtasks[subtaskIndex]) {
            task.subtasks[subtaskIndex].completed = !task.subtasks[subtaskIndex].completed;
            this.saveData();
            this.renderTasks();
            this.renderDailyTop3();
        }
    }

    // Daily Top 3 Management
    toggleDailyTop3(taskId) {
        const index = this.dailyTop3.indexOf(taskId);
        if (index === -1) {
            if (this.dailyTop3.length < 3) {
                this.dailyTop3.push(taskId);
            } else {
                alert('You can only pin 3 tasks to Daily Top 3');
                return;
            }
        } else {
            this.dailyTop3.splice(index, 1);
        }
        
        this.saveData();
        this.renderTasks();
        this.renderDailyTop3();
    }

    // Filtering and Sorting
    getFilteredTasks() {
        let filtered = [...this.tasks];

        // Category filter
        if (this.currentFilter.category !== 'all') {
            filtered = filtered.filter(task => task.category === this.currentFilter.category);
        }

        // Status filter
        if (this.currentFilter.status === 'active') {
            filtered = filtered.filter(task => !task.completed);
        } else if (this.currentFilter.status === 'completed') {
            filtered = filtered.filter(task => task.completed);
        }

        // Priority filter
        if (this.currentFilter.priority !== 'all') {
            filtered = filtered.filter(task => task.priority === this.currentFilter.priority);
        }

        // Quick filters
        if (this.currentFilter.quick) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            switch (this.currentFilter.quick) {
                case 'overdue':
                    filtered = filtered.filter(task => {
                        if (!task.deadline) return false;
                        return new Date(task.deadline) < now && !task.completed;
                    });
                    break;
                case 'due-today':
                    filtered = filtered.filter(task => {
                        if (!task.deadline) return false;
                        const deadline = new Date(task.deadline);
                        return deadline >= today && deadline < tomorrow;
                    });
                    break;
                case 'due-soon':
                    filtered = filtered.filter(task => {
                        if (!task.deadline) return false;
                        const deadline = new Date(task.deadline);
                        const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
                        return deadline >= tomorrow && deadline < dayAfterTomorrow;
                    });
                    break;
            }
        }

        // Search filter
        if (this.currentFilter.search) {
            const searchLower = this.currentFilter.search.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower)
            );
        }

        return this.sortTasks(filtered);
    }

    sortTasks(tasks) {
        return tasks.sort((a, b) => {
            switch (this.currentSort) {
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                case 'deadline':
                    if (!a.deadline && !b.deadline) return 0;
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created':
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    setSortOrder(order) {
        this.currentSort = order;
        this.renderTasks();
    }

    handleSearch(query) {
        this.currentFilter.search = query;
        this.renderTasks();
    }

    // Bulk Actions
    bulkComplete() {
        this.selectedTasks.forEach(taskId => {
            const task = this.tasks.find(t => t.id === taskId);
            if (task && !task.completed) {
                this.toggleTaskCompletion(taskId);
            }
        });
        this.selectedTasks.clear();
        this.updateBulkActions();
    }

    bulkDelete() {
        if (confirm(`Delete ${this.selectedTasks.size} selected tasks?`)) {
            this.selectedTasks.forEach(taskId => {
                this.deleteTask(taskId);
            });
            this.selectedTasks.clear();
            this.updateBulkActions();
        }
    }

    toggleTaskSelection(taskId) {
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
        } else {
            this.selectedTasks.add(taskId);
        }
        this.updateBulkActions();
        this.renderTasks();
    }

    updateBulkActions() {
        const bulkActions = document.getElementById('bulkActions');
        if (this.selectedTasks.size > 0) {
            bulkActions.style.display = 'flex';
        } else {
            bulkActions.style.display = 'none';
        }
    }

    // Modal Management
    showTaskModal(taskId = null) {
        this.currentTaskId = taskId;
        const modal = document.getElementById('taskModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('taskForm');
        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            modalTitle.textContent = 'Edit Task';
            this.populateForm(task);
        } else {
            modalTitle.textContent = 'New Task';
            form.reset();
            document.getElementById('subtaskList').innerHTML = '';
        }
        modal.style.display = 'flex';
        document.getElementById('taskTitle').focus();
    }

    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        this.currentTaskId = null;
    }

    populateForm(task) {
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDeadline').value = task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '';
        // Populate subtasks
        const subtaskList = document.getElementById('subtaskList');
        subtaskList.innerHTML = '';
        task.subtasks.forEach((subtask, index) => {
            this.addSubtask(subtask.title, subtask.completed);
        });
    }

    handleTaskSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            category: document.getElementById('taskCategory').value,
            priority: document.getElementById('taskPriority').value,
            deadline: document.getElementById('taskDeadline').value || null,
            subtasks: this.getSubtasksFromForm()
        };

        // Validation
        if (!taskData.title) {
            document.getElementById('taskTitleError').textContent = 'Title is required';
            return;
        }
        document.getElementById('taskTitleError').textContent = '';

        if (this.currentTaskId) {
            this.updateTask(this.currentTaskId, taskData);
        } else {
            this.createTask(taskData);
        }

        this.hideTaskModal();
    }

    addSubtask(title = '', completed = false) {
        const subtaskList = document.getElementById('subtaskList');
        const subtaskDiv = document.createElement('div');
        subtaskDiv.className = 'subtask-item';
        subtaskDiv.innerHTML = `
            <input type="checkbox" ${completed ? 'checked' : ''}>
            <input type="text" placeholder="Subtask title" value="${title}">
            <button type="button" class="remove-subtask">×</button>
        `;
        subtaskDiv.querySelector('.remove-subtask').addEventListener('click', () => {
            subtaskDiv.remove();
        });
        subtaskList.appendChild(subtaskDiv);
    }

    getSubtasksFromForm() {
        const subtasks = [];
        document.querySelectorAll('#subtaskList .subtask-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const input = item.querySelector('input[type="text"]');
            if (input.value.trim()) {
                subtasks.push({
                    title: input.value.trim(),
                    completed: checkbox.checked
                });
            }
        });
        return subtasks;
    }

    // Undo functionality
    showUndoBar() {
        const undoBar = document.getElementById('undoBar');
        undoBar.style.display = 'flex';
        // Auto-hide after 5 seconds
        setTimeout(() => {
            undoBar.style.display = 'none';
            this.deletedTasks = []; // Clear deleted tasks after timeout
        }, 5000);
    }

    undoDelete() {
        if (this.deletedTasks.length > 0) {
            const restoredTask = this.deletedTasks.pop();
            this.tasks.push(restoredTask);
            this.saveData();
            this.renderTasks();
            document.getElementById('undoBar').style.display = 'none';
        }
    }

    // Utility functions
    getTaskDeadlineStatus(task) {
        if (!task.deadline) return null;
        const now = new Date();
        const deadline = new Date(task.deadline);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (deadline < now && !task.completed) {
            return 'overdue';
        }
        
        const oneDay = 24 * 60 * 60 * 1000;
        const timeUntilDeadline = deadline.getTime() - now.getTime();
        if (timeUntilDeadline <= oneDay && !task.completed) {
            return 'due-soon';
        }

        return null;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    exportData() {
        const dataStr = JSON.stringify(this.tasks, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'taskmaster_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedTasks = JSON.parse(event.target.result);
                if (Array.isArray(importedTasks)) {
                    this.tasks = importedTasks;
                    this.saveData();
                    this.renderTasks();
                    this.renderDailyTop3();
                    alert('Tasks imported successfully!');
                } else {
                    alert('Invalid JSON file format. Please import a valid tasks JSON file.');
                }
            } catch (error) {
                alert('Error parsing JSON file. Please check the file content.');
            }
        };
        reader.readAsText(file);
    }

    // Rendering
    renderTasks() {
        const taskList = document.getElementById('taskList');
        const emptyState = document.getElementById('emptyState');
        const filteredTasks = this.getFilteredTasks();
        const dailyTop3Ids = new Set(this.dailyTop3);

        if (filteredTasks.length === 0) {
            if (!emptyState) {
                taskList.innerHTML = `<div id="emptyState" class="empty-state">
                                    <div class="empty-icon">📝</div>
                                    <h3>No tasks here—add one!</h3>
                                    <p>Create your first task to get started with TaskPlanner</p>
                                </div>`;
            }
            return;
        } else if (emptyState) {
            // Only remove if it's the empty state
            if (emptyState.id === 'emptyState') {
                emptyState.remove();
            }
        }

        const taskHTML = filteredTasks.map((task, index) => {
            const subtaskHTML = task.subtasks.map((sub, subIndex) => `
                <div class="subtask-item">
                    <input type="checkbox" onchange="taskManager.toggleSubtask('${task.id}', ${subIndex})" ${sub.completed ? 'checked' : ''}>
                    <span class="${sub.completed ? 'completed' : ''}">${sub.title}</span>
                </div>
            `).join('');

            const isTaskSelected = this.selectedTasks.has(task.id);
            const isPinned = dailyTop3Ids.has(task.id);

            return `
                <div class="task-card ${isTaskSelected ? 'selected' : ''}" data-id="${task.id}" data-category="${task.category}" data-priority="${task.priority}" style="animation-delay: ${index * 0.05}s;" onclick="taskManager.toggleTaskSelection('${task.id}')">
                    <div class="task-checkbox">
                        <input type="checkbox" onchange="event.stopPropagation(); taskManager.toggleTaskSelection('${task.id}')" ${isTaskSelected ? 'checked' : ''}>
                    </div>
                    <div class="task-content">
                        <div class="task-header-content">
                            <h4 class="task-title ${task.completed ? 'completed' : ''}">${task.title}</h4>
                            <div class="task-actions">
                                <button class="btn btn-icon pin-btn ${isPinned ? 'pinned' : ''}" onclick="event.stopPropagation(); taskManager.toggleDailyTop3('${task.id}')" aria-label="Pin task">
                                    📌
                                </button>
                                <button class="btn btn-icon edit-btn" onclick="event.stopPropagation(); taskManager.showTaskModal('${task.id}')" aria-label="Edit task">
                                    ✏️
                                </button>
                                <button class="btn btn-icon delete-btn" onclick="event.stopPropagation(); taskManager.deleteTask('${task.id}')" aria-label="Delete task">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="task-meta">
                            <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                            <span class="category-chip">${task.category}</span>
                            ${task.deadline ? `<span class="due-date ${this.getTaskDeadlineStatus(task)}">${this.formatDate(task.deadline)}</span>` : ''}
                        </div>
                        ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                        ${task.subtasks.length > 0 ? `
                            <div class="task-details">
                                <div class="subtasks-summary">
                                    ${task.subtasks.filter(s => s.completed).length} / ${task.subtasks.length} subtasks completed
                                </div>
                                <div class="subtask-list">${subtaskHTML}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        taskList.innerHTML = taskHTML;
    }

    renderDailyTop3() {
        const dailyTop3Container = document.getElementById('dailyTop3');
        const pinnedTasks = this.dailyTop3.map(id => this.tasks.find(t => t.id === id)).filter(Boolean);

        if (pinnedTasks.length === 0) {
            dailyTop3Container.innerHTML = '<div class="empty-state">Pin 3 tasks for today</div>';
            return;
        }

        dailyTop3Container.innerHTML = pinnedTasks.map((task, index) => `
            <div class="daily-task" style="animation-delay: ${index * 0.1}s;">
                <div class="task-checkbox">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="taskManager.toggleTaskCompletion('${task.id}')">
                </div>
                <div class="daily-task-content">
                    <div class="task-title ${task.completed ? 'completed' : ''}">${task.title}</div>
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        ${task.deadline ? `<span class="due-date">${this.formatDate(task.deadline)}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }     
}

// Initialize the app
const taskManager = new TaskManager();

// Setup subtask adding logic
document.getElementById('addSubtaskBtn').addEventListener('click', () => {
    const subtaskList = document.getElementById('subtaskList');
    const subtaskDiv = document.createElement('div');
    subtaskDiv.className = 'subtask-item';
    subtaskDiv.innerHTML = `
        <input type="checkbox">
        <input type="text" placeholder="Subtask title">
        <button type="button" class="remove-subtask">×</button>
    `;
    subtaskDiv.querySelector('.remove-subtask').addEventListener('click', () => {
        subtaskDiv.remove();
    });
    subtaskList.appendChild(subtaskDiv);
});
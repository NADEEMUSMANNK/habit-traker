document.addEventListener('DOMContentLoaded', () => {
    // ---- State ----
    let habits = JSON.parse(localStorage.getItem('proTrax_matrix_habits')) || [
        { id: 'h1', name: 'Morning Run (3km)', icon: 'directions_run', completions: {} },
        { id: 'h2', name: 'Read 20 Mins', icon: 'menu_book', completions: {} },
        { id: 'h3', name: 'Drink 2L Water', icon: 'water_drop', completions: {} }
    ];

    const todayDate = new Date();
    const currentYear = todayDate.getFullYear();
    const currentMonth = todayDate.getMonth();
    const todayNum = todayDate.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Format YYYY-MM-DD
    const todayStr = formatDate(currentYear, currentMonth, todayNum);

    // Arrays to hold Chart.js instances
    let sparklineInstances = [];
    let overallChartInstance = null;

    // ---- DOM Elements ----
    const dateDisplay = document.getElementById('currentDateDisplay');
    const trackerTable = document.getElementById('trackerTable');
    const completedBadge = document.getElementById('completedBadge');
    
    // Stats
    const bestStreakStat = document.getElementById('bestStreakStat');
    const totalHabitsStat = document.getElementById('totalHabitsStat');
    const todayRateStat = document.getElementById('todayRateStat');

    // Modal
    const addHabitBtn = document.getElementById('addHabitBtn');
    const habitModal = document.getElementById('habitModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const addHabitForm = document.getElementById('addHabitForm');
    const iconSelector = document.getElementById('iconSelector');
    const iconInput = document.getElementById('habitIcon');

    // ---- Init ----
    function init() {
        renderDate();
        renderDashboard();
        
        // Auto scroll matrix slightly right if on desktop
        setTimeout(() => {
            const container = document.querySelector('.table-container');
            const todayCol = document.querySelector('.today-col');
            if(container && todayCol) {
                container.scrollLeft = todayCol.offsetLeft - 300; 
            }
        }, 100);
    }

    function formatDate(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function renderDate() {
        const ops = { month: 'long', year: 'numeric' };
        dateDisplay.textContent = todayDate.toLocaleDateString('en-US', ops);
    }

    // ---- Render Spreadsheet Data Matrix and Overall Dashboard ----
    function renderDashboard() {
        // Clear all charts
        sparklineInstances.forEach(c => c.destroy());
        sparklineInstances = [];
        
        // Data arrays for the Horizontal Bar Chart
        const overallLabels = [];
        const overallData = [];

        // Main Table Construction
        let theadHTML = `
            <thead>
                <tr>
                    <th class="habit-cell">Your Habits</th>
        `;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = (d === todayNum);
            const dateObj = new Date(currentYear, currentMonth, d);
            const shortDay = dateObj.toLocaleDateString('en-US', {weekday: 'short'})[0]; 
            
            theadHTML += `
                <th class="${isToday ? 'today-col' : ''}">
                    <div style="display:flex; flex-direction:column; align-items:center; opacity: ${isToday ? '1' : '0.6'};">
                        <span style="font-size:0.55rem;">${shortDay}</span>
                        <span style="font-size:0.75rem; letter-spacing: -0.5px; ${isToday ? 'color: var(--accent-primary); font-weight:700;' : ''}">${d}</span>
                    </div>
                </th>
            `;
        }
        
        theadHTML += `<th class="chart-cell">Progress</th></tr></thead>`;
        let tbodyHTML = `<tbody>`;
        
        let completedTodayCount = 0;
        let globalMaxStreak = 0;
        
        if (habits.length === 0) {
            tbodyHTML += `
                <tr>
                    <td colspan="${daysInMonth + 2}" style="text-align:center; padding: 4rem; color: var(--text-muted)">
                        Start by creating your first habit using the button on the left!
                    </td>
                </tr>
            `;
            renderOverallChart([], []);
        }

        habits.forEach(habit => {
            // Processing logic
            const isDoneToday = habit.completions[todayStr] || false;
            if (isDoneToday) completedTodayCount++;
            
            let temp = 0;
            let habitMaxStreak = 0;
            let doneThisMonth = 0;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const dStr = formatDate(currentYear, currentMonth, d);
                if (habit.completions[dStr]) {
                    temp++;
                    habitMaxStreak = Math.max(habitMaxStreak, temp);
                    doneThisMonth++;
                } else {
                    temp = 0;
                }
            }
            globalMaxStreak = Math.max(globalMaxStreak, habitMaxStreak);

            const monthPercent = Math.round((doneThisMonth / todayNum) * 100) || 0;
            const cappedPercent = Math.min(monthPercent, 100);

            // Populate data for the Overall Bar Chart
            overallLabels.push(habit.name);
            overallData.push(cappedPercent);

            // Matrix Template
            tbodyHTML += `
                <tr>
                    <td class="habit-cell">
                        <div class="habit-main">
                            <div class="habit-icon"><span class="material-symbols-rounded">${habit.icon}</span></div>
                            <div class="habit-text">
                                <div class="habit-name">${habit.name}</div>
                                <div class="tracker-actions">
                                    <button class="delete-btn" data-id="${habit.id}">Delete</button>
                                </div>
                            </div>
                        </div>
                    </td>
            `;

            for (let d = 1; d <= daysInMonth; d++) {
                const dStr = formatDate(currentYear, currentMonth, d);
                const isDone = habit.completions[dStr] || false;
                const isFuture = d > todayNum;
                
                tbodyHTML += `
                    <td class="day-cell ${d === todayNum ? 'today-col' : ''}">
                        <button class="day-bubble ${isDone ? 'done' : ''} ${isFuture ? 'future' : ''}"
                                data-habit="${habit.id}" data-date="${dStr}" title="${dStr}">
                            <span class="material-symbols-rounded">check</span>
                        </button>
                    </td>
                `;
            }

            tbodyHTML += `
                    <td class="chart-cell">
                        <div class="analytics-wrap">
                            <span class="percent-val">${cappedPercent}%</span>
                            <div class="mini-chart-wrapper">
                                <canvas id="chart-${habit.id}"></canvas>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbodyHTML += `</tbody>`;
        trackerTable.innerHTML = theadHTML + tbodyHTML;

        // Statistics UI updates
        completedBadge.textContent = `${completedTodayCount}/${habits.length} Done Today`;
        totalHabitsStat.textContent = habits.length;
        bestStreakStat.textContent = `${globalMaxStreak} Days`;
        todayRateStat.textContent = habits.length ? `${Math.round((completedTodayCount/habits.length)*100)}%` : '0%';

        // Bind Bubble Click Events
        document.querySelectorAll('.day-bubble:not(.future)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hId = e.currentTarget.getAttribute('data-habit');
                const dStr = e.currentTarget.getAttribute('data-date');
                const habit = habits.find(h => h.id === hId);
                if (habit) {
                    habit.completions[dStr] = !habit.completions[dStr];
                    saveData();
                    renderDashboard(); 
                }
            });
        });

        // Bind Delete Events
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hId = e.currentTarget.getAttribute('data-id');
                if(confirm('Delete this habit permanently?')) {
                    habits = habits.filter(h => h.id !== hId);
                    saveData();
                    renderDashboard();
                }
            });
        });

        // Setup All Charts
        habits.forEach(habit => drawMiniSparkline(habit));
        if (habits.length > 0) {
            renderOverallChart(overallLabels, overallData);
        }
    }


    // ---- Mini Progress Chart Generator ----
    function drawMiniSparkline(habit) {
        const ctx = document.getElementById(`chart-${habit.id}`).getContext('2d');
        const labels = [];
        const data = [];
        
        let runningCompleted = 0;
        for (let d = 1; d <= todayNum; d++) {
            labels.push(`Day ${d}`);
            const dateKey = formatDate(currentYear, currentMonth, d);
            if (habit.completions[dateKey]) runningCompleted++;
            const currentPercent = Math.round((runningCompleted / d) * 100);
            data.push(currentPercent);
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    tension: 0.3,       
                    pointRadius: 0,     
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, min: 0, max: 100 }
                },
                layout: { padding: 0 }
            }
        });

        sparklineInstances.push(chart);
    }

    // ---- Overall Comparison Progress Chart ----
    function renderOverallChart(labels, data) {
        const ctx = document.getElementById('overallBarChart').getContext('2d');
        const container = document.getElementById('overallChartContainer');
        
        if (overallChartInstance) {
            overallChartInstance.destroy();
        }

        // Revert to original beautiful height per user request
        container.style.height = `280px`;

        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); /* Purple Accent */
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)'); /* Fade to transparent */

        overallChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Overall Progress',
                    data: data,
                    borderColor: '#8b5cf6',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4, // Beautiful smooth curve
                    pointBackgroundColor: '#09090b',
                    pointBorderColor: '#8b5cf6',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1d1d22',
                        titleColor: '#f4f4f5',
                        bodyColor: '#a1a1aa',
                        borderColor: '#3f3f46',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.parsed.y}% Completed this month`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#f4f4f5', font: { weight: '500', size: 13 } }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: '#27272a', borderDash: [4, 4] },
                        ticks: { color: '#a1a1aa', stepSize: 25, callback: val => val + '%' }
                    }
                }
            }
        });
    }

    // ---- Utility ----
    function saveData() {
        localStorage.setItem('proTrax_matrix_habits', JSON.stringify(habits));
    }

    // ---- Modal Handling ----
    function openModal() {
        habitModal.classList.add('active');
        document.getElementById('habitName').focus();
    }
    
    function closeModal() {
        habitModal.classList.remove('active');
        addHabitForm.reset();
        document.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
        if(document.querySelector('.icon-item')) {
            document.querySelector('.icon-item').classList.add('selected');
            iconInput.value = document.querySelector('.icon-item').getAttribute('data-icon');
        }
    }

    addHabitBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);

    iconSelector.addEventListener('click', (e) => {
        const item = e.target.closest('.icon-item');
        if (item) {
            document.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            iconInput.value = item.getAttribute('data-icon');
        }
    });

    addHabitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('habitName').value.trim();
        const icon = iconInput.value;

        if (name) {
            habits.push({
                id: 'h' + Date.now(),
                name,
                icon,
                completions: {}
            });
            saveData();
            renderDashboard();
            closeModal();
            
            // scroll table to bottom to show new habit
            const matrixBox = document.querySelector('.table-container');
            if(matrixBox) matrixBox.scrollTop = matrixBox.scrollHeight;
        }
    });

    // Run
    init();
});

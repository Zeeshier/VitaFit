document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const daysSlider = document.getElementById('days');
    const durationSlider = document.getElementById('duration');
    const daysValue = document.getElementById('days-value');
    const durationValue = document.getElementById('duration-value');
    const fitnessForm = document.getElementById('fitness-form');
    const formPages = document.querySelectorAll('.form-page');
    const nextButtons = document.querySelectorAll('.next-btn');
    const backButtons = document.querySelectorAll('.back-btn');
    const progressSteps = document.querySelectorAll('.step');
    const workoutPlan = document.getElementById('workout-plan');
    const workoutContent = document.getElementById('workout-content');
    const regenerateBtn = document.querySelector('.regenerate-btn');
    const shareBtn = document.querySelector('.share-btn');
    const downloadBtn = document.querySelector('.download-btn');

    // Current page index
    let currentPage = 0;

    // Initialize form
    showPage(currentPage);
    updateProgressSteps();

    // Event Listeners
    daysSlider.addEventListener('input', updateDaysValue);
    durationSlider.addEventListener('input', updateDurationValue);

    nextButtons.forEach(button => {
        button.addEventListener('click', goToNextPage);
    });

    backButtons.forEach(button => {
        button.addEventListener('click', goToPrevPage);
    });

    fitnessForm.addEventListener('submit', handleFormSubmit);
    if (regenerateBtn) regenerateBtn.addEventListener('click', handleRegenerate);
    if (shareBtn) shareBtn.addEventListener('click', handleShare);
    if (downloadBtn) downloadBtn.addEventListener('click', handleDownload);

    // Option card interactions
    document.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', function() {
            const input = this.querySelector('input');
            if (input.type === 'checkbox') {
                input.checked = !input.checked;
                this.classList.toggle('active', input.checked);
            } else if (input.type === 'radio') {
                input.checked = true;
                document.querySelectorAll(`input[name="${input.name}"]`).forEach(radio => {
                    radio.closest('.option-card').classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });

    // Functions
    function updateDaysValue() {
        daysValue.textContent = `${daysSlider.value} day${daysSlider.value > 1 ? 's' : ''}`;
    }

    function updateDurationValue() {
        durationValue.textContent = `${durationSlider.value} min`;
    }

    function showPage(pageIndex) {
        formPages.forEach((page, index) => {
            page.classList.toggle('active', index === pageIndex);
        });
    }

    function goToNextPage() {
        if (validateCurrentPage()) {
            currentPage++;
            showPage(currentPage);
            updateProgressSteps();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function goToPrevPage() {
        currentPage--;
        showPage(currentPage);
        updateProgressSteps();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateProgressSteps() {
        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= currentPage);
        });
    }

    function validateCurrentPage() {
        const currentPageEl = formPages[currentPage];
        const requiredInputs = currentPageEl.querySelectorAll('input[required]');
        let isValid = true;

        requiredInputs.forEach(input => {
            if (!input.value) {
                isValid = false;
                input.closest('.option-card').classList.add('error');
            } else {
                input.closest('.option-card').classList.remove('error');
            }
        });

        if (!isValid) {
            currentPageEl.style.animation = 'shake 0.5s';
            setTimeout(() => {
                currentPageEl.style.animation = '';
            }, 500);
        }

        return isValid;
    }

    async function handleFormSubmit(event) {
        event.preventDefault(); // Ensure form doesn't reload the page

        const formData = {
            fitness_level: document.querySelector('input[name="fitness_level"]:checked')?.value || '',
            goals: Array.from(document.querySelectorAll('input[name="goal"]:checked')).map(cb => cb.value),
            equipment: Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(cb => cb.value),
            days: parseInt(document.getElementById('days').value),
            duration: parseInt(document.getElementById('duration').value),
            focus_areas: Array.from(document.querySelectorAll('input[name="focus_area"]:checked')).map(cb => cb.value)
        };

        try {
            // Show loading state
            workoutContent.innerHTML = `
                <div class="loading-spinner">
                    <span class="material-symbols-rounded">fitness_center</span>
                </div>
            `;
            workoutPlan.style.display = 'block';

            // First, trigger the generation of the plan and save it to the file
            console.log('Sending request to /generate-plan...');
            const generateResponse = await fetch('http://localhost:8000/generate-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!generateResponse.ok) {
                const text = await generateResponse.text();
                throw new Error(`Generate plan failed with status ${generateResponse.status}: ${text}`);
            }

            const generateData = await generateResponse.json();
            console.log('Response from /generate-plan:', generateData);
            if (generateData.error) {
                throw new Error(generateData.error);
            }

            // Now fetch the saved plan from the file via the new endpoint
            console.log('Fetching plan from /get-plan...');
            const response = await fetch('http://localhost:8000/get-plan');
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Get plan failed with status ${response.status}: ${text}`);
            }

            const data = await response.json();
            console.log('Response from /get-plan:', data);
            if (data.error) {
                throw new Error(data.error);
            }

            // Render the plan and keep the current page
            workoutContent.innerHTML = formatWorkoutPlan(data, formData, false);
            workoutPlan.dataset.formData = JSON.stringify(formData);
            workoutPlan.dataset.planText = JSON.stringify(data);
        } catch (error) {
            console.error('Error fetching or processing workout plan:', error);
            workoutContent.innerHTML = `
                <div class="error-message">
                    <span class="material-symbols-rounded">error</span>
                    <p>There was an error generating your workout plan: ${error.message}. Please check the console for details.</p>
                </div>
            `;
        }
    }

    function formatWorkoutPlan(planData, formData, isPDF = false) {
        if (!planData || !planData.days || !Array.isArray(planData.days)) {
            console.log('Invalid planData:', planData);
            throw new Error('Invalid workout plan data.');
        }

        if (isPDF) {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error("jsPDF library is not loaded. Please ensure the jsPDF script is included in your HTML.");
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            let yOffset = 10;

            try {
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("VitaFit Workout Plan", 10, yOffset);
                yOffset += 10;

                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.text(`Days: ${formData.days}`, 10, yOffset);
                yOffset += 5;
                doc.text(`Duration per Session: ${formData.duration} minutes`, 10, yOffset);
                yOffset += 5;
                doc.text(`Fitness Level: ${formData.fitness_level.charAt(0).toUpperCase() + formData.fitness_level.slice(1)}`, 10, yOffset);
                yOffset += 5;
                doc.text(`Goals: ${formData.goals.join(', ').toLowerCase()}`, 10, yOffset);
                yOffset += 5;
                doc.text(`Equipment Used: ${formData.equipment.join(', ').toLowerCase()}`, 10, yOffset);
                yOffset += 10;

                doc.setFont("helvetica", "italic");
                doc.setFontSize(10);
                const introText = `Congratulations on taking the first step towards your fitness journey! This ${formData.days}-day plan is tailored to help you ${formData.goals.join(', ').toLowerCase()} using ${formData.equipment.join(', ').toLowerCase()} equipment.`;
                const introLines = doc.splitTextToSize(introText, 190);
                doc.text(introLines, 10, yOffset);
                yOffset += introLines.length * 5 + 5;

                planData.days.forEach(day => {
                    if (yOffset > 270) {
                        doc.addPage();
                        yOffset = 10;
                    }

                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.text(`Day ${day.day} - ${day.focus}`, 10, yOffset);
                    yOffset += 8;

                    if (day.warmup && Array.isArray(day.warmup) && day.warmup.length > 0) {
                        doc.setFont("helvetica", "bold");
                        doc.text("Warm-up:", 10, yOffset);
                        yOffset += 5;
                        doc.setFont("helvetica", "normal");
                        day.warmup.forEach(w => {
                            if (yOffset > 270) {
                                doc.addPage();
                                yOffset = 10;
                            }
                            doc.text(`- ${w}`, 15, yOffset);
                            yOffset += 5;
                        });
                        yOffset += 5;
                    }

                    if (day.exercises && Array.isArray(day.exercises) && day.exercises.length > 0) {
                        doc.setFont("helvetica", "bold");
                        doc.text("Exercises:", 10, yOffset);
                        yOffset += 5;
                        doc.setFont("helvetica", "normal");
                        day.exercises.forEach(ex => {
                            if (yOffset > 270) {
                                doc.addPage();
                                yOffset = 10;
                            }
                            doc.text(`- ${ex.name}: ${ex.details}`, 15, yOffset);
                            yOffset += 5;
                        });
                        yOffset += 5;
                    }

                    if (day.cooldown && Array.isArray(day.cooldown) && day.cooldown.length > 0) {
                        doc.setFont("helvetica", "bold");
                        doc.text("Cooldown:", 10, yOffset);
                        yOffset += 5;
                        doc.setFont("helvetica", "normal");
                        day.cooldown.forEach(c => {
                            if (yOffset > 270) {
                                doc.addPage();
                                yOffset = 10;
                            }
                            doc.text(`- ${c}`, 15, yOffset);
                            yOffset += 5;
                        });
                    }
                });

                return doc;
            } catch (error) {
                console.error('Error during PDF generation:', error);
                throw new Error('Failed to generate PDF content: ' + error.message);
            }
        } else {
            let html = `
                <div class="plan-meta">
                    <span class="meta-item">
                        <span class="material-symbols-rounded">calendar_month</span>
                        ${formData.days}-Day Program
                    </span>
                    <span class="meta-item">
                        <span class="material-symbols-rounded">timer</span>
                        ${formData.duration} min/session
                    </span>
                    <span class="meta-item">
                        <span class="material-symbols-rounded">fitness_center</span>
                        ${formData.fitness_level.charAt(0).toUpperCase() + formData.fitness_level.slice(1)} Level
                    </span>
                </div>
                
                <div class="plan-intro">
                    <span class="material-symbols-rounded">celebration</span>
                    <p>Congratulations on taking the first step towards your fitness journey! This ${formData.days}-day plan is tailored to help you ${formData.goals.join(', ').toLowerCase()} using ${formData.equipment.join(', ').toLowerCase()} equipment. Stay motivated and push your limits!</p>
                </div>
            `;

            html += '<div class="day-cards-grid">';
            planData.days.forEach((day, index) => {
                html += `
                    <div class="day-card" style="animation-delay: ${index * 0.1}s">
                        <div class="day-header">
                            <h3>Day ${day.day} - ${day.focus}</h3>
                            <span class="duration">${formData.duration} minutes</span>
                        </div>
                        <div class="highlight-box">
                            ${day.warmup && Array.isArray(day.warmup) && day.warmup.length > 0 ? `
                                <h5>Warm-up:</h5>
                                <ul class="highlight-list">
                                    ${day.warmup.map(w => `<li>${w}</li>`).join('')}
                                </ul>
                            ` : ''}
                            ${day.exercises && Array.isArray(day.exercises) && day.exercises.length > 0 ? `
                                <h5>Exercises:</h5>
                                <ul class="highlight-list">
                                    ${day.exercises.map(ex => `<li><strong>${ex.name}:</strong> ${ex.details}</li>`).join('')}
                                </ul>
                            ` : '<p>No exercises available for this day.</p>'}
                            ${day.cooldown && Array.isArray(day.cooldown) && day.cooldown.length > 0 ? `
                                <h5>Cooldown:</h5>
                                <ul class="highlight-list">
                                    ${day.cooldown.map(c => `<li>${c}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            return html;
        }
    }

    function handleRegenerate() {
        // Only reset if explicitly triggered by the user
        if (confirm('Are you sure you want to regenerate the plan? This will clear the current plan.')) {
            workoutPlan.style.display = 'none';
            currentPage = 0;
            showPage(currentPage);
            updateProgressSteps();
            workoutContent.innerHTML = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function handleShare() {
        if (navigator.share) {
            navigator.share({
                title: 'My VitaFit Workout Plan',
                text: 'Check out this personalized workout plan generated by VitaFit!',
                url: window.location.href
            }).catch(err => {
                console.log('Error sharing:', err);
            });
        } else {
            alert('Web Share API not supported in your browser. Copy the text manually.');
        }
    }

    function handleDownload() {
        try {
            if (!workoutPlan.dataset.formData || !workoutPlan.dataset.planText) {
                throw new Error("Workout plan data is not available. Please generate a workout plan first.");
            }

            const formData = JSON.parse(workoutPlan.dataset.formData);
            const planText = JSON.parse(workoutPlan.dataset.planText);

            const doc = formatWorkoutPlan(planText, formData, true);
            doc.save('vitafit-workout-plan.pdf');
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF: ' + error.message);
        }
    }

    updateDaysValue();
    updateDurationValue();

    // Fetch and display workout plan directly on load
    fetch('workout-plan.json')
        .then(response => response.json())
        .then(data => {
            const dummyFormData = {
                days: data.days.length,
                duration: 45,
                fitness_level: "intermediate",
                goals: ["Build Muscle"],
                equipment: ["Dumbbells", "Barbell"],
                focus_areas: ["Full Body"]
            };

            const workoutContent = document.getElementById('workout-content');
            const workoutPlan = document.getElementById('workout-plan');
            workoutPlan.style.display = 'block';
            workoutContent.innerHTML = formatWorkoutPlan(data, dummyFormData);
        })
        .catch(error => {
            console.error('Failed to load workout plan:', error);
            const workoutContent = document.getElementById('workout-content');
            workoutContent.innerHTML = '<p class="error-message">Failed to load workout plan. Check console for details.</p>';
        });
updateDurationValue();

    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-5px); }
            40%, 80% { transform: translateX(5px); }
        }
        .error {
            animation: shake 0.5s;
            box-shadow: 0 0 0 2px var(--warning) !important;
        }
        .loading-spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top: 4px solid var(--primary);
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 2rem auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error-message {
            color: var(--warning);
            text-align: center;
            padding: 2rem;
        }
        .day-cards-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            margin-top: 1rem;
        }
        .highlight-box {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--primary);
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            color: var(--text-primary);
        }
        .highlight-box h4 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            color: var(--primary-light);
        }
        .highlight-box h5 {
            font-size: 1rem;
            margin-top: 1rem;
            margin-bottom: 0.3rem;
            color: var(--primary);
        }
        .highlight-box p {
            margin: 0.5rem 0;
            line-height: 1.5;
            font-size: 0.9rem;
        }
        .highlight-list {
            list-style-type: none;
            padding-left: 0;
            margin-bottom: 0.5rem;
        }
        .highlight-list li {
            position: relative;
            padding-left: 1.2rem;
            margin-bottom: 0.4rem;
            line-height: 1.4;
            font-size: 0.9rem;
        }
        .highlight-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: var(--primary);
            font-size: 1rem;
        }
        @media (max-width: 768px) {
            .day-cards-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
});
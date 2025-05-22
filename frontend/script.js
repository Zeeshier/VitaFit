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
    regenerateBtn.addEventListener('click', handleRegenerate);
    shareBtn.addEventListener('click', handleShare);
    downloadBtn.addEventListener('click', handleDownload);
    
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
            // Add shake animation to indicate error
            currentPageEl.style.animation = 'shake 0.5s';
            setTimeout(() => {
                currentPageEl.style.animation = '';
            }, 500);
        }
        
        return isValid;
    }
    
    async function handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = {
            fitness_level: document.querySelector('input[name="fitness_level"]:checked')?.value || '',
            goals: Array.from(document.querySelectorAll('input[name="goal"]:checked')).map(cb => cb.value),
            equipment: Array.from(document.querySelectorAll('input[name="equipment"]:checked')).map(cb => cb.value),
            days: parseInt(daysSlider.value),
            duration: parseInt(durationSlider.value),
            focus_areas: Array.from(document.querySelectorAll('input[name="focus_area"]:checked')).map(cb => cb.value)
        };
        
        try {
            // Simulate API call with timeout
            workoutContent.innerHTML = '<div class="loading-spinner"></div>';
            workoutPlan.style.display = 'block';
            
            // In a real app, you would make an actual API call here
             const response = await fetch('http://127.0.0.1:8000/generate-plan', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
                body: JSON.stringify(formData)
         });
            const data = await response.json();

        } catch (error) {
            console.error('Error:', error);
            workoutContent.innerHTML = '<p class="error-message">There was an error generating your workout plan. Please try again.</p>';
        }
    }
    
    
    
    function handleRegenerate() {
        workoutPlan.style.display = 'none';
        currentPage = 0;
        showPage(currentPage);
        updateProgressSteps();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    function handleShare() {
        if (navigator.share) {
            navigator.share({
                title: 'My FitAI Workout Plan',
                text: 'Check out this personalized workout plan generated by FitAI!',
                url: window.location.href
            }).catch(err => {
                console.log('Error sharing:', err);
            });
        } else {
            // Fallback for browsers that don't support Web Share API
            alert('Web Share API not supported in your browser. Copy the text manually.');
        }
    }
    
    function handleDownload() {
        const blob = new Blob([workoutContent.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fitai-workout-plan.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Initialize values
    updateDaysValue();
    updateDurationValue();
    
    // Add shake animation to CSS
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
    `;
    document.head.appendChild(style);
});
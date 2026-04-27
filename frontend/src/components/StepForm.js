export function createStepForm(options) {
  const { steps, onComplete, onCancel, initialStep = 1 } = options;

  let currentStep = initialStep;
  const stepData = {};

  const container = document.createElement('div');
  container.className = 'step-form';

  const progressContainer = document.createElement('div');
  progressContainer.className = 'step-form-progress';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'step-form-progress-bar';
  progressBar.style.width = `${(currentStep / steps.length) * 100}%`;
  
  progressContainer.appendChild(progressBar);
  container.appendChild(progressContainer);

  const stepsHeader = document.createElement('div');
  stepsHeader.className = 'step-form-steps';
  
  steps.forEach((step, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = `step-form-step ${index + 1 === currentStep ? 'active' : ''} ${index + 1 < currentStep ? 'completed' : ''}`;
    stepEl.dataset.step = index + 1;
    stepEl.innerHTML = `
      <span class="step-number">${index + 1 < currentStep ? '✓' : index + 1}</span>
      <span class="step-title">${step.title}</span>
    `;
    stepsHeader.appendChild(stepEl);
  });
  
  container.appendChild(stepsHeader);

  const contentContainer = document.createElement('div');
  contentContainer.className = 'step-form-content';
  container.appendChild(contentContainer);

  const footer = document.createElement('div');
  footer.className = 'step-form-footer';
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn btn-secondary';
  prevBtn.textContent = 'Anterior';
  prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  nextBtn.textContent = currentStep < steps.length ? 'Siguiente' : 'Finalizar';
  
  footer.appendChild(prevBtn);
  footer.appendChild(nextBtn);
  container.appendChild(footer);

  async function renderStep() {
    const step = steps[currentStep - 1];
    
    contentContainer.innerHTML = '<div class="step-form-loading">Cargando...</div>';
    
    try {
      contentContainer.innerHTML = '';
      
      const content = await step.content(contentContainer, stepData);
      
      if (content !== undefined && content !== null) {
        if (typeof content === 'string') {
          contentContainer.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          contentContainer.innerHTML = '';
          contentContainer.appendChild(content);
        }
      }
    } catch (error) {
      contentContainer.innerHTML = `<div class="step-form-error">Error: ${error.message}</div>`;
    }

    updateUI();
  }

  function updateUI() {
    const stepEls = stepsHeader.querySelectorAll('.step-form-step');
    stepEls.forEach((el, index) => {
      el.classList.remove('active', 'completed');
      if (index + 1 === currentStep) {
        el.classList.add('active');
      } else if (index + 1 < currentStep) {
        el.classList.add('completed');
      }
    });

    progressBar.style.width = `${(currentStep / steps.length) * 100}%`;
    prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';
    nextBtn.textContent = currentStep < steps.length ? 'Siguiente' : 'Finalizar';
  }

  function validateCurrentStep() {
    const step = steps[currentStep - 1];
    if (step.validate) {
      return step.validate(stepData);
    }
    return true;
  }

  async function goNext() {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < steps.length) {
      currentStep++;
      await renderStep();
    } else {
      if (onComplete) {
        onComplete(stepData);
      }
    }
  }

  function goPrev() {
    if (currentStep > 1) {
      currentStep--;
      renderStep();
    }
  }

  function goToStep(step) {
    if (step >= 1 && step <= steps.length) {
      currentStep = step;
      renderStep();
    }
  }

  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  container.getData = () => ({ ...stepData });
  container.getCurrentStep = () => currentStep;
  container.goNext = goNext;
  container.goPrev = goPrev;
  container.goToStep = goToStep;
  container.setStepData = (key, value) => {
    stepData[key] = value;
  };
  container.validateStep = validateCurrentStep;

  renderStep();

  return container;
}

export function renderStepForm(options) {
  return createStepForm(options);
}

export default { createStepForm, renderStepForm };
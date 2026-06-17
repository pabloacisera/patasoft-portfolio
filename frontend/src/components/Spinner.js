/**
 * Spinner Component
 * Retorna un elemento DOM con animación de carga
 */
export function createSpinner({ size = '24px', color = 'var(--color-forest)' } = {}) {
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.width = size;
  spinner.style.height = size;
  spinner.style.border = `3px solid rgba(0, 0, 0, 0.1)`;
  spinner.style.borderTopColor = color;
  spinner.style.borderRadius = '50%';
  spinner.style.display = 'inline-block';
  spinner.style.animation = 'spin 0.8s linear infinite';
  
  return spinner;
}

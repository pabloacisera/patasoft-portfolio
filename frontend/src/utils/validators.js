const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNI_REGEX = /^\d{7,8}$/;
const CUIT_REGEX = /^\d{2}-\d{8}-\d{1}$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{8,20}$/;
const CUIT_DIGITS = '0123456789';

export function validateRequired(value, fieldName) {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} es requerido`);
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`${fieldName} es requerido`);
  }
  
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`${fieldName} es requerido`);
  }
  
  return true;
}

export function validateEmail(email) {
  if (!email) {
    throw new Error('Email es requerido');
  }
  
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Email inválido');
  }
  
  return true;
}

export function validateDNI(dni) {
  if (!dni) {
    throw new Error('DNI es requerido');
  }
  
  const cleaned = String(dni).replace(/\./g, '').replace(/\s/g, '');
  
  if (!DNI_REGEX.test(cleaned)) {
    throw new Error('DNI debe tener 7 u 8 dígitos');
  }
  
  return true;
}

export function validateCUIT(cuit) {
  if (!cuit) {
    throw new Error('CUIT es requerido');
  }
  
  const cleaned = String(cuit).replace(/-/g, '');
  
  if (cleaned.length !== 11) {
    throw new Error('CUIT debe tener 11 dígitos');
  }
  
  const prefix = cleaned.slice(0, 2);
  if (!['20', '23', '24', '27', '30', '33', '34'].includes(prefix)) {
    throw new Error('CUIT con prefijo inválido');
  }
  
  let sum = 0;
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * multipliers[i];
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  
  if (checkDigit !== parseInt(cleaned[10], 10)) {
    throw new Error('CUIT inválido');
  }
  
  return true;
}

export function validatePhone(phone) {
  if (!phone) {
    return true;
  }
  
  const cleaned = String(phone).replace(/\D/g, '');
  
  if (cleaned.length < 8 || cleaned.length > 15) {
    throw new Error('Teléfono inválido');
  }
  
  return true;
}

export function validatePassword(password) {
  if (!password) {
    throw new Error('Contraseña es requerida');
  }
  
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  
  return true;
}

export function validateConfirm(value, confirmValue, fieldName) {
  if (value !== confirmValue) {
    throw new Error(`${fieldName} no coincide`);
  }
  
  return true;
}

export function validateMinLength(value, min, fieldName) {
  if (!value || value.length < min) {
    throw new Error(`${fieldName} debe tener al menos ${min} caracteres`);
  }
  
  return true;
}

export function validateMaxLength(value, max, fieldName) {
  if (value && value.length > max) {
    throw new Error(`${fieldName} debe tener como máximo ${max} caracteres`);
  }
  
  return true;
}

export function validateRange(value, min, max, fieldName) {
  const num = parseFloat(value);
  
  if (isNaN(num)) {
    throw new Error(`${fieldName} debe ser un número`);
  }
  
  if (num < min || num > max) {
    throw new Error(`${fieldName} debe estar entre ${min} y ${max}`);
  }
  
  return true;
}

export function showFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  let errorEl = input.parentNode.querySelector('.field-error');
  
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    input.parentNode.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  input.classList.add('input-error');
}

export function clearFieldErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  const errorEls = form.querySelectorAll('.field-error');
  errorEls.forEach(el => el.remove());
  
  const inputsWithError = form.querySelectorAll('.input-error');
  inputsWithError.forEach(el => el.classList.remove('input-error'));
}

export function validateForm(formId, validations) {
  clearFieldErrors(formId);
  
  const errors = [];
  
  for (const validation of validations) {
    try {
      validation();
    } catch (error) {
      errors.push(error.message);
      
      if (validation.fieldId) {
        showFieldError(validation.fieldId, error.message);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  
  return true;
}

export function formatDNI(dni) {
  if (!dni) return '';
  return String(dni).replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2.$3');
}

export function formatCUIT(cuit) {
  if (!cuit) return '';
  const cleaned = String(cuit).replace(/\D/g, '');
  if (cleaned.length !== 11) return cuit;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}`;
}

export function formatPhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+54 9 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('54')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}
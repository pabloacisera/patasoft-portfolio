const STATUS_TRANSLATIONS = {
  payment: {
    PENDING: 'Pendiente',
    PARTIAL: 'Parcial',
    PAID: 'Pagado',
    DEFERRED: 'Diferido',
    CANCELLED: 'Cancelado',
    OVERDUE: 'Vencido',
  },
  debt: {
    PENDING: 'Pendiente',
    PAID: 'Pagado',
    OVERDUE: 'Vencido',
    CANCELLED: 'Cancelado',
  },
  subscription: {
    ACTIVE: 'Activo',
    TRIAL: 'Prueba gratuita',
    EXPIRED: 'Expirado',
    CANCELLED: 'Cancelado',
    BLOCKED: 'Bloqueado',
  },
  connection: {
    PENDING: 'Pendiente',
    ACCEPTED: 'Aceptado',
    REJECTED: 'Rechazado',
    BLOCKED: 'Bloqueado',
  },
  user: {
    ADMIN: 'Administrador',
    USER: 'Usuario',
    SUPER_ADMIN: 'Super Admin',
  },
  notification: {
    READ: 'Leída',
    UNREAD: 'No leída',
  },
};

const SPECIES_TRANSLATIONS = {
  DOG: 'Perro',
  CAT: 'Gato',
  BIRD: 'Ave',
  RABBIT: 'Conejo',
  REPTILE: 'Reptil',
  OTHER: 'Otro',
  HORSE: 'Caballo',
};

const GENDER_TRANSLATIONS = {
  MALE: 'Macho',
  FEMALE: 'Hembra',
  UNKNOWN: 'Desconocido',
};

const METHOD_TRANSLATIONS = {
  CASH: 'Efectivo',
  CREDIT_CARD: 'Tarjeta de Crédito',
  DEBIT_CARD: 'Tarjeta de Débito',
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  ACCOUNT_CURRENT: 'Cuenta Corriente',
};

export function formatCurrency(amount, currency = 'ARS') {
  if (amount == null || isNaN(amount)) {
    return '$0,00';
  }
  
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return currency === 'ARS' ? `$${formatted}` : `${formatted} ${currency}`;
}

export function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatStatus(status, type) {
  if (!status || !type) return status || '';
  
  const translations = STATUS_TRANSLATIONS[type];
  return translations?.[status] || status;
}

export function formatSpecies(species) {
  if (!species) return '';
  return SPECIES_TRANSLATIONS[species.toUpperCase()] || species;
}

export function formatGender(gender) {
  if (!gender) return '';
  return GENDER_TRANSLATIONS[gender.toUpperCase()] || gender;
}

export function formatPaymentMethod(method) {
  if (!method) return '';
  return METHOD_TRANSLATIONS[method.toUpperCase()] || method;
}

export function formatRelativeTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  
  return formatDate(date);
}

export function formatPhone(phone) {
  if (!phone) return '';
  
  const cleaned = String(phone).replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+54 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}

export function formatWeight(weight) {
  if (weight == null || isNaN(weight)) return '0 kg';
  return `${weight.toFixed(2)} kg`;
}

export function formatAge(birthDate) {
  if (!birthDate) return '';
  
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return '';
  
  const now = new Date();
  const years = now.getFullYear() - d.getFullYear();
  const months = now.getMonth() - d.getMonth();
  
  if (years < 1) {
    const totalMonths = (now.getFullYear() - d.getFullYear()) * 12 + months;
    return totalMonths <= 0 ? '< 1 mes' : `${totalMonths} mes${totalMonths > 1 ? 'es' : ''}`;
  }
  
  return `${years} año${years > 1 ? 's' : ''}`;
}
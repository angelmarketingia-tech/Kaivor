/**
 * Catálogo de verticales PYME. Cada vertical es un conjunto de flags que configura
 * cómo se comporta el POS/facturación — sin tablas nuevas, solo banderas.
 * El front lee esto para mostrar/ocultar campos; el back lo usa para defaults y validación.
 */
export type BusinessVertical = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  // Qué muestra el POS para esta vertical
  features: {
    inventory: boolean; // controla stock (retail) vs no (servicios)
    itemType: 'product' | 'service' | 'both';
    tip: boolean; // propina
    serviceCharge: boolean; // cargo por servicio
    table: boolean; // mesa
    professional: boolean; // profesional/estilista que atiende
    duration: boolean; // duración del servicio (minutos/horas)
    barcode: boolean; // lectura de código de barras
  };
  defaults: {
    unit: string; // unidad por defecto de los items
    tipPercent: number; // % de propina sugerido
    serviceChargePercent: number; // % de cargo por servicio
    itemNoun: string; // cómo se llaman los items ("Productos", "Servicios", "Platos")
    customerNoun: string; // cómo se llama el cliente ("Cliente", "Paciente", "Comensal")
  };
};

export const BUSINESS_VERTICALS: Record<string, BusinessVertical> = {
  generic: {
    id: 'generic', label: 'General', emoji: '🏪',
    description: 'Negocio general: productos y/o servicios.',
    features: { inventory: true, itemType: 'both', tip: false, serviceCharge: false, table: false, professional: false, duration: false, barcode: true },
    defaults: { unit: 'u', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Productos/Servicios', customerNoun: 'Cliente' },
  },
  retail: {
    id: 'retail', label: 'Tienda / Retail', emoji: '🛍️',
    description: 'Venta de productos con control de inventario y código de barras.',
    features: { inventory: true, itemType: 'product', tip: false, serviceCharge: false, table: false, professional: false, duration: false, barcode: true },
    defaults: { unit: 'u', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Productos', customerNoun: 'Cliente' },
  },
  restaurant: {
    id: 'restaurant', label: 'Restaurante / Café', emoji: '🍽️',
    description: 'Mesas, propina y cargo por servicio. Comandas rápidas.',
    features: { inventory: true, itemType: 'product', tip: true, serviceCharge: true, table: true, professional: false, duration: false, barcode: false },
    defaults: { unit: 'plato', tipPercent: 10, serviceChargePercent: 0, itemNoun: 'Platos', customerNoun: 'Comensal' },
  },
  barbershop: {
    id: 'barbershop', label: 'Barbería / Salón', emoji: '💈',
    description: 'Servicios por profesional, con propina y duración.',
    features: { inventory: false, itemType: 'both', tip: true, serviceCharge: false, table: false, professional: true, duration: true, barcode: false },
    defaults: { unit: 'servicio', tipPercent: 10, serviceChargePercent: 0, itemNoun: 'Servicios', customerNoun: 'Cliente' },
  },
  beauty: {
    id: 'beauty', label: 'Estética / Spa', emoji: '💅',
    description: 'Tratamientos y servicios de belleza con profesional y duración.',
    features: { inventory: true, itemType: 'both', tip: true, serviceCharge: false, table: false, professional: true, duration: true, barcode: false },
    defaults: { unit: 'sesión', tipPercent: 10, serviceChargePercent: 0, itemNoun: 'Servicios', customerNoun: 'Cliente' },
  },
  services: {
    id: 'services', label: 'Servicios profesionales', emoji: '🧰',
    description: 'Cobro por servicio u hora, sin inventario.',
    features: { inventory: false, itemType: 'service', tip: false, serviceCharge: false, table: false, professional: false, duration: true, barcode: false },
    defaults: { unit: 'hora', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Servicios', customerNoun: 'Cliente' },
  },
  health: {
    id: 'health', label: 'Salud / Consultorio', emoji: '🩺',
    description: 'Consultas y procedimientos por profesional. Sin inventario obligatorio.',
    features: { inventory: false, itemType: 'service', tip: false, serviceCharge: false, table: false, professional: true, duration: true, barcode: false },
    defaults: { unit: 'consulta', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Servicios', customerNoun: 'Paciente' },
  },
  automotive: {
    id: 'automotive', label: 'Taller / Automotriz', emoji: '🔧',
    description: 'Repuestos (inventario) + mano de obra (servicio).',
    features: { inventory: true, itemType: 'both', tip: false, serviceCharge: false, table: false, professional: true, duration: false, barcode: true },
    defaults: { unit: 'u', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Repuestos/Servicios', customerNoun: 'Cliente' },
  },
  education: {
    id: 'education', label: 'Educación / Academia', emoji: '🎓',
    description: 'Cursos, clases y matrículas. Sin inventario.',
    features: { inventory: false, itemType: 'service', tip: false, serviceCharge: false, table: false, professional: true, duration: true, barcode: false },
    defaults: { unit: 'clase', tipPercent: 0, serviceChargePercent: 0, itemNoun: 'Cursos/Clases', customerNoun: 'Estudiante' },
  },
};

export function getVertical(type?: string | null): BusinessVertical {
  return BUSINESS_VERTICALS[type || 'generic'] || BUSINESS_VERTICALS.generic;
}

export const VERTICAL_LIST = Object.values(BUSINESS_VERTICALS);

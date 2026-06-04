/**
 * Permisos granulares de ADMIA/Kaivor.
 *
 * El dueño (admin) crea usuarios adicionales con un ROL predefinido (que trae permisos
 * por defecto) y luego puede ajustar finamente con interruptores qué ve cada perfil.
 *
 * Los permisos se guardan en User.permissions (Json) como un objeto { [permKey]: boolean }.
 * Si una clave no está presente, se usa el default del rol.
 */

export const PERMISSIONS = [
  // Operación básica
  { key: 'pos.use', label: 'Usar punto de venta', group: 'Operación' },
  { key: 'invoices.view', label: 'Ver facturas', group: 'Operación' },
  { key: 'invoices.create', label: 'Crear facturas', group: 'Operación' },
  { key: 'customers.view', label: 'Ver clientes', group: 'Operación' },
  { key: 'customers.manage', label: 'Crear/editar clientes', group: 'Operación' },
  { key: 'products.view', label: 'Ver productos', group: 'Operación' },
  { key: 'products.manage', label: 'Crear/editar productos', group: 'Operación' },
  { key: 'appointments.use', label: 'Agenda / citas', group: 'Operación' },
  { key: 'tables.use', label: 'Mesas (restaurante)', group: 'Operación' },

  // SENSIBLE — oculto por defecto a cajeros/asistentes
  { key: 'costs.view', label: 'Ver costos y utilidades/márgenes', group: 'Sensible', sensitive: true },
  { key: 'suppliers.view', label: 'Ver proveedores', group: 'Sensible', sensitive: true },
  { key: 'reports.view', label: 'Ver reportes y dashboard financiero', group: 'Sensible', sensitive: true },
  { key: 'inventory.view', label: 'Ver inventario', group: 'Sensible', sensitive: true },
  { key: 'hr.view', label: 'Ver RRHH y nómina', group: 'Sensible', sensitive: true },
  { key: 'accounts.view', label: 'Ver cuentas / finanzas', group: 'Sensible', sensitive: true },
  { key: 'ai.use', label: 'Usar IA y asistentes', group: 'Sensible', sensitive: true },

  // Administración
  { key: 'team.manage', label: 'Gestionar usuarios del equipo', group: 'Administración', sensitive: true },
  { key: 'settings.manage', label: 'Configuración del negocio', group: 'Administración', sensitive: true },
  { key: 'integrations.manage', label: 'Integraciones (WooCommerce, pagos)', group: 'Administración', sensitive: true },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const allTrue = () => Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true]));

/**
 * Defaults por rol. admin/manager ven todo; cashier/accountant/viewer tienen lo sensible OFF
 * por defecto (el dueño puede activar interruptores caso por caso).
 */
export const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  // Dueño / administrador del negocio: todo.
  admin: allTrue(),
  manager: allTrue(),

  // Cajero: opera el POS y factura; NADA sensible.
  cashier: {
    'pos.use': true,
    'invoices.view': true,
    'invoices.create': true,
    'customers.view': true,
    'customers.manage': true,
    'products.view': true,
    'appointments.use': true,
    'tables.use': true,
    // sensibles OFF
    'costs.view': false,
    'suppliers.view': false,
    'reports.view': false,
    'inventory.view': false,
    'hr.view': false,
    'accounts.view': false,
    'ai.use': false,
    'team.manage': false,
    'settings.manage': false,
    'integrations.manage': false,
    'products.manage': false,
  },

  // Asistente: como cajero pero solo lectura de operación; sin sensibles.
  assistant: {
    'pos.use': true,
    'invoices.view': true,
    'invoices.create': true,
    'customers.view': true,
    'customers.manage': true,
    'products.view': true,
    'appointments.use': true,
    'tables.use': true,
    'costs.view': false,
    'suppliers.view': false,
    'reports.view': false,
    'inventory.view': false,
    'hr.view': false,
    'accounts.view': false,
    'ai.use': false,
    'team.manage': false,
    'settings.manage': false,
    'integrations.manage': false,
    'products.manage': false,
  },

  // Contador: finanzas/reportes/cuentas y costos, pero NO equipo ni configuración general.
  accountant: {
    'pos.use': false,
    'invoices.view': true,
    'invoices.create': false,
    'customers.view': true,
    'customers.manage': false,
    'products.view': true,
    'products.manage': false,
    'appointments.use': false,
    'tables.use': false,
    'costs.view': true,
    'suppliers.view': true,
    'reports.view': true,
    'inventory.view': true,
    'hr.view': true,
    'accounts.view': true,
    'ai.use': true,
    'team.manage': false,
    'settings.manage': false,
    'integrations.manage': false,
  },

  // Visor: solo lectura básica, nada sensible.
  viewer: {
    'pos.use': false,
    'invoices.view': true,
    'invoices.create': false,
    'customers.view': true,
    'customers.manage': false,
    'products.view': true,
    'products.manage': false,
    'appointments.use': false,
    'tables.use': false,
    'costs.view': false,
    'suppliers.view': false,
    'reports.view': false,
    'inventory.view': false,
    'hr.view': false,
    'accounts.view': false,
    'ai.use': false,
    'team.manage': false,
    'settings.manage': false,
    'integrations.manage': false,
  },
};

// platform_superadmin / superadmin: acceso total (no se limita por permisos).
export function isSuperRole(role?: string): boolean {
  return role === 'platform_superadmin' || role === 'superadmin';
}

/**
 * Permisos efectivos de un usuario = defaults del rol, sobreescritos por overrides explícitos.
 * Superadmin y admin/manager => todo true.
 */
export function effectivePermissions(role: string, overrides?: Record<string, boolean> | null): Record<string, boolean> {
  if (isSuperRole(role)) return allTrue();
  const base = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.viewer;
  const result: Record<string, boolean> = { ...base };
  if (overrides && typeof overrides === 'object') {
    for (const k of ALL_PERMISSION_KEYS) {
      if (typeof overrides[k] === 'boolean') result[k] = overrides[k];
    }
  }
  return result;
}

export function hasPermission(
  role: string,
  overrides: Record<string, boolean> | null | undefined,
  key: PermissionKey,
): boolean {
  if (isSuperRole(role) || role === 'admin' || role === 'manager') return true;
  return effectivePermissions(role, overrides)[key] === true;
}

// Límite de usuarios por plan. -1 = ilimitado.
export const USER_LIMIT_BY_PLAN: Record<string, number> = {
  FREE: 1,
  STARTER: 3,
  PRO_AI: 6,
  BUSINESS: 15,
  ENTERPRISE: -1,
};

export const ASSIGNABLE_ROLES = ['admin', 'manager', 'cashier', 'assistant', 'accountant', 'viewer'];

/**
 * Plantillas de rol POR TIPO DE NEGOCIO (vertical).
 * Cada plantilla tiene un nombre familiar para el dueño y mapea a un ROL BASE real
 * (cashier/assistant/accountant/manager) + overrides de permisos opcionales.
 * Mejora la UX: un restaurante ve "Mesero/Cocina", una barbería "Barbero/Recepción", etc.
 */
export type RoleTemplate = {
  id: string;
  label: string;
  baseRole: string; // rol real que se guarda en User.role
  hint: string;
  permissions?: Record<string, boolean>; // overrides sobre los defaults del rol base
};

// Permisos típicos reutilizables.
const ONLY_POS: Record<string, boolean> = {
  'pos.use': true, 'invoices.view': true, 'invoices.create': true,
  'customers.view': true, 'customers.manage': true, 'products.view': true,
  'costs.view': false, 'suppliers.view': false, 'reports.view': false,
  'inventory.view': false, 'hr.view': false, 'accounts.view': false,
  'ai.use': false, 'team.manage': false, 'settings.manage': false,
};

export const VERTICAL_ROLE_TEMPLATES: Record<string, RoleTemplate[]> = {
  restaurant: [
    { id: 'mesero', label: 'Mesero', baseRole: 'cashier', hint: 'Toma pedidos y maneja mesas. No ve costos ni reportes.', permissions: { ...ONLY_POS, 'tables.use': true, 'appointments.use': false } },
    { id: 'cocina', label: 'Cocina', baseRole: 'viewer', hint: 'Ve comandas/pedidos. Sin acceso a dinero ni reportes.', permissions: { 'tables.use': true, 'products.view': true, 'invoices.view': false, 'pos.use': false } },
    { id: 'cajero_rest', label: 'Cajero', baseRole: 'cashier', hint: 'Cobra y cierra cuentas. No ve costos ni proveedores.', permissions: { ...ONLY_POS, 'tables.use': true } },
    { id: 'admin_rest', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo: ventas, costos, reportes, equipo.' },
  ],
  retail: [
    { id: 'cajero_ret', label: 'Cajero', baseRole: 'cashier', hint: 'Vende en el POS y factura. No ve costos ni proveedores.', permissions: ONLY_POS },
    { id: 'bodega', label: 'Bodega / Inventario', baseRole: 'assistant', hint: 'Gestiona stock y productos. Ve inventario, no costos.', permissions: { 'pos.use': false, 'products.view': true, 'products.manage': true, 'inventory.view': true, 'invoices.view': false, 'costs.view': false, 'suppliers.view': false, 'reports.view': false } },
    { id: 'admin_ret', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo: ventas, costos, proveedores, reportes.' },
  ],
  barbershop: [
    { id: 'barbero', label: 'Barbero / Estilista', baseRole: 'cashier', hint: 'Atiende clientes y cobra sus servicios. No ve costos ni reportes.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'recepcion_barber', label: 'Recepción', baseRole: 'assistant', hint: 'Agenda citas y cobra. No ve costos ni reportes financieros.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'admin_barber', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo del negocio.' },
  ],
  beauty: [
    { id: 'esteticista', label: 'Esteticista / Profesional', baseRole: 'cashier', hint: 'Atiende y cobra sus servicios. Sin costos ni reportes.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'recepcion_beauty', label: 'Recepción', baseRole: 'assistant', hint: 'Agenda y cobra. No ve datos financieros.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'admin_beauty', label: 'Administradora', baseRole: 'manager', hint: 'Acceso completo del negocio.' },
  ],
  health: [
    { id: 'profesional_salud', label: 'Profesional / Médico', baseRole: 'assistant', hint: 'Atiende pacientes y agenda. Ve sus citas, no finanzas del negocio.', permissions: { 'pos.use': true, 'appointments.use': true, 'invoices.view': true, 'invoices.create': true, 'customers.view': true, 'customers.manage': true, 'products.view': true, 'costs.view': false, 'suppliers.view': false, 'reports.view': false, 'hr.view': false, 'accounts.view': false } },
    { id: 'recepcion_salud', label: 'Recepción', baseRole: 'assistant', hint: 'Agenda pacientes y cobra. Sin acceso a finanzas.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'admin_salud', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo del consultorio.' },
  ],
  automotive: [
    { id: 'mecanico', label: 'Mecánico', baseRole: 'cashier', hint: 'Registra trabajos y repuestos. No ve costos ni proveedores.', permissions: { ...ONLY_POS, 'inventory.view': true } },
    { id: 'recepcion_taller', label: 'Recepción / Mostrador', baseRole: 'assistant', hint: 'Atiende clientes, cotiza y cobra. Sin costos ni reportes.', permissions: ONLY_POS },
    { id: 'admin_taller', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo: costos, repuestos, proveedores, reportes.' },
  ],
  services: [
    { id: 'profesional_serv', label: 'Profesional', baseRole: 'cashier', hint: 'Cobra sus servicios y agenda. Sin costos ni reportes.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'asistente_serv', label: 'Asistente', baseRole: 'assistant', hint: 'Apoyo operativo y agenda. Sin datos financieros.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'admin_serv', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo.' },
  ],
  education: [
    { id: 'docente', label: 'Docente / Profesor', baseRole: 'assistant', hint: 'Ve sus clases y estudiantes. Sin acceso a finanzas.', permissions: { 'appointments.use': true, 'customers.view': true, 'products.view': true, 'pos.use': false, 'invoices.view': false, 'costs.view': false, 'reports.view': false } },
    { id: 'secretaria_edu', label: 'Secretaría / Matrículas', baseRole: 'cashier', hint: 'Matricula y cobra. Sin reportes financieros.', permissions: { ...ONLY_POS, 'appointments.use': true } },
    { id: 'admin_edu', label: 'Coordinador / Admin', baseRole: 'manager', hint: 'Acceso completo de la academia.' },
  ],
  generic: [
    { id: 'cajero_gen', label: 'Cajero', baseRole: 'cashier', hint: 'Vende y factura. No ve costos ni datos sensibles.', permissions: ONLY_POS },
    { id: 'asistente_gen', label: 'Asistente', baseRole: 'assistant', hint: 'Apoyo operativo básico.', permissions: ONLY_POS },
    { id: 'admin_gen', label: 'Administrador', baseRole: 'manager', hint: 'Acceso completo del negocio.' },
  ],
};

// Roles genéricos (avanzado), siempre disponibles bajo "Más opciones".
export const GENERIC_ROLE_TEMPLATES: RoleTemplate[] = [
  { id: 'g_cashier', label: 'Cajero', baseRole: 'cashier', hint: 'Opera el POS y factura. Sin datos sensibles.' },
  { id: 'g_assistant', label: 'Asistente', baseRole: 'assistant', hint: 'Apoyo operativo básico.' },
  { id: 'g_accountant', label: 'Contador', baseRole: 'accountant', hint: 'Reportes, cuentas y costos. No gestiona el equipo.' },
  { id: 'g_manager', label: 'Gerente', baseRole: 'manager', hint: 'Acceso completo del negocio.' },
  { id: 'g_viewer', label: 'Solo lectura', baseRole: 'viewer', hint: 'Consulta básica, nada sensible.' },
];

export function roleTemplatesForVertical(vertical?: string | null): {
  vertical: RoleTemplate[];
  generic: RoleTemplate[];
} {
  const v = VERTICAL_ROLE_TEMPLATES[vertical || 'generic'] || VERTICAL_ROLE_TEMPLATES.generic;
  return { vertical: v, generic: GENERIC_ROLE_TEMPLATES };
}

// Payment provider adapter architecture.
// There are no real provider credentials in this environment, so adapters are
// HONEST: they validate configuration, support sandbox/production modes, and
// NEVER report a payment as confirmed unless a real confirmation exists.

export interface PaymentConfig {
  provider: string;
  status: string;        // active, inactive, error
  environment: string;   // sandbox, production
  merchantId?: string | null;
  receiverInfo?: string | null;
  hasKeys: boolean;
}

export interface AdapterResult {
  ok: boolean;
  status: string;        // ok, error, pending, config_pending, manual_registered
  message: string;
  transactionId?: string;
}

export interface PaymentInput {
  amount: number;
  reference?: string;
}

export interface PaymentProviderAdapter {
  provider: string;
  /** Validates that the integration is correctly configured. */
  testConnection(cfg: PaymentConfig): Promise<AdapterResult>;
  /** Starts a payment. Returns honest status — never a false "confirmed". */
  createPayment(cfg: PaymentConfig, input: PaymentInput): Promise<AdapterResult>;
  /** Queries the status of a payment by transaction id. */
  getPaymentStatus(cfg: PaymentConfig, txId: string): Promise<AdapterResult>;
  /** Cancels a payment. */
  cancelPayment(cfg: PaymentConfig, txId: string): Promise<AdapterResult>;
  /** Processes an inbound webhook payload from the provider. */
  handleWebhook(cfg: PaymentConfig, payload: any): Promise<AdapterResult>;
}

// ── Manual adapter — always operational, no external dependency ──────────────
const manualAdapter: PaymentProviderAdapter = {
  provider: 'manual',
  async testConnection() {
    return { ok: true, status: 'ok', message: 'El registro manual de pagos está siempre disponible.' };
  },
  async createPayment(_cfg, input) {
    return { ok: true, status: 'manual_registered', message: `Pago de ${input.amount} registrado manualmente.` };
  },
  async getPaymentStatus() {
    return { ok: true, status: 'manual_registered', message: 'Pago operativo registrado manualmente.' };
  },
  async cancelPayment() {
    return { ok: true, status: 'cancelled', message: 'Pago manual cancelado.' };
  },
  async handleWebhook() {
    return { ok: true, status: 'ok', message: 'Sin webhook para pagos manuales.' };
  },
};

// ── Wallet adapter (Nequi / Daviplata / QR) — needs a receiver account ───────
function walletAdapter(provider: string, label: string): PaymentProviderAdapter {
  return {
    provider,
    async testConnection(cfg) {
      if (cfg.status !== 'active') return { ok: false, status: 'error', message: `${label} está inactivo.` };
      if (!cfg.receiverInfo) return { ok: false, status: 'error', message: `Falta el número/cuenta receptora de ${label}.` };
      return { ok: true, status: 'ok', message: `${label} configurado en ambiente ${cfg.environment}. Listo para registrar pagos con referencia.` };
    },
    async createPayment(cfg, input) {
      if (!cfg.receiverInfo) {
        return { ok: false, status: 'config_pending', message: `Configura el receptor de ${label} para cobrar.` };
      }
      // No provider API: payment requires manual confirmation of the transfer reference.
      return {
        ok: true, status: 'pending',
        message: `Solicitud de pago por ${label} a ${cfg.receiverInfo}. Confirma la transferencia con la referencia.`,
      };
    },
    async getPaymentStatus() {
      return { ok: true, status: 'pending', message: `Confirma manualmente el pago por ${label}.` };
    },
    async cancelPayment() {
      return { ok: true, status: 'cancelled', message: `Pago por ${label} cancelado.` };
    },
    async handleWebhook(_cfg, payload) {
      const ref = payload?.reference || payload?.transactionId || null;
      return { ok: true, status: 'ok', message: `Webhook de ${label} recibido${ref ? ` (ref ${ref})` : ''}.` };
    },
  };
}

// ── Gateway adapter (Cards / Addi) — needs API keys ──────────────────────────
function gatewayAdapter(provider: string, label: string): PaymentProviderAdapter {
  return {
    provider,
    async testConnection(cfg) {
      if (cfg.status !== 'active') return { ok: false, status: 'error', message: `${label} está inactivo.` };
      if (!cfg.hasKeys) return { ok: false, status: 'error', message: `Faltan las llaves de API de ${label}.` };
      if (!cfg.merchantId) return { ok: false, status: 'error', message: `Falta el Merchant ID de ${label}.` };
      return {
        ok: true, status: 'ok',
        message: `${label} validado en ambiente ${cfg.environment}. ${cfg.environment === 'sandbox' ? 'Modo pruebas: los cobros no son reales.' : 'Modo producción.'}`,
      };
    },
    async createPayment(cfg, input) {
      if (!cfg.hasKeys || !cfg.merchantId) {
        return { ok: false, status: 'config_pending', message: `Configura ${label} (llaves + merchant) para cobrar.` };
      }
      if (cfg.environment === 'sandbox') {
        return {
          ok: true, status: 'pending', transactionId: `SBX-${Date.now()}`,
          message: `Pago sandbox de ${label} iniciado (${input.amount}). No es un cobro real — requiere confirmación del proveedor.`,
        };
      }
      // Production without a real SDK integration: do not fake a charge.
      return {
        ok: false, status: 'config_pending',
        message: `${label} en producción requiere integración con el SDK del proveedor. Usa registro manual mientras tanto.`,
      };
    },
    async getPaymentStatus(_cfg, txId) {
      return { ok: true, status: 'pending', message: `Estado de ${label} para ${txId}: pendiente de confirmación del proveedor.` };
    },
    async cancelPayment() {
      return { ok: true, status: 'cancelled', message: `Pago de ${label} cancelado.` };
    },
    async handleWebhook(_cfg, payload) {
      const status = payload?.status || 'unknown';
      return { ok: true, status: 'ok', message: `Webhook de ${label} recibido con estado "${status}".` };
    },
  };
}

const bankAdapter = walletAdapter('bank_transfer', 'Transferencia bancaria');

const ADAPTERS: Record<string, PaymentProviderAdapter> = {
  manual: manualAdapter,
  nequi: walletAdapter('nequi', 'Nequi'),
  daviplata: walletAdapter('daviplata', 'Daviplata'),
  qr: walletAdapter('qr', 'Pago QR'),
  bank_transfer: bankAdapter,
  cards: gatewayAdapter('cards', 'Tarjetas'),
  addi: gatewayAdapter('addi', 'Addi'),
  other: manualAdapter,
};

export function getPaymentAdapter(provider: string): PaymentProviderAdapter {
  return ADAPTERS[provider] ?? manualAdapter;
}

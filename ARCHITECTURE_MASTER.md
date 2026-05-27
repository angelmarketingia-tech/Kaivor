# ADMIA: Plataforma SaaS Operativa Empresarial LATAM
## Especificación y Arquitectura Maestro

**Versión**: 1.0  
**Fecha**: 2026-05-14  
**Clasificación**: Enterprise Architecture Specification  
**Estándar**: Comparable a Stripe Engineering, Linear Architecture, Vercel Systems  

---

## TABLA DE CONTENIDOS

1. Visión y Contexto Estratégico
2. Filosofía de Diseño
3. Arquitectura General del Sistema
4. Arquitectura Multi-Tenant Enterprise
5. Event-Driven Architecture
6. Sistema de IA Nativo
7. Design System y Lenguaje Visual
8. Principios de UX
9. Estrategia Mobile-First
10. Arquitectura Offline-First
11. Seguridad Enterprise
12. Escalabilidad y Performance
13. Infraestructura Cloud
14. DevOps y CI/CD
15. Observabilidad
16. PostgreSQL Schema Strategy
17. API Architecture
18. Módulos Detallados (25)
19. Roadmap de Desarrollo
20. Sprint Planning
21. Riesgos Técnicos
22. Estrategia de Testing
23. Estrategia de Deployment
24. Estrategia de Crecimiento
25. Estándares de Calidad Absolutos

---

## 1. VISIÓN Y CONTEXTO ESTRATÉGICO

### 1.1 Declaración de Visión

Construir la **plataforma SaaS operativa #1 de LATAM** que redefine estándares de software empresarial.

ADMIA es el **"Stripe + Notion + Linear + Toast + Shopify de LATAM"** diseñado para PyMEs que necesitan:

- Software moderno, no legacy
- Operación real empresarial (POS, Facturación, Inventario, Finanzas)
- Inteligencia artificial integrada naturalmente
- Experiencia premium y minimalista
- Escalabilidad sin límites
- Funcionamiento offline real
- Integración DIAN Colombia y regulaciones LATAM

### 1.2 Posicionamiento de Mercado

**Vs. Competencia Tradicional**:

| Aspecto | GESADMIN/Siigo | Alegra | ADMIA |
|---------|----------------|--------|-------|
| Interfaz | ERP viejo, confuso | Moderno pero limitado | Premium, intuitiva, seamless |
| AI | Nada | Reportes básicos | AI nativa en workflows |
| Mobile | No real | App básica | Mobile-first, offline real |
| Escalabilidad | Monolítica | Multi-tenant débil | Hyperscale arquitectura |
| UX | Contable | Simple | Diseño obsesivo (Apple-level) |
| Integraciones | Limitadas | Algunas | API-first, ecosystem |
| Precio | $500-$2000/mes | $300-$1000/mes | Freemium → $500/mes |

**Diferencial Clave**:
- No es ERP disfrazado
- No es dashboard genérico
- No es clone de competidor
- Es **sistema operativo empresarial** rediseñado desde cero

### 1.3 Target Market

**Segmento Principal**:
- PyMEs LATAM (10-500 empleados)
- Restaurantes, retail, distribución
- Necesidad urgente de modernización
- Presupuesto: $300-$2000/mes/empresa

**Segmento Secundario**:
- Medianas empresas (500-5000 empleados)
- Multitenancia corporativa
- Necesidad de customización y escalabilidad

### 1.4 Métricas de Éxito

**Año 1**:
- 5,000 clientes activos
- $2.5M ARR
- NPS > 70
- Churn < 3% mensual
- Feature completeness: 80% roadmap

**Año 3**:
- 50,000 clientes
- $50M ARR
- Market leader LATAM
- Integración ecosistema completo

---

## 2. FILOSOFÍA DE DISEÑO

### 2.1 Principios Fundamentales

**Simplicidad Obsesiva**
- Eliminar opciones innecesarias
- Workflows directos a solución
- Menos botones, mejor ubicados
- Contexto inteligente en lugar de formularios

**Claridad Premium**
- Tipografía refinada (Inter, Geist)
- Spacing arquitectónico perfecto
- Jerarquía visual impecable
- Contraste alto, accesibilidad WCAG AAA

**Velocidad Percibida y Real**
- Skeleton loading antes que spinners
- Optimistic updates
- Prefetching inteligente
- Animaciones <300ms, easing cubic-bezier

**Inteligencia Invisible**
- IA sugiere, no interrumpe
- Automatización sin avisos
- Recomendaciones contextuales
- Copilotos que entienden intención

**Mobile-First Radical**
- Diseñar para thumbs-up interaction
- 44x44px min tap targets
- Scroll vertical primario
- Gestos intuitivos naturales

### 2.2 Inspiración Visual

**Stripe**
- Elegancia minimalista
- Uso de espacio negativo
- Tipografía perfecta
- Colores neutros confianza

**Linear**
- Velocidad y responsividad
- Keyboard shortcuts intuitivos
- Minimal design philosophy
- Transiciones suaves

**Apple**
- Obsesión por detalles
- Microinteracciones refinadas
- Coherencia absoluta
- Refinamiento extremo

**Notion**
- Flexibilidad sin complejidad
- Bloques intuitivos
- Experiencia modular
- Customización sin código

**Arc Browser**
- Navegación contextual
- Comandos rápidos
- Interfaz inusual pero clara
- Diseño que inspira

### 2.3 Paleta de Colores

```
Primario:
- Brand Blue: #1F2937 (neutrals), #3B82F6 (action)

Neutrals (Gray scale):
- 50: #F9FAFB
- 100: #F3F4F6
- 200: #E5E7EB
- 300: #D1D5DB
- 400: #9CA3AF
- 500: #6B7280
- 600: #4B5563
- 700: #374151
- 800: #1F2937
- 900: #111827

Semantic:
- Success: #10B981 (verdante, crecimiento)
- Warning: #F59E0B (ámbar, atención)
- Error: #EF4444 (rojo vivo, acción)
- Info: #3B82F6 (azul, información)

Accent (por contexto):
- Purple: #A855F7 (premium, IA)
- Orange: #F97316 (energía, POS)
- Green: #059669 (operación fluida)
```

### 2.4 Tipografía

```
Headlines:
- Font: Geist (SFMono para código)
- Weight: 600-700
- Line height: 1.2

Body:
- Font: Inter
- Weight: 400-500
- Size: 14-16px
- Line height: 1.5

Code:
- Font: Geist Mono
- Size: 12-14px
- Line height: 1.6
```

### 2.5 Spacing Grid

```
Base: 4px
Standard intervals: 4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 80, 96

Usage:
- Intra-component: 4-8px
- Component padding: 12-16px
- Section spacing: 24-32px
- Screen padding: 16-32px (mobile), 32-48px (desktop)
```

### 2.6 Estados Visuales

**Loading**
- Skeleton loading (preferido sobre spinners)
- 60% neutral-200 opacity
- Animated pulse 2s ease-in-out infinite

**Empty States**
- Ilustración minimalista
- Texto centrado claro
- CTA principal visible
- Contextual suggestions

**Error States**
- Icon + headline + description
- Código de error para soporte
- CTA para resolver (retry, contact support)
- Non-blocking cuando es posible

**Success States**
- Toast de confirmación (4s duration)
- Green checkmark
- Motion: scale 0.8→1 cubic-bezier(0.34, 1.56, 0.64, 1)
- Audio feedback optional

---

## 3. ARQUITECTURA GENERAL DEL SISTEMA

### 3.1 Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
├─────────────────────────────────────────────────────────┤
│  Web App (Next.js)  │  Mobile App (RN+Expo) │  PWA     │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
           ├──────────────────────┤
           │                      │
┌──────────▼──────────┐  ┌────────▼──────────┐
│  CDN/Edge Layer     │  │  Sync Engine      │
│  (Cloudflare)       │  │  (Offline)        │
└──────────┬──────────┘  └────────┬──────────┘
           │                      │
           └──────────┬───────────┘
                      │
        ┌─────────────▼─────────────┐
        │   API Gateway Layer       │
        │   - Auth / RBAC           │
        │   - Rate limiting         │
        │   - Request routing       │
        └─────────────┬─────────────┘
                      │
     ┌────────────────┼────────────────┐
     │                │                │
┌────▼────┐    ┌──────▼──────┐   ┌────▼────┐
│ Services│    │  Event Bus  │   │ Webhooks│
│ Layer   │    │ (RabbitMQ)  │   │ Queue   │
└────┬────┘    └──────┬──────┘   └────┬────┘
     │                │               │
┌────▼──────────────────────────────────────┐
│         Microservices Layer               │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ POS  │ │Inv   │ │Fin   │ │CRM   │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ Auth │ │RBAC  │ │Audit │ │IA    │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
└────┬──────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────┐
│          Data & Cache Layer               │
│  ┌──────────────┐    ┌────────────────┐  │
│  │ PostgreSQL   │    │ Redis Cache    │  │
│  │ Multi-tenant │    │ (session, ops) │  │
│  └──────────────┘    └────────────────┘  │
│  ┌──────────────┐    ┌────────────────┐  │
│  │ Elasticsearch│    │ pgvector (AI)  │  │
│  │ (search)     │    │ (embeddings)    │  │
│  └──────────────┘    └────────────────┘  │
└──────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────┐
│      External Integrations & AI           │
│  DIAN │ Banks │ WhatsApp │ Claude API    │
└──────────────────────────────────────────┘
```

### 3.2 Patrones Arquitectónicos

**Layered Architecture + Microservices Hybrid**
- Separación clara: API Gateway → Services → Data
- Microservicios para escalabilidad (POS, Inventario, Finanzas)
- Monolith mesurado para core (Auth, RBAC, Audit)

**Event-Driven Communication**
- Services comunican vía event bus (RabbitMQ/EventBridge)
- Pub/sub para eventual consistency
- Webhooks para integraciones externas

**CQRS Selectivo**
- Escrituras: transaccional, fuerte consistencia
- Lecturas: proyecciones denormalizadas, eventual consistency

**Strangler Fig Pattern**
- Migración gradual de sistemas legacy
- Coexistencia temporal
- Zero downtime migration

### 3.3 Principios de Dependencias

```
Strict layering (lower layer nunca depende de upper):

Client → API Layer (no dependencies, stateless)
API → Service Layer (business logic)
Service → Data Layer (persistence)
Data → nothing

Cross-service: Via Event Bus solamente
No direct database access between services
No hardcoded service-to-service HTTP calls
```

---

## 4. ARQUITECTURA MULTI-TENANT ENTERPRISE

### 4.1 Modelo de Tenancy

**Shared Infrastructure, Isolated Data** (SaaS Estándar)

```sql
-- Tenant isolation principal
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    slug VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    plan VARCHAR(50), -- free, pro, enterprise
    created_at TIMESTAMP,
    is_active BOOLEAN,
    metadata JSONB
);

-- Row-level security via tenant_id
CREATE TABLE companies (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name VARCHAR(255),
    tax_id VARCHAR(50),
    country_code CHAR(2),
    UNIQUE(tenant_id, tax_id)
);

-- Todos los datos principales cargan tenant_id
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    amount DECIMAL,
    created_at TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_tenant_created (tenant_id, created_at)
);
```

### 4.2 Isolation Strategies

**Database Level**:
- Row-level security (RLS) en PostgreSQL
- Todas las queries: `WHERE tenant_id = current_user_tenant`
- Índices optimizados para (tenant_id, ...)

**Application Level**:
- Middleware valida tenant_id en cada request
- Context contains tenant info
- Service layer never trusts client tenant_id

**Network Level**:
- Cada tenant puede tener VPC/subnet dedicado (enterprise)
- WAF rules por tenant
- DDoS protection per-tenant

### 4.3 Tenant Isolation Compliance

```typescript
// Middleware que SIEMPRE ejecuta
export const tenantMiddleware = async (req, res, next) => {
    const token = extractToken(req);
    const decoded = verifyJWT(token);
    
    // Tenant ID del token es AUTHORITY
    req.tenantId = decoded.tenant_id;
    req.userId = decoded.sub;
    
    // NUNCA confiar en client-sent tenant_id
    const clientTenant = req.headers['x-tenant-id'];
    if (clientTenant && clientTenant !== req.tenantId) {
        return res.status(403).json({ error: 'Unauthorized tenant' });
    }
    
    next();
};

// Todos los queries:
async getCompanies(req) {
    return db.query(
        'SELECT * FROM companies WHERE tenant_id = $1',
        [req.tenantId] // SIEMPRE desde request
    );
}
```

### 4.4 Escalabilidad Multi-Tenant

**Sharding Strategy** (para 100K+ tenants):
```
Shard Key: tenant_id
Distribution: Consistent hash (tenant_id % num_shards)
Fallback: Read replicas, load balancing
```

**Connection Pooling**:
```
Pool size: 20 connections per service
Max idle: 30s
Timeout: 5s
Strategy: PgBouncer for connection multiplexing
```

**Data Replication**:
- PostgreSQL streaming replication
- Read replicas para analytics
- Cross-region para LATAM (us-east, sa-east)

---

## 5. EVENT-DRIVEN ARCHITECTURE

### 5.1 Event Bus Design

**Message Broker**: RabbitMQ (reliability) + EventBridge (cloud-native)

**Event Categories**:

```
Domain Events (business logic):
- TransactionCreated
- InventoryUpdated
- CustomerCreated
- InvoiceIssued
- PaymentProcessed

System Events (infrastructure):
- ServiceHealthCheck
- DatabaseMigrationCompleted
- SyncStarted

User Events (UI/UX):
- UserLoggedIn
- ReportGenerated
- ExportStarted
```

### 5.2 Event Publishing Pattern

```typescript
// Service publishes event
class TransactionService {
    async createTransaction(data) {
        const transaction = await db.transaction.create(data);
        
        // Publish event
        await eventBus.publish('transaction.created', {
            id: transaction.id,
            tenant_id: transaction.tenant_id,
            amount: transaction.amount,
            timestamp: new Date(),
            version: 1
        });
        
        return transaction;
    }
}

// Consumers subscribe
eventBus.subscribe('transaction.created', async (event) => {
    // Update inventory
    await inventoryService.decreaseStock(event);
    
    // Update analytics
    await analyticsService.recordTransaction(event);
    
    // Notify customer
    await notificationService.sendReceipt(event);
});
```

### 5.3 Guarantees y Failover

**Delivery Guarantees**:
- At-least-once (default)
- Dead letter queue para failures
- Exponential backoff (1s, 2s, 4s, 8s, max 1h)
- Manual replay capability

**Event Sourcing** (selective):
- Core transactional events (transactions, invoices) sourced
- Audit trail inmutable
- Time-travel debugging posible

**Idempotency Keys**:
```
Cada event tiene unique idempotency_key
Consumers track processed_events
Retry safe: mismo evento → idempotent operation
```

---

## 6. SISTEMA DE IA NATIVO

### 6.1 Arquitectura IA

**Principio**: IA no es feature, es parte de la plataforma

```
┌─────────────────────────────────┐
│   User Context & Intent         │
│   (current screen, history)     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│   Input Processing              │
│   - OCR (invoices)              │
│   - Speech-to-text (POS)        │
│   - Natural language (search)   │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│   Intent Understanding          │
│   - Embedding (pgvector)        │
│   - Semantic search             │
│   - Action classification       │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│   Copilot / Agent               │
│   - Claude API (reasoning)      │
│   - Function calling (actions)  │
│   - RAG (context retrieval)     │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│   Action Execution              │
│   - Create invoice              │
│   - Adjust inventory            │
│   - Generate report             │
│   - Send message                │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│   Result Presentation           │
│   - Natural language summary    │
│   - Data visualization          │
│   - Next steps suggestion       │
└─────────────────────────────────┘
```

### 6.2 IA Modules por Contexto

**Copilotos Contextuales**:

| Módulo | Copiloto | Capacidades |
|--------|----------|------------|
| POS | ARIA Sales | Sugerencias producto, upsell, customer insights |
| Inventario | ARIA Stock | Predicción demand, reorden automática, alertas |
| Finanzas | ARIA Books | Reconciliación automática, análisis gastos, forecasting |
| Cobranza | ARIA Collect | Análisis crediticio, estrategia cobranza, WhatsApp automático |
| CRM | ARIA Engage | Lead scoring, next action, email draft |
| Nómina | ARIA HR | Validación datos, cálculos automáticos, compliance |

### 6.3 RAG (Retrieval-Augmented Generation)

```
Sistema de memoria contextual:

1. Embedding de documentos/datos:
   - Historical transactions
   - Customer profiles
   - Inventory data
   - Regulations DIAN

2. Vector store (pgvector):
   - Embedding dimension: 1536 (OpenAI)
   - Indexing: IVFFlat for fast search
   - Reranking: Semantic relevance

3. Prompt engineering:
   - System prompt contextualizado por tenant
   - Few-shot examples de operación real
   - Constraints (compliance, security)

4. Function calling:
   - Claude tools para ejecutar acciones
   - Schema validation
   - Permission checks
```

### 6.4 Automation Workflows

**Proceso**: Trigger → Condition → Action → Notification

```typescript
// Ejemplo: Auto-reorder cuando stock bajo
const automationEngine = {
    trigger: 'inventory.level_changed',
    condition: (stock) => stock.quantity < stock.reorder_point,
    action: async (product) => {
        const purchaseOrder = await purchasingService.createPO({
            items: [{ product_id: product.id, quantity: product.reorder_qty }],
            auto_generated: true
        });
        
        return purchaseOrder;
    },
    notification: (po) => 
        notificationService.send(po.supplier_id, {
            type: 'new_purchase_order',
            data: po
        })
};
```

---

## 7. DESIGN SYSTEM Y LENGUAJE VISUAL

### 7.1 Componentes Core

**Atoms** (primitivos):
- Button (variant: primary, secondary, ghost, danger)
- Input (text, number, email, password, search)
- Select (dropdown, multi-select, combobox)
- Checkbox / Radio
- Toggle
- Badge (color, size, removable)

**Molecules** (combinaciones):
- Form Field (label + input + error)
- Card (header, body, footer, actions)
- Alert (info, success, warning, error)
- Modal (header, body, footer, close)
- Breadcrumb
- Tab navigation
- Pagination

**Organisms** (complejas):
- Data Table (sorting, filtering, pagination, inline edit)
- Form (multi-step, conditional fields, validation)
- Navigation Bar (logo, menu, user account)
- Sidebar (collapsible, contextual)
- Dashboard Grid (responsive, drag-able)
- Command Palette (Cmd+K)

### 7.2 Componentes Especializados

**Data Display**:
- Timeline (eventos, auditoría)
- Graph/Chart (revenue, inventory, metrics)
- Sparkline (trends en card)
- Map (geolocalización sucursales)

**Interactive**:
- Slider (date range, amounts)
- Date Picker (inline, range)
- Time Picker (agenda)
- Color Picker (configuración)
- Code Editor (formulas, scripts)

**Feedback**:
- Toast (transient notifications)
- Snackbar (persistent info)
- Dialog (confirm actions)
- Skeleton (loading state)
- Empty State (no data)
- Error Boundary (graceful failures)

### 7.3 Pattern Library

```
/components
├── /atoms
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Badge.tsx
│   └── ...
├── /molecules
│   ├── FormField.tsx
│   ├── Card.tsx
│   ├── Alert.tsx
│   ├── Modal.tsx
│   └── ...
├── /organisms
│   ├── DataTable.tsx
│   ├── Form.tsx
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   └── ...
└── /templates
    ├── DashboardLayout.tsx
    ├── FormLayout.tsx
    └── ...
```

### 7.4 Design Tokens

```typescript
export const tokens = {
    colors: {
        primary: '#3B82F6',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        gray: ['#F9FAFB', '#F3F4F6', '#E5E7EB', ...]
    },
    spacing: {
        xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px'
    },
    typography: {
        h1: { font: 'Geist', size: '32px', weight: 700 },
        body: { font: 'Inter', size: '14px', weight: 400 },
        ...
    },
    shadow: {
        sm: '0 1px 2px rgba(0,0,0,0.05)',
        md: '0 4px 6px rgba(0,0,0,0.1)',
        lg: '0 10px 15px rgba(0,0,0,0.1)'
    },
    radius: {
        sm: '2px', md: '6px', lg: '8px'
    }
};
```

---

## 8. PRINCIPIOS DE UX

### 8.1 Core UX Principles

**1. Discoverability**
- Features visibles, no ocultos
- Onboarding guiado
- Contextual help
- Search-first navigation

**2. Efficiency**
- Keyboard shortcuts (Cmd+K for search)
- Bulk actions
- Templates y presets
- Autocomplete y suggestions

**3. Error Prevention**
- Confirmations para acciones destructivas
- Validación en-tiempo-real
- Restrictions inteligentes (grayed out si no aplica)
- Undo/Redo when possible

**4. Feedback**
- Immediate visual feedback
- Loading states claros
- Success confirmation
- Error messages específicos

**5. Consistency**
- Mismo behavior en similar contexts
- Nomenclatura uniforme
- Shortcuts consistentes
- Visual patterns repeatable

### 8.2 User Research Insights

**POS Cashier Behavior**:
- Speed-first mentality
- 80% mobile/tablet usage
- Muscle memory critical
- Stress during peak hours
→ Minimal clicks, offline-capable, big touch targets

**Manager/Admin Usage**:
- Data-driven decisions
- Report generation primary
- Multi-location oversight
- Mobile for quick checks
→ Dashboard customizable, filters powerful, mobile second screen

**Accountant/Admin**:
- Accuracy obsessed
- Regulatory compliance critical
- Audit trail essential
- Batch operations frequent
→ Transaction visibility, export formats, compliance checks

### 8.3 Interaction Patterns

**Search-Centric Navigation**
```
Cmd+K opens command palette
→ Search products: "t-shirt blue m"
→ Create invoice: "new invoice customer"
→ View reports: "report revenue 2024"
```

**Contextual Actions**
```
On transaction detail:
- Pin to dashboard
- Duplicate
- Export
- Refund (if applicable)
- Details (history, related)

Availability basada en estado y permisos
```

**Progressive Disclosure**
```
Simple view: Essentials only
Expand → Advanced options
Settings → Granular controls

Never overwhelming, always progressive
```

**Undo/History**
```
Cmd+Z undoes action
Cmd+Shift+Z redo
Timeline sidebar shows recent changes
Click to restore previous state
```

---

## 9. ESTRATEGIA MOBILE-FIRST

### 9.1 Philosophy

**NOT** responsive web design bolted onto mobile
**YES** native-feeling mobile experience, enhanced on desktop

**Key Principle**: Thumbs-up interaction design
- 44x44px minimum tap targets
- Bottom navigation for thumb reach
- Vertical scrolling primary
- Minimal gestures (swipe, long-press)

### 9.2 Mobile Navigation

```
┌─────────────────────────────┐
│  Status bar (time, signal)  │
├─────────────────────────────┤
│  Screen Content             │
│  (scrollable)               │
│                             │
│                             │
├─────────────────────────────┤
│ Home  │ Inv  │ Trans │ More │  (Bottom nav)
└─────────────────────────────┘
```

**Bottom Tab Navigation**:
1. Home (Dashboard, quick actions)
2. Inventory (Stock, movements)
3. Transactions (Sales, purchases)
4. More (CRM, Settings, Admin)

### 9.3 Mobile-Specific Features

**Swipe Actions**:
```
Swipe left on transaction → Delete/Archive options
Swipe right → Pin, Star, Mark as favorite
Long press → Multi-select
```

**Offline-First Behavior**:
```
Available offline:
- Recent transactions (cached)
- Product catalog
- Customer list
- POS operations (saved locally)

Sync on connection:
- Upload local changes
- Download updates
- Resolve conflicts
- Alert user of failures
```

**Camera Integration**:
```
Invoice capture: Photo → OCR → Extract data
Barcode scanning: Built-in scanner
Customer photo: Profile picture, ID verification
Signature capture: Digital signature for delivery
```

### 9.4 Responsive Breakpoints

```
Mobile: < 640px (default design target)
Tablet: 640px - 1024px (landscape, split-view)
Desktop: > 1024px (full UI enhancement)

Breakpoints (Tailwind):
sm: 640px, md: 768px, lg: 1024px, xl: 1280px
```

---

## 10. ARQUITECTURA OFFLINE-FIRST

### 10.1 Sync Engine

**Core Concept**: Local database truth source, cloud as backup

```
┌──────────────────────────────────┐
│  Local SQLite Database           │
│  - Full replica of user data     │
│  - Complete app functionality    │
│  - Independent of connectivity   │
└─────────────┬────────────────────┘
              │
       ┌──────▼──────┐
       │  Queue      │
       │  (local)    │
       └──────┬──────┘
              │
    ┌─────────▼──────────┐
    │  Network Monitor   │
    │  Online? → Sync    │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────┐
    │  Cloud API         │
    │  (PostgreSQL)      │
    └────────────────────┘
```

### 10.2 Conflict Resolution

**Last-Write-Wins** (standard):
```
Local change: timestamp_client = 2026-05-14 10:30:00
Cloud change: timestamp_server = 2026-05-14 10:31:00
→ Server wins (client change discarded)
```

**Custom Merge Logic** (for specific entities):
```
Inventory quantity:
  Local: 100 → 95 (sold 5)
  Server: 100 → 110 (received 10)
  Merge: 110 → 105 (both applied)

Customer notes:
  Local: "Note A"
  Server: "Note B"
  Merge: "Note A\nNote B" (concatenated)
```

**Conflict Detection**:
```typescript
interface SyncConflict {
  entity_id: string;
  field: string;
  local_value: any;
  remote_value: any;
  resolved_at: timestamp;
  resolution: 'local' | 'remote' | 'custom';
}

// User resolution UI:
// "You changed X to Y, but server has Z"
// [ Keep mine ] [ Accept server ] [ Custom merge ]
```

### 10.3 Sync Strategy

**Selective Sync**:
```
Download:
- All master data (products, customers, accounts)
- Last 30 days transactions
- User's assigned items

Upload:
- All local changes
- Priority: critical (inventory) > transactions > metadata
```

**Incremental Sync**:
```
Initial sync: Full download (compressed)
Ongoing: Only deltas (changed records since last sync)
Tracking: local_version, server_version fields
```

**Bandwidth Optimization**:
```
- Gzip compression
- Delta encoding (only changed fields)
- Selective field sync
- Batch operations (100 records per request)
```

---

## 11. SEGURIDAD ENTERPRISE

### 11.1 Authentication

**OAuth 2.0 + JWT**:
```
Flow:
1. User enters email/password
2. Server validates, issues JWT
3. Client stores JWT in secure storage (not localStorage)
4. Every request: Authorization: Bearer {token}
5. Server validates JWT signature

Token Structure:
{
  "sub": "user_id",
  "tenant_id": "tenant_uuid",
  "email": "user@company.com",
  "roles": ["admin", "manager"],
  "permissions": ["view_reports", "create_invoice"],
  "iat": 1716009000,
  "exp": 1716095400,
  "iss": "https://admia.io"
}

Refresh Token: Secure httpOnly cookie, 30 days
Access Token: 24 hours
```

**MFA** (Multi-Factor Authentication):
- TOTP (Authenticator app)
- SMS backup
- Biometric (mobile)
- Hardware keys (enterprise)

### 11.2 Authorization (RBAC + ABAC)

**Role-Based Access Control (RBAC)**:
```
Roles: Admin, Manager, Cashier, Accountant, Viewer

Role → Permissions mapping:
Admin: all permissions
Manager: view_reports, create_invoice, manage_users, manage_inventory
Cashier: create_transaction, view_products, process_payment
Accountant: view_reports, reconcile, manage_accounts
Viewer: read-only access
```

**Attribute-Based Access Control (ABAC)** (advanced):
```
Condition examples:
- Can view transaction if created_by == current_user OR role == admin
- Can edit invoice if status == draft AND created_within(24h)
- Can access branch if assigned_branches contains current_branch

Expression language:
if (resource.created_by == user.id || user.role == 'admin') 
  && timestamp.now() < resource.created_at + 24h 
then ALLOW else DENY
```

### 11.3 Data Protection

**Encryption**:
- In-transit: TLS 1.3 (all connections)
- At-rest: PostgreSQL native encryption, AES-256
- PII fields: Additional encryption layer (sensitive data: tax_id, phone, email)

**Data Retention**:
```
Transactions: 7 years (legal requirement)
User sessions: 30 days
Audit logs: 2 years
Backups: 30 days retention, cross-region
```

### 11.4 Compliance

**DIAN (Colombia)** - Electronic Invoice:
- Digital signature mandatory
- Timestamp from official source
- Encrypted transmission
- Audit trail immutable

**GDPR-like Compliance** (where applicable):
- Data export functionality
- Right to deletion
- Consent management
- Privacy policy clear

**Audit Logging**:
```
Every action logged:
- Who: user_id
- What: action (created, updated, deleted)
- When: timestamp (server-side)
- Where: resource_id, resource_type
- Why: reason (if applicable)
- How: client_ip, user_agent

Immutable: Append-only, cannot be deleted
Query: Full audit trail available to compliance team
```

---

## 12. ESCALABILIDAD Y PERFORMANCE

### 12.1 Performance Targets

| Métrica | Target | Medición |
|---------|--------|----------|
| API Response | <100ms p95 | Real requests |
| Page Load | <2s | First contentful paint |
| Search | <200ms | 100K records |
| Report Generation | <5s | Complex multi-tenant |
| Sync | <30s | 10K records |
| Database Query | <50ms | Complex joins |

### 12.2 Database Optimization

**Indexing Strategy**:
```sql
-- Tenant isolation + filtering
CREATE INDEX idx_transactions_tenant_created 
  ON transactions(tenant_id, created_at DESC);

-- Search
CREATE INDEX idx_customers_name_trgm 
  ON customers USING GIN(name gin_trgm_ops);

-- Range queries
CREATE INDEX idx_inventory_warehouse_qty 
  ON inventory(warehouse_id, quantity);

-- IA/Search
CREATE INDEX idx_customers_embedding 
  ON customers USING ivfflat(embedding vector_cosine_ops);
```

**Query Optimization**:
```typescript
// Bad: N+1 query problem
const invoices = await db.invoice.findMany({ where: { tenant_id } });
for (const invoice of invoices) {
    invoice.customer = await db.customer.findOne(invoice.customer_id);
}

// Good: Batch query
const invoices = await db.invoice.findMany({
    where: { tenant_id },
    include: { customer: true } // JOIN, single query
});
```

**Denormalization** (selective):
```
Instead of complex joins for reporting:
- Write aggregated tables (updated via event)
- Example: invoice_summary (total, tax, discount, status)
- Updated in real-time via event handlers
- Queries instant, but need extra storage
```

### 12.3 Caching Strategy

**Redis Layers**:
```
Level 1: Query result cache (5 min TTL)
  Key: "query:{hash}"
  Example: "query:products:tenant_abc:page_1"

Level 2: Object cache (15 min TTL)
  Key: "obj:{entity}:{id}"
  Example: "obj:customer:cust_123"

Level 3: Session cache (24 hours)
  Key: "session:{token}"
  Contains: user_id, tenant_id, permissions

Cache invalidation on write:
  - Update entity → invalidate obj:{entity}:{id}
  - Entity change → invalidate related queries
  - Pattern: On create/update, clear cache for that resource
```

**CDN for Static** (Cloudflare):
```
Cache Headers:
- JS/CSS: 1 year (content-hash based)
- Images: 1 month
- HTML: 5 minutes (always revalidate)
```

### 12.4 Load Testing

**Expected Capacity**:
```
Per 1 service pod:
- 1000 requests/sec sustained
- 5000 requests/sec burst
- Scaling: Horizontal via Kubernetes

Database:
- 500K queries/sec (optimized)
- 10K connections (with pooling)
- Multi-replica for reads
```

---

## 13. INFRAESTRUCTURA CLOUD

### 13.1 AWS Stack

```
┌─────────────────────────────────────┐
│  Cloudflare (CDN + DDoS)            │
├─────────────────────────────────────┤
│  AWS ALB (load balancer)            │
├─────────────────────────────────────┤
│  ECS Fargate (containerized services)
│  ├─ API Gateway service
│  ├─ POS service
│  ├─ Inventory service
│  ├─ Finance service
│  ├─ IA service
│  └─ Worker service (async jobs)
├─────────────────────────────────────┤
│  RDS PostgreSQL (Multi-AZ)          │
│  ├─ Primary (us-east-1)
│  └─ Replica (us-west-2)
├─────────────────────────────────────┤
│  ElastiCache Redis (Multi-AZ)       │
│  ├─ Session store
│  └─ Cache layer
├─────────────────────────────────────┤
│  S3 + CloudFront                    │
│  ├─ Static assets
│  ├─ Invoice PDFs
│  └─ Backups
├─────────────────────────────────────┤
│  SQS / SNS (messaging)              │
│  ├─ Event bus
│  └─ Notifications
├─────────────────────────────────────┤
│  Elasticsearch (OpenSearch)         │
│  └─ Full-text search
├─────────────────────────────────────┤
│  Bedrock / SageMaker (ML)           │
│  └─ Claude API integration
└─────────────────────────────────────┘
```

### 13.2 Container Strategy

**Docker Image Structure**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

**Multi-stage Build**:
```dockerfile
# Stage 1: Builder
FROM node:20 as builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

### 13.3 Infrastructure as Code

**Terraform Structure**:
```hcl
# main.tf
module "vpc" {
  source = "./modules/vpc"
  cidr_block = var.vpc_cidr
  availability_zones = var.azs
}

module "database" {
  source = "./modules/rds"
  subnet_ids = module.vpc.private_subnets
  engine = "postgres"
  instance_class = "db.r6i.xlarge"
  multi_az = true
}

module "ecs_cluster" {
  source = "./modules/ecs"
  cluster_name = var.cluster_name
  vpc_id = module.vpc.vpc_id
}

# Auto-scaling groups
resource "aws_autoscaling_group" "api_service" {
  min_size = 3
  max_size = 20
  target_group_arns = [aws_lb_target_group.api.arn]
  health_check_type = "ELB"
  health_check_grace_period = 300
}
```

---

## 14. DEVOPS Y CI/CD

### 14.1 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t admia:${{ github.sha }} .
      
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker push $ECR_REGISTRY/admia:${{ github.sha }}
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster admia-prod \
            --service api-service \
            --force-new-deployment
```

### 14.2 Deployment Strategy

**Blue-Green Deployment**:
```
Current (Blue):   Running production version
New (Green):      New version deployed, tested
Switch:           Load balancer routes to Green
Rollback:         Instant switch back to Blue if issues
```

**Canary Deployment** (for high-risk):
```
Route 5% traffic → New version
Monitor: Error rate, latency, business metrics
After 1h success: Route 10%, 50%, 100%
```

**Feature Flags**:
```typescript
// Enable features without deployment
const isNewDashboard = featureFlags.isEnabled('new_dashboard', {
    user_id: currentUser.id,
    rollout_percentage: 20 // 20% of users
});

if (isNewDashboard) {
    return <NewDashboard />;
} else {
    return <OldDashboard />;
}
```

### 14.3 Rollback Procedure

```
1. Alert: Error rate spike detected
2. Assess: Check CloudWatch metrics
3. Decision: Rollback vs. investigate
4. Execute: 
   aws ecs update-service \
     --cluster admia-prod \
     --service api-service \
     --force-new-deployment \
     --image admia:previous_sha
5. Verify: Health checks pass, traffic normal
6. Post-mortem: Analyze root cause
```

---

## 15. OBSERVABILIDAD

### 15.1 Logging Strategy

**Structured Logging**:
```json
{
  "timestamp": "2026-05-14T10:30:45.123Z",
  "level": "INFO",
  "service": "invoice-service",
  "trace_id": "abc123def456",
  "tenant_id": "tenant_xyz",
  "user_id": "user_123",
  "action": "create_invoice",
  "duration_ms": 245,
  "status": "success",
  "metadata": {
    "invoice_id": "inv_123",
    "amount": 15000,
    "customer_id": "cust_456"
  }
}
```

**Log Levels**:
- DEBUG: Detailed execution flow
- INFO: Business events (user actions, transactions)
- WARN: Recoverable issues (retries, slow queries)
- ERROR: Failures (failed transaction, database error)
- FATAL: System down (crash, cannot recover)

**Log Storage** (ELK Stack):
```
Elasticsearch: Indexed storage, fast search
Kibana: Visualization, dashboards
Logstash: Processing, enrichment
Retention: 30 days hot, 1 year cold storage
```

### 15.2 Metrics

**Key Metrics Dashboard**:
```
Application:
- Requests per second
- Error rate (4xx, 5xx)
- P50, P95, P99 latency
- Database query time

Business:
- Transactions per hour
- Revenue (hourly/daily)
- Active users
- Feature adoption

Infrastructure:
- CPU utilization
- Memory usage
- Disk I/O
- Network bandwidth
```

**Instrumentation**:
```typescript
import { metrics } from '@opentelemetry/api';

// Counter
const transactionCounter = metrics
  .getMeter('invoice-service')
  .createCounter('invoices_created_total', { description: 'Total invoices' });
transactionCounter.add(1, { tenant_id, status: 'success' });

// Histogram (latency)
const queryHistogram = metrics
  .getMeter('database')
  .createHistogram('query_duration_ms', { description: 'Query latency' });
queryHistogram.record(duration, { query_type: 'select' });
```

### 15.3 Alerting

**Alert Rules**:
```yaml
- name: HighErrorRate
  threshold: error_rate > 5%
  duration: 5 minutes
  action: PagerDuty alert

- name: SlowApiResponse
  threshold: p95_latency > 500ms
  duration: 10 minutes
  action: Slack notification, investigate

- name: DatabaseDown
  threshold: connection_errors > 10
  duration: 1 minute
  action: Page on-call engineer immediately
```

---

## 16. POSTGRESQL SCHEMA STRATEGY

### 16.1 Core Tables Structure

```sql
-- Tenants (multi-tenancy root)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL, -- free, pro, enterprise
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    CHECK (plan IN ('free', 'pro', 'enterprise'))
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_stripe ON tenants(stripe_customer_id) WHERE is_active;

-- Users (multi-tenant users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL, -- admin, manager, cashier, accountant, viewer
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email),
    CHECK (role IN ('admin', 'manager', 'cashier', 'accountant', 'viewer'))
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- Companies/Businesses (multiple per tenant for enterprise)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_id VARCHAR(50) NOT NULL,
    country_code CHAR(2) NOT NULL, -- CO, MX, AR, etc.
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    legal_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, tax_id)
);

CREATE INDEX idx_companies_tenant ON companies(tenant_id);

-- Products (inventory master)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES product_categories(id),
    price DECIMAL(12, 2) NOT NULL,
    cost DECIMAL(12, 2),
    unit VARCHAR(20), -- kg, l, u, etc.
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}', -- images, variants, attributes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, company_id, sku)
);

CREATE INDEX idx_products_tenant_company ON products(tenant_id, company_id);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE is_active;
CREATE INDEX idx_products_category ON products(category_id);

-- Inventory (stock levels by warehouse)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    quantity BIGINT NOT NULL DEFAULT 0,
    reserved_quantity BIGINT NOT NULL DEFAULT 0, -- allocated for orders
    reorder_point BIGINT DEFAULT 10,
    reorder_qty BIGINT DEFAULT 50,
    last_counted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, product_id, warehouse_id),
    CHECK (quantity >= 0 AND reserved_quantity >= 0)
);

CREATE INDEX idx_inventory_tenant_warehouse ON inventory(tenant_id, warehouse_id);
CREATE INDEX idx_inventory_quantity ON inventory(quantity) WHERE quantity < reorder_point;

-- Transactions (sales, purchases, adjustments)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id),
    type VARCHAR(50) NOT NULL, -- sale, purchase, adjustment, return, manual
    reference_number VARCHAR(100),
    date DATE NOT NULL,
    time TIME NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    status VARCHAR(50) NOT NULL DEFAULT 'completed', -- draft, pending, completed, cancelled
    total_amount DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (type IN ('sale', 'purchase', 'adjustment', 'return', 'manual')),
    CHECK (status IN ('draft', 'pending', 'completed', 'cancelled'))
);

CREATE INDEX idx_transactions_tenant_created ON transactions(tenant_id, created_at DESC);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status) WHERE status != 'completed';

-- Transaction Items (line items)
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(10, 4) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    tax_percent DECIMAL(5, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity > 0)
);

CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- individual, company
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    tax_id VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country CHAR(2),
    latitude DECIMAL(9, 6),
    longitude DECIMAL(9, 6),
    credit_limit DECIMAL(12, 2),
    payment_terms VARCHAR(50),
    notes TEXT,
    embedding vector(1536), -- AI semantic search
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, tax_id) WHERE tax_id IS NOT NULL
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_name_trgm ON customers USING GIN(name gin_trgm_ops);
CREATE INDEX idx_customers_embedding ON customers USING ivfflat(embedding vector_cosine_ops);

-- Invoices (formal documents)
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    transaction_id UUID REFERENCES transactions(id),
    status VARCHAR(50) NOT NULL, -- draft, sent, viewed, partial_paid, paid, overdue, cancelled
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'COP',
    dian_resolution VARCHAR(100), -- DIAN electronic invoice data
    dian_number VARCHAR(100),
    dian_status VARCHAR(50), -- pending, sent, accepted, rejected
    dian_sent_at TIMESTAMP,
    dian_uuid VARCHAR(36),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('draft', 'sent', 'viewed', 'partial_paid', 'paid', 'overdue', 'cancelled'))
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status) WHERE status IN ('sent', 'viewed', 'partial_paid', 'overdue');
CREATE INDEX idx_invoices_dian_status ON invoices(dian_status) WHERE dian_status IS NOT NULL;

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- cash, card, bank_transfer, check, other
    reference VARCHAR(100),
    notes TEXT,
    received_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other'))
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_received_at ON payments(received_at DESC);

-- Audit Log (immutable)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    changes JSONB, -- before/after values
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- RLS Policies (Row-Level Security)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_transactions ON transactions
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

### 16.2 Migration Strategy

```
Flyway/Liquibase for versioning:

V001__create_tenants.sql
V002__create_users.sql
V003__create_companies.sql
V004__create_products.sql
V005__create_inventory.sql
V006__create_transactions.sql
...

Backward compatible:
- Add column with default
- Rename via new column (keep old temporarily)
- Drop deprecated after grace period

Test migrations:
- Run on staging first
- Verify rollback works
- Check performance impact
```

---

## 17. API ARCHITECTURE

### 17.1 REST API Principles

**Resource-Oriented Design**:
```
GET    /api/v1/tenants/{tenantId}/transactions
POST   /api/v1/tenants/{tenantId}/transactions
GET    /api/v1/tenants/{tenantId}/transactions/{id}
PATCH  /api/v1/tenants/{tenantId}/transactions/{id}
DELETE /api/v1/tenants/{tenantId}/transactions/{id}
```

**Versioning**: URL-based (v1, v2, v3)
- Ensures backward compatibility
- Deprecation policy: 2 versions supported simultaneously

**Pagination**:
```json
GET /api/v1/transactions?limit=20&offset=40

Response:
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 1250,
    "has_more": true
  }
}
```

**Filtering**:
```
GET /api/v1/transactions?status=completed&date_from=2026-01-01&date_to=2026-05-31
GET /api/v1/customers?name__icontains=john&is_active=true
```

**Sorting**:
```
GET /api/v1/transactions?sort=-created_at,amount
// Sort by created_at DESC, then amount ASC
```

### 17.2 API Response Format

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "id": "txn_123",
    "amount": 50000,
    "status": "completed"
  },
  "meta": {
    "timestamp": "2026-05-14T10:30:45Z",
    "version": "1.0"
  }
}
```

**Error (4xx/5xx)**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Not enough stock for product SKU-123",
    "status": 400,
    "details": {
      "product_id": "prod_123",
      "requested": 100,
      "available": 45
    },
    "request_id": "req_abc123"
  }
}
```

### 17.3 Authentication

**Header-Based Bearer Token**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Validation:
1. Extract token from header
2. Verify JWT signature
3. Check expiration
4. Extract tenant_id, user_id, permissions
5. Proceed with request context
```

**Scopes**:
```
read:transactions    → GET transactions
write:transactions   → POST/PATCH transactions
delete:transactions  → DELETE transactions
read:reports         → Access reports
admin:users          → Manage users
```

### 17.4 Rate Limiting

```
Global: 10,000 requests/hour per API key
Per endpoint:
  - GET: 100 req/min (reading)
  - POST/PATCH: 10 req/min (mutations)
  - DELETE: 1 req/min (destructive)

Headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1715698245
```

---

## 18. MÓDULOS DETALLADOS (25)

### Módulo 1: POS Inteligente

**Objetivo Negocio**: Punto de venta moderno, rápido, offline-capable, con inteligencia contextual

**Core UX**:
```
┌──────────────────────────────┐
│ SEARCH PRODUCTS              │ ← Cmd+S focus
│ search: "coca cola"          │
├──────────────────────────────┤
│ [Coca 250ml - $1.5]          │
│ [Coca 500ml - $2.0]          │
│ [Coca 1.5L - $4.0] ← Selected
├──────────────────────────────┤
│ CART                         │
│ Coca 1.5L x 5 = $20          │
│ Snack Mix x 2 = $6           │
├──────────────────────────────┤
│ Subtotal: $26                │
│ Tax (8%): $2.08              │
│ TOTAL: $28.08                │
├──────────────────────────────┤
│ [CASH] [CARD] [WALLET]       │ ← Payment methods
└──────────────────────────────┘
```

**User Flows**:
1. Product Search → Add to Cart → Payment → Complete
2. Barcode Scan → Auto add → Payment
3. Customer Lookup → Loyalty Apply → Payment → Receipt

**Inteligencia IA**:
- Smart search (typo-tolerant, semantic)
- Upsell suggestions (customers often buy Y with X)
- Bundle recommendations
- Payment method prediction
- Suspicious transaction detection

**Offline Support**:
- Cached product catalog
- Local cart
- Queue transactions
- Sync when online

**Módulo Completo**:
- Componentes React: ProductSearch, Cart, PaymentMethods, Receipt
- APIs: POST /transactions, POST /payment-methods, GET /products/search
- Database: transactions, transaction_items, payment_methods
- Eventos: transaction.created, payment.processed
- Mobile: Full POS experience on phone/tablet

---

### Módulo 2: Facturación Electrónica DIAN

**Objetivo Negocio**: Cumplimiento DIAN, generación automática de facturas, validación y envío

**UX Principal**:
```
Invoice Draft → Review → Sign → Send to DIAN → Confirm
```

**Requerimientos DIAN**:
- Firma digital (digital signature)
- Timestamp servidor de tiempo
- Validación estructura XML
- Envío certificado a DIAN
- Recepción y confirmación

**Automatización IA**:
- Auto-generación desde transacciones
- Validación automática antes de envío
- Detección de errores comunes
- Sugerencias de corrección

**Módulo Completo**:
- Documento: Invoice + DIAN requirements
- APIs: POST /invoices, POST /invoices/{id}/send-dian, GET /invoices/{id}
- Database: invoices, dian_submissions, audit_logs
- Eventos: invoice.created, invoice.sent_to_dian, dian.response_received
- Integraciones: DIAN API, Digital signature provider

---

### Módulo 3: Inventario Avanzado

**Objetivo**: Control stock multi-bodega, predicción demand, optimización

**Core UX**:
```
Inventory Dashboard:
- Current stock by warehouse
- Low stock alerts
- Movement history
- Reorder recommendations

Warehouse view:
- Physical items by location
- Transfer between warehouses
- Cycle counting
- Adjustments
```

**Requerimientos**:
- Multi-warehouse management
- Stock movements tracking
- Cycle counting workflow
- Automatic reordering
- Inventory valuation (FIFO, weighted average)

**IA Features**:
- Demand forecasting (based on historical sales)
- Optimal reorder point calculation
- Seasonal adjustment
- Supplier reliability prediction

**Módulo Completo**:
- UX: Inventory Dashboard, Warehouse View, Movement History
- APIs: GET /inventory, POST /inventory/adjust, POST /inventory/transfer
- Database: inventory, inventory_movements, stock_valuation
- Eventos: inventory.adjusted, stock.low_alert, reorder.suggested
- Integraciones: Supplier APIs para reorden automática

---

### Módulo 4: CRM (Customer Relationship Management)

**Objetivo**: 360° customer view, interaction history, engagement

**Unified Customer Profile**:
```
Customer: Juan García
├─ Contact: juan@email.com, +57 312 123 4567
├─ Address: Cra 7 #45-20, Bogotá
├─ Purchase History: $45,000 lifetime value
├─ Last interaction: 3 days ago
├─ Interaction Timeline:
│  ├─ Sale: $1,200 (May 10)
│  ├─ Support: Delivery issue (May 8)
│  ├─ Call: Sales follow-up (May 5)
│  └─ Email: Newsletter (May 1)
└─ Next Actions: Follow up for upsell
```

**Módulo Completo**:
- APIs: GET /customers, POST /customers, GET /customers/{id}/interactions
- Database: customers, customer_interactions, customer_notes
- Eventos: customer.created, interaction.logged
- Features: Interaction timeline, notes, tags, segmentation
- IA: Engagement scoring, churn prediction, next-best-action

---

### Módulo 5-25: Otros Módulos

*(Estructura similar para cada uno)*

**5. Finanzas**: Accounting ledger, trial balance, financial statements, reconciliation
**6. RRHH**: Employee management, documents, permissions, org chart
**7. Nómina**: Payroll calculation, electronic payroll (NeQui), deductions, reports
**8. Agenda y Reservas**: Appointment booking, calendar, resource allocation
**9. Marketplace**: Vendor management, commission tracking, multi-seller
**10. Ecommerce**: Online store, shopping cart, order management
**11. Analytics**: Custom dashboards, preset reports, data export
**12. AI Assistant**: ARIA copilot, context-aware suggestions
**13. Workflow Automation**: No-code automation, triggers, actions
**14. Multi-sucursal**: Branch management, consolidated reporting
**15. Compras**: Purchase orders, supplier management, approval workflows
**16. Proveedores**: Supplier directory, performance metrics, communication
**17. Fidelización**: Loyalty programs, rewards, customer engagement
**18. Delivery**: Route optimization, tracking, driver management
**19. Kitchen Display System**: Order queue, preparation status, timing
**20. Gestión Documental**: Document storage, search, compliance
**21. BI Dashboards**: Advanced analytics, data modeling, visualizations
**22. Sistema de Permisos**: RBAC, ABAC, permission management
**23. Comunicaciones**: Email, SMS, WhatsApp, push notifications
**24. Mobile App**: Native mobile experience, offline-first
**25. Administración Global**: Billing, subscription, settings, security

---

## 19. ROADMAP DE DESARROLLO

### Fase 0: Fundación (Meses 1-2)

**Semana 1-4**:
- [ ] Setup infraestructura (AWS, Docker, Terraform)
- [ ] Design system definido (Figma)
- [ ] Auth service (JWT, MFA)
- [ ] Database schema v1
- [ ] API Gateway

**Semana 5-8**:
- [ ] Core frontend (Next.js, layout base)
- [ ] Component library (50+ componentes)
- [ ] Tenant management
- [ ] User management & RBAC

**Entregable**: Infrastructure listo, auth completo, frontend base

### Fase 1: MVP (Meses 3-5)

**Meses 3**:
- [ ] POS módulo (search, cart, payment)
- [ ] Transaction service
- [ ] Basic inventory

**Mes 4**:
- [ ] Invoice module (creation, PDF)
- [ ] DIAN integration
- [ ] Customer module (basic)

**Mes 5**:
- [ ] Analytics dashboard
- [ ] Report generation
- [ ] Offline-first sync
- [ ] Mobile app (POS)

**Entregable**: MVP funcional (POS + Invoicing), 3-5 clientes beta

### Fase 2: Core Modules (Meses 6-8)

- [ ] Inventory advanced (multi-warehouse, valuation)
- [ ] Finanzas (ledger, reconciliation)
- [ ] RRHH (employees, org chart)
- [ ] CRM (customer 360, interactions)
- [ ] Nómina (payroll calculation)
- [ ] Multi-sucursal support

**Entregable**: 6-8 módulos core, 50+ customers

### Fase 3: IA & Automation (Meses 9-11)

- [ ] ARIA copilot v1
- [ ] Workflow automation engine
- [ ] AI agents (cobranza, reorden, etc.)
- [ ] Advanced analytics
- [ ] Marketplace features

**Entregable**: IA integrated, automation workflows, 200+ customers

### Fase 4: Expansion (Meses 12+)

- [ ] Kitchen display system (restaurantes)
- [ ] Ecommerce module
- [ ] Advanced marketplace
- [ ] Regional expansion (México, Argentina)
- [ ] Ecosystem partners

**Entregable**: $2.5M ARR, market leadership LATAM

---

## 20. SPRINT PLANNING

### Weekly Sprint Structure

**Monday**:
- Sprint planning (2h)
- Backlog refinement
- Assign tasks

**Tuesday-Thursday**:
- Development
- Code reviews
- Testing
- Daily standups (15 min)

**Friday**:
- QA testing
- Bug fixes
- Sprint retrospective
- Demo to stakeholders

### Task Definition Template

```
Title: Implement POS search with typo tolerance

Description:
As a cashier, I want to search products with typo tolerance
so that I can find items quickly even with misspellings

Acceptance Criteria:
- [ ] Search field focuses on Cmd+S
- [ ] Typo tolerance (Levenshtein distance)
- [ ] Results show in <200ms
- [ ] Mobile compatible

Technical Details:
- Use PostgreSQL trigram search
- Implement debounce (300ms)
- Cache popular searches (Redis)
- Write tests (E2E + unit)

Points: 5
Priority: High
Sprint: Sprint 5
```

---

## 21. RIESGOS TÉCNICOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|--------|-----------|
| DIAN API changes | Medium | High | Abstraction layer, monitoring |
| Database scalability | Medium | High | Sharding plan, load testing |
| Offline sync conflicts | High | Medium | Comprehensive conflict resolution |
| IA hallucinations | Medium | High | Human review, guardrails, testing |
| Payment failures | Low | High | Retry logic, monitoring, fallback |
| Cross-tenant data leak | Low | Critical | RLS enforcement, audits, testing |
| Mobile offline data loss | Medium | High | Backup strategy, encryption |

---

## 22. ESTRATEGIA DE TESTING

### Unit Testing

```
Target: 80% code coverage
Framework: Jest + React Testing Library

Example:
test('should calculate invoice tax correctly', () => {
  const invoice = createInvoice({ subtotal: 1000, tax_rate: 0.08 });
  expect(invoice.tax_amount).toBe(80);
  expect(invoice.total).toBe(1080);
});
```

### Integration Testing

```
Target: All critical flows
Framework: Cypress, Playwright

Example flow:
1. Create transaction
2. Verify inventory decreased
3. Generate invoice
4. Send to DIAN
5. Record payment
6. Verify ledger balance
```

### Performance Testing

```
Target: Meet performance SLAs
Tool: K6, JMeter

Test scenarios:
- 1000 concurrent users
- Complex report generation
- Bulk transaction import
- Sync 100K records
```

### Security Testing

```
Target: OWASP Top 10 compliance
- SQL injection tests
- XSS prevention
- CSRF protection
- Authentication bypass
- Authorization bypass
```

---

## 23. ESTRATEGIA DE DEPLOYMENT

### Release Cycle

```
Weekly releases on Monday 10:00 AM UTC
- Staging deploy: Friday 5 PM
- QA testing: Friday 6-9 PM
- Production deploy: Monday 10 AM
- Monitoring: 24h post-release
```

### Deployment Procedure

```
1. Code merge to main
2. CI/CD pipeline runs
   - Unit tests
   - Integration tests
   - Security scan
   - Build docker image
3. Deploy to staging
4. QA sign-off
5. Deploy to production (canary 5%)
6. Monitor metrics (error rate, latency)
7. If green: Increase to 100%
8. If red: Rollback automatically
```

### Rollback SLA

```
Automatic rollback if:
- Error rate > 5% for 5 min
- Latency p95 > 500ms for 10 min
- Database connection errors > 10 in 1 min

Manual rollback:
- On-call engineer decision
- Executed within 2 minutes
- Full transparency to customers
```

---

## 24. ESTRATEGIA DE CRECIMIENTO

### Marketing Motion

```
Phase 1: Land (MVP)
- Product Hunt launch
- LATAM tech communities
- LinkedIn outreach
- Partner integrations

Phase 2: Expand (Modules)
- Case studies (5 paying customers)
- SEO (POS, invoicing, inventory)
- Paid ads (Latin America geo)
- Marketplace partners

Phase 3: Scale (Market Leader)
- Enterprise sales team
- Regional offices
- Localization (ES, PT, FR)
- Strategic partnerships
```

### Unit Economics

```
CAC (Customer Acquisition Cost): $500
LTV (Lifetime Value): $15,000 (3-year avg)
LTV/CAC Ratio: 30:1 (healthy)
Payback Period: 2 months
Churn Rate Target: <3% monthly
```

---

## 25. ESTÁNDARES DE CALIDAD ABSOLUTOS

### Code Quality

```
Requirements:
- Linter passing (ESLint + Prettier)
- TypeScript strict mode
- No console.logs in production
- No commented code
- Naming clarity (no abbreviations)
- Max function length: 50 lines
- Max cyclomatic complexity: 5

Enforced via:
- Pre-commit hooks
- CI/CD gates
- Code review rules
```

### Documentation

```
Requirements:
- API endpoints documented (OpenAPI/Swagger)
- Database schema documented
- Architecture decisions documented
- README in every module
- Code comments only for WHY, not WHAT

Enforced via:
- PR templates
- Markdown linting
- Auto-generated docs (from code)
```

### Performance Budgets

```
JavaScript:
- Core bundle: < 200KB gzip
- Per-route chunk: < 50KB gzip

Images:
- WebP format
- Responsive sizes (srcset)
- Lazy loading

Network:
- Prefetching critical routes
- Service worker caching
- CDN for all static

Database:
- Query execution < 50ms p95
- Connection pool efficiency
- Index coverage > 95%
```

### Security Checklist

```
Before release:
- [ ] No secrets in code
- [ ] Auth tests passing
- [ ] RBAC tests passing
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] CSRF tokens present
- [ ] Data encryption at-rest/in-transit
- [ ] Audit logs enabled
- [ ] Rate limiting active
- [ ] Security headers set
```

### User Experience Checklist

```
Before release:
- [ ] Mobile tested (iOS, Android)
- [ ] Tablet tested
- [ ] Desktop tested
- [ ] Dark mode tested
- [ ] Accessibility (WCAG AAA)
- [ ] Keyboard navigation working
- [ ] Screen reader compatible
- [ ] Loading states present
- [ ] Error states helpful
- [ ] Empty states informative
- [ ] Loading time < 3s
- [ ] Mobile load time < 2s
```

---

## CONCLUSIÓN

ADMIA es más que software empresarial.

Es **un cambio de categoría**.

Una plataforma que convierte PyMEs LATAM en empresas del siglo XXI.

Cada decisión arquitectónica prioriza:
1. **Experiencia** (obsesión por detalles)
2. **Escalabilidad** (sin compromisos)
3. **Inteligencia** (IA integrada)
4. **Confiabilidad** (enterprise-grade)

El resultado es el software operativo que las PyMEs LATAM merecen.

No es Siigo mejorado.
No es Alegra con más features.
No es otro ERP disfrazado.

**Es la redefinición total del software empresarial.**

---

**Documento finalizado.**
**Pronto a construir.**

*Prepared for world-class execution*
*Built to dominate LATAM market*
*Designed to change how business operates*

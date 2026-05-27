# DOCUMENTO MAESTRO PARA IA IMPLEMENTADORA
## Kaivor / ADMIA v1.5 — Facturación Freemium + WooCommerce + IA Operativa Inicial

**Versión del documento:** 1.0  
**Uso:** Documento de contexto para subir a la carpeta del proyecto antes de dar prompts a una IA implementadora.  
**Proyecto:** Kaivor / ADMIA  
**Categoría:** Sistema Operativo Empresarial SaaS para LATAM  
**Objetivo de esta versión:** Convertir la base actual del producto en una v1.5 comercializable, usable y preparada para monetización freemium.

---

# 1. CONTEXTO GENERAL DEL PROYECTO

Kaivor / ADMIA es una plataforma SaaS empresarial para LATAM. No debe construirse ni sentirse como un ERP tradicional.

La visión del producto es construir un sistema operativo empresarial moderno que combine:

- Facturación.
- Clientes.
- Productos.
- Inventario.
- Transacciones.
- Integraciones ecommerce.
- Automatización.
- Inteligencia artificial nativa.
- UX premium.
- Arquitectura multi-tenant.
- Escalabilidad enterprise.

La plataforma debe sentirse como:

> Stripe + Linear + Notion + Toast + Shopify para LATAM.

No debe sentirse como:

- ERP viejo.
- Software contable pesado.
- Dashboard saturado.
- Herramienta genérica hecha rápido con IA.
- Sistema lleno de formularios confusos.

Debe sentirse:

- Rápido.
- Limpio.
- Premium.
- Claro.
- Empresarial.
- Intuitivo.
- Confiable.
- Fácil de usar sin capacitación.

---

# 2. ESTADO ACTUAL DEL PROYECTO

El proyecto ya cuenta con una base funcional de Fase 1.

## Backend actual

Stack principal:

- NestJS.
- Prisma ORM.
- PostgreSQL.
- Redis.
- JWT Authentication.
- Passport.js.
- Docker.
- Multi-tenant architecture.

Módulos existentes:

- Auth.
- Tenants.
- Users.
- Customers.
- Products.
- Inventory.
- Transactions.
- Invoices.
- Health.

El backend ya tiene estructura modular y endpoints REST funcionales.

## Frontend actual

Stack principal:

- Next.js 15.
- React 19.
- TypeScript.
- Tailwind CSS.
- Axios.
- Zustand.
- Framer Motion.

Pantallas existentes:

- Login.
- Register.
- Dashboard.
- Invoices.
- Navegación básica.

## Infraestructura actual

- Docker Compose.
- PostgreSQL 15.
- Redis 7.
- Health checks.
- Cypress configurado.
- GitHub Actions CI.

## Objetivo de v1.5

La v1.5 no debe reescribir el sistema. Debe extender lo existente.

Regla absoluta:

> Extender la arquitectura actual, no reemplazarla.

---

# 3. OBJETIVO ESTRATÉGICO DE v1.5

La v1.5 debe convertir Kaivor / ADMIA en una primera versión comercializable.

La promesa principal de esta versión es:

> Factura gratis. Conecta tu tienda. Automatiza tu operación con IA.

Esta versión debe permitir que una empresa:

1. Se registre.
2. Use facturación gratuita limitada.
3. Cree clientes y productos.
4. Cree facturas de forma simple.
5. Vea su uso y límites.
6. Entienda por qué debe subir a un plan pago.
7. Conecte WooCommerce en planes pagos.
8. Importe pedidos de WooCommerce.
9. Genere clientes, ventas o facturas desde pedidos.
10. Reciba insights simples de IA.

---

# 4. DEFINICIÓN DE v1.5

La v1.5 es:

## Facturación gratuita + monetización freemium + WooCommerce + IA operativa inicial.

No es todavía:

- Mobile app nativa completa.
- Offline-first total.
- ERP completo.
- POS avanzado.
- Agentes IA autónomos complejos.
- Marketplace de integraciones.
- Multi-país completo.
- Sistema contable completo.
- DIAN producción final si aún no está homologado.

La v1.5 debe ser una versión enfocada, vendible y estable.

---

# 5. PRINCIPIOS ABSOLUTOS DE PRODUCTO

## 5.1 No ERP feeling

La interfaz no debe sentirse pesada ni contable.

Evitar:

- Formularios largos.
- Tablas densas por defecto.
- Modales innecesarios.
- Lenguaje técnico.
- Campos que el usuario no entiende.

Preferir:

- Cards.
- Flujos guiados.
- Side panels.
- Empty states útiles.
- Acciones claras.
- Lenguaje humano.

## 5.2 Cero capacitación

El usuario debe poder crear su primera factura sin entrenamiento.

Cada pantalla debe responder:

- ¿Dónde estoy?
- ¿Qué puedo hacer?
- ¿Qué pasó?
- ¿Qué sigue?

## 5.3 IA nativa, no chatbot decorativo

La IA debe ayudar dentro del flujo operacional.

Ejemplos correctos:

- Detectar errores antes de emitir una factura.
- Resumir ventas del mes.
- Sugerir clientes a contactar.
- Detectar facturas vencidas.
- Explicar por qué un pedido no se pudo sincronizar.

Ejemplos incorrectos:

- Chatbot genérico sin contexto.
- Generación de texto irrelevante.
- IA visible pero inútil.

## 5.4 Mobile-first real

Aunque la v1.5 sea web, la interfaz debe funcionar bien en móvil.

Reglas:

- Botones táctiles grandes.
- Layouts responsivos reales.
- Formularios cortos.
- Tablas adaptadas a cards en móvil.
- Acciones principales visibles.

## 5.5 Velocidad percibida

Usar:

- Skeleton loading.
- Optimistic UI donde sea seguro.
- Toasts claros.
- Estados vacíos útiles.
- Validación temprana.

---

# 6. MODELO DE NEGOCIO v1.5

La estrategia recomendada es freemium.

## Tesis

La facturación básica gratuita sirve como canal de adquisición. La monetización real viene de:

- IA.
- Automatizaciones.
- Integraciones.
- Multiusuario.
- Reportes avanzados.
- Ecommerce.
- Agentes.
- Soporte.
- Enterprise controls.

## Planes iniciales sugeridos

| Plan | Precio | Objetivo |
|---|---:|---|
| Free | $0 | Adquisición y uso inicial |
| Starter | Bajo costo | Más facturas y funciones básicas |
| Pro AI | Medio | IA, reportes e integraciones |
| Business | Alto | Equipos, automatizaciones, ecommerce |
| Enterprise | Custom | Empresas grandes |

## Límites sugeridos

| Plan | Facturas/mes | Usuarios | IA | WooCommerce |
|---|---:|---:|---|---|
| Free | 30 | 1 | Muy limitada o no incluida | No |
| Starter | 100 | 2 | Básica | No |
| Pro AI | 500 | 5 | Sí | Sí |
| Business | Ilimitado razonable | 10+ | Sí avanzada | Sí |
| Enterprise | Custom | Custom | Custom | Custom |

Regla clave:

> No regalar IA avanzada, integraciones premium, multiusuario avanzado ni soporte humano intensivo.

---

# 7. ALCANCE FUNCIONAL DE v1.5

## 7.1 Subscription & Usage

Crear un sistema básico de planes, límites y uso.

Debe permitir:

- Saber el plan actual del tenant.
- Contar facturas creadas en el mes.
- Bloquear o limitar acciones según plan.
- Mostrar mensajes de upgrade.
- Preparar el sistema para pagos futuros.

### Funciones mínimas

- Plan Free por defecto al registrarse.
- Límite de facturas mensuales.
- Límite de usuarios por plan.
- Límite de uso IA por créditos o cantidad mensual.
- Feature gates para WooCommerce e IA avanzada.

### Endpoints sugeridos

```text
GET /subscriptions/current
GET /subscriptions/usage
POST /subscriptions/change-plan
GET /subscriptions/plans
```

### Modelos sugeridos

```text
Subscription
UsageEvent
PlanLimit
AiCreditEvent
```

---

## 7.2 Facturación Free mejorada

La facturación debe ser simple y agradable.

### Flujo recomendado

1. Seleccionar o crear cliente.
2. Agregar productos o servicios.
3. Revisar impuestos y total.
4. Vista previa.
5. Crear factura.

### Reglas UX

- Máximo 3 pasos.
- Autocompletar clientes.
- Autocompletar productos.
- Validaciones humanas.
- Vista previa antes de crear.
- Estados claros: draft, issued, paid, cancelled.
- Botones principales visibles.

### Mensajes de error

Incorrecto:

```text
ValidationError: taxId is undefined
```

Correcto:

```text
Falta el documento del cliente para generar la factura.
```

---

## 7.3 WooCommerce Integration MVP

WooCommerce será la primera integración estratégica de la plataforma.

### Objetivo

Permitir que una empresa conecte su tienda WooCommerce para importar pedidos y convertirlos en clientes, ventas y facturas dentro de Kaivor / ADMIA.

### Funciones mínimas

- Conectar tienda con URL, Consumer Key y Consumer Secret.
- Probar conexión.
- Guardar credenciales cifradas.
- Importar últimos 50 pedidos.
- Crear o actualizar clientes desde pedidos.
- Crear venta o factura desde pedido.
- Recibir webhooks de pedido creado y pedido actualizado.
- Evitar duplicados.
- Mostrar logs de sincronización.
- Mostrar errores claros.

### Módulo sugerido

```text
backend/src/modules/integrations/woocommerce
```

### Archivos sugeridos

```text
woocommerce.module.ts
woocommerce.service.ts
woocommerce.controller.ts
woocommerce-webhook.controller.ts
dto/connect-woocommerce.dto.ts
dto/test-connection.dto.ts
utils/normalize-store-url.ts
utils/verify-webhook-signature.ts
```

### Endpoints sugeridos

```text
POST /integrations/woocommerce/connect
POST /integrations/woocommerce/test-connection
POST /integrations/woocommerce/:id/sync
POST /integrations/woocommerce/webhook/:integrationId
GET /integrations
GET /integrations/:id/logs
POST /integrations/:id/disconnect
```

### Datos solicitados al usuario

```json
{
  "storeUrl": "https://mitienda.com",
  "consumerKey": "ck_xxxxxxxxxxxxxxxxx",
  "consumerSecret": "cs_xxxxxxxxxxxxxxxxx",
  "country": "CO",
  "currency": "COP"
}
```

### Seguridad obligatoria

- Nunca guardar Consumer Secret en texto plano.
- Nunca enviar Consumer Secret al frontend después de guardarlo.
- Nunca escribir credenciales en logs.
- Validar firma de webhooks.
- Usar HTTPS obligatorio.
- Aplicar rate limiting a endpoints públicos.

---

## 7.4 IA Operativa Inicial

La IA de v1.5 debe ser pequeña, útil y vendible.

No construir agentes complejos todavía.

### Función IA #1: Resumen inteligente del mes

Botón sugerido:

```text
Analizar mi mes
```

Debe producir un resumen como:

```text
Este mes vendiste $8.400.000.
Tus 3 mejores clientes generaron el 42% de ingresos.
Tienes 6 facturas pendientes por $1.200.000.
Tu producto más vendido fue Camiseta Negra.
```

### Función IA #2: Detección de errores en facturas

Antes de crear o emitir una factura, la IA puede revisar:

- Cliente sin documento.
- Dirección incompleta.
- Producto sin impuesto.
- Total inusual.
- Campos faltantes.

Ejemplo de salida:

```text
Detectamos 3 problemas antes de generar la factura:
1. El cliente no tiene documento fiscal.
2. La dirección está incompleta.
3. Uno de los productos no tiene impuesto configurado.
```

### Función IA #3: Recomendaciones de acción

Ejemplos:

```text
Tienes 5 clientes que no compran hace más de 30 días. Puedes enviarles una campaña de recompra.
```

```text
Tienes $3.200.000 en facturas pendientes. Activa recordatorios automáticos para mejorar cobranza.
```

### Módulo sugerido

```text
backend/src/modules/ai-insights
```

### Endpoints sugeridos

```text
GET /ai-insights/monthly-summary
POST /ai-insights/invoice-check
GET /ai-insights/recommendations
```

### Nota importante

La IA debe respetar permisos, tenant isolation y límites de plan.

---

## 7.5 Dashboard Ejecutivo v1.5

El dashboard no debe ser un panel saturado.

Debe mostrar pocas métricas accionables.

### Cards recomendadas

- Ventas del mes.
- Facturas creadas este mes.
- Facturas pendientes.
- Límite del plan Free.
- Pedidos WooCommerce sincronizados.
- Errores por resolver.
- Insight IA del día.

### Acciones por card

| Card | Acción |
|---|---|
| Facturas pendientes | Enviar recordatorio |
| Límite Free | Subir a Pro AI |
| WooCommerce | Ver sincronización |
| Errores | Resolver ahora |
| Insight IA | Ver recomendación |

---

# 8. ARQUITECTURA TÉCNICA v1.5

## 8.1 Principio general

Mantener arquitectura modular dentro del monolito NestJS actual.

No crear microservicios reales todavía salvo que sea necesario.

Regla:

> Modular ahora, microservicios después.

## 8.2 Módulos nuevos sugeridos

```text
subscriptions
usage
integrations
integrations/woocommerce
ai-insights
```

## 8.3 Modelos nuevos sugeridos

```text
Subscription
PlanLimit
UsageEvent
AiCreditEvent
Integration
IntegrationCredential
IntegrationLog
IntegrationWebhookEvent
ExternalReference
```

## 8.4 Eventos internos recomendados

Aunque no exista event bus completo todavía, diseñar servicios con eventos preparados.

Eventos sugeridos:

```text
invoice.created
invoice.limit_reached
woocommerce.connected
woocommerce.order_imported
woocommerce.webhook_received
woocommerce.sync_failed
ai.insight_generated
subscription.upgrade_required
```

---

# 9. BASE DE DATOS SUGERIDA

## 9.1 Subscription

Campos sugeridos:

```text
id
tenantId
plan
status
currentPeriodStart
currentPeriodEnd
createdAt
updatedAt
```

Valores de plan:

```text
FREE
STARTER
PRO_AI
BUSINESS
ENTERPRISE
```

Valores de status:

```text
active
trialing
past_due
cancelled
expired
```

## 9.2 UsageEvent

Campos sugeridos:

```text
id
tenantId
eventType
quantity
metadata
createdAt
```

Tipos de evento:

```text
invoice_created
ai_credit_used
woocommerce_order_imported
user_added
```

## 9.3 Integration

Campos sugeridos:

```text
id
tenantId
companyId
provider
status
storeUrl
country
currency
settings
lastSyncAt
createdAt
updatedAt
```

Valores provider:

```text
woocommerce
shopify
mercadolibre
stripe
paypal
```

Valores status:

```text
pending
connected
failed
disconnected
revoked
```

## 9.4 IntegrationCredential

Campos sugeridos:

```text
id
integrationId
consumerKeyEncrypted
consumerSecretEncrypted
webhookSecretEncrypted
createdAt
updatedAt
```

## 9.5 ExternalReference

Campos sugeridos:

```text
id
tenantId
provider
externalType
externalId
internalType
internalId
createdAt
```

Debe tener índice único:

```text
tenantId + provider + externalType + externalId
```

Esto evita duplicados.

## 9.6 IntegrationLog

Campos sugeridos:

```text
id
integrationId
level
event
message
metadata
createdAt
```

Niveles:

```text
info
warning
error
critical
```

---

# 10. WOOCommerce: FLUJO TÉCNICO DETALLADO

## 10.1 Conexión

Flujo:

```text
Usuario abre Integraciones → WooCommerce
↓
Ingresa Store URL, Consumer Key, Consumer Secret
↓
Backend normaliza URL
↓
Backend prueba conexión con WooCommerce
↓
Si funciona, guarda credenciales cifradas
↓
Genera webhook secret
↓
Devuelve URL de webhook al usuario
↓
Lanza sync inicial
```

## 10.2 Test connection

Probar contra:

```text
GET /wp-json/wc/v3/orders?per_page=1
```

Si responde correctamente, la conexión es válida.

## 10.3 Sync inicial

Importar:

- Últimos 50 pedidos.
- Clientes asociados.
- Productos incluidos en pedidos.

No importar toda la historia en v1.5.

## 10.4 Webhooks mínimos

Configurar en WooCommerce:

- Order created.
- Order updated.

Webhook URL sugerida:

```text
https://api.kaivor.com/integrations/woocommerce/webhook/:integrationId
```

## 10.5 Procesamiento de pedido

Flujo:

```text
Webhook recibido
↓
Validar firma
↓
Buscar integración
↓
Guardar evento
↓
Verificar duplicado por external reference
↓
Crear o actualizar cliente
↓
Crear venta/factura según estado
↓
Registrar log
↓
Mostrar resultado en dashboard
```

## 10.6 Estados WooCommerce

| Estado | Acción en Kaivor / ADMIA |
|---|---|
| pending | Guardar pedido, no facturar |
| processing | Crear venta/factura |
| completed | Crear o confirmar factura |
| cancelled | Marcar como cancelado |
| refunded | Marcar como reembolsado o preparar nota crédito |
| failed | No facturar |

---

# 11. FRONTEND v1.5

## 11.1 Pantallas nuevas

Crear o mejorar:

```text
/pricing
/subscription
/integrations
/integrations/woocommerce
/integrations/woocommerce/logs
/ai-insights
/dashboard
/invoices/create
```

## 11.2 Pantalla Pricing

Debe mostrar:

- Plan actual.
- Beneficios de cada plan.
- Límites.
- CTA claro.
- Diferencia entre Free y Pro AI.

Copy sugerido:

```text
Empieza facturando gratis. Desbloquea IA e integraciones cuando tu negocio crezca.
```

## 11.3 Pantalla WooCommerce

Estados:

```text
not_connected
connecting
connected
syncing
error
disconnected
```

Debe mostrar:

- Formulario de conexión.
- Estado de conexión.
- URL de webhook.
- Secreto de webhook solo al crearlo.
- Última sincronización.
- Pedidos importados.
- Errores recientes.
- Botón sincronizar ahora.
- Botón desconectar.

## 11.4 Dashboard

Debe priorizar cards limpias y accionables.

No usar tablas grandes por defecto.

## 11.5 Facturación

Crear factura debe ser el flujo más importante del producto Free.

Debe estar optimizado para que el usuario llegue a su primera factura rápido.

---

# 12. SEGURIDAD Y MULTI-TENANCY

## Reglas absolutas

- Nunca confiar en tenantId enviado por el cliente.
- TenantId debe venir del JWT/session context.
- Todas las queries deben estar filtradas por tenantId.
- Validar permisos antes de acciones críticas.
- No exponer credenciales en frontend.
- No guardar secretos en logs.
- Validar webhooks.
- Usar cifrado para claves externas.

## Permisos sugeridos

```text
integrations:read
integrations:write
integrations:disconnect
subscriptions:read
subscriptions:manage
ai:use
invoices:create
invoices:read
```

---

# 13. TESTING v1.5

## Tests E2E obligatorios

1. Usuario se registra y entra en plan Free.
2. Usuario crea su primera factura.
3. Usuario llega al límite Free y ve upgrade.
4. Usuario intenta conectar WooCommerce sin plan permitido y ve bloqueo.
5. Usuario Pro conecta WooCommerce.
6. Test connection exitoso.
7. Importación mock de pedido WooCommerce.
8. Webhook válido crea venta/factura.
9. Webhook inválido se rechaza.
10. Pedido duplicado no crea factura duplicada.
11. Dashboard muestra pedidos sincronizados.
12. IA genera resumen mensual.
13. IA detecta errores en factura.

## Tests unitarios recomendados

- Normalización de URL.
- Validación de firma webhook.
- Reglas de plan.
- Conteo de uso mensual.
- Mapeo de pedido WooCommerce.
- Idempotencia por external reference.
- Regla de facturación por estado de pedido.

---

# 14. DEFINICIÓN DE DONE v1.5

La v1.5 está terminada cuando este flujo funciona completo:

```text
1. Usuario se registra.
2. El sistema le asigna plan Free.
3. Usuario crea cliente.
4. Usuario crea producto.
5. Usuario crea factura.
6. El sistema cuenta la factura dentro del uso mensual.
7. Al llegar al límite, el sistema muestra upgrade.
8. Usuario con plan permitido conecta WooCommerce.
9. Kaivor prueba credenciales.
10. Kaivor importa pedidos.
11. WooCommerce envía webhook.
12. Kaivor valida firma.
13. Kaivor crea o actualiza cliente.
14. Kaivor crea venta/factura sin duplicar.
15. Dashboard muestra estado de sincronización.
16. IA genera resumen o recomendación útil.
17. Tests críticos pasan.
```

---

# 15. QUÉ NO HACER EN v1.5

No implementar todavía:

- App móvil nativa.
- Offline-first completo.
- POS avanzado.
- Agentes autónomos multi-step.
- Videos IA.
- Imágenes IA ilimitadas.
- Integraciones adicionales no necesarias.
- Marketplace.
- ERP contable completo.
- Multi-país completo.
- Inventario bidireccional avanzado.
- Refactor total del proyecto.

No romper:

- Auth existente.
- Tenant isolation.
- Invoices existentes.
- Customers existentes.
- Products existentes.
- Docker setup.
- Cypress setup.
- CI pipeline.

---

# 16. PRIORIDAD DE IMPLEMENTACIÓN

Orden exacto recomendado:

```text
1. Crear Subscription module.
2. Crear Usage tracking.
3. Aplicar límites a creación de facturas.
4. Crear pantalla Pricing / Plan actual.
5. Mejorar UX de crear factura.
6. Crear modelos de Integrations.
7. Crear WooCommerce connect.
8. Crear WooCommerce test connection.
9. Cifrar credenciales.
10. Importar últimos 50 pedidos.
11. Crear ExternalReference para evitar duplicados.
12. Crear webhook endpoint.
13. Validar firma webhook.
14. Procesar order.created y order.updated.
15. Crear logs visibles.
16. Crear dashboard WooCommerce.
17. Crear AI Insights básico.
18. Integrar cards de IA al dashboard.
19. Crear tests unitarios.
20. Crear tests E2E.
```

---

# 17. COPY Y TONO DEL PRODUCTO

El tono debe ser:

- Claro.
- Profesional.
- Humano.
- Directo.
- Premium.
- Sin jerga innecesaria.

## Mensajes sugeridos

### Free plan

```text
Empieza facturando gratis. Cuando tu negocio crezca, desbloquea automatización, IA e integraciones.
```

### Límite alcanzado

```text
Llegaste al límite de facturas del plan Free. Sube a Pro AI para seguir facturando y desbloquear automatizaciones.
```

### WooCommerce bloqueado

```text
WooCommerce está disponible en Pro AI y Business. Conecta tu tienda para importar pedidos automáticamente.
```

### IA bloqueada

```text
Desbloquea Kaivor AI para analizar tus ventas, detectar errores y recibir recomendaciones inteligentes.
```

### Error de integración

```text
No pudimos conectar tu tienda. Revisa que la URL, Consumer Key y Consumer Secret sean correctos.
```

---

# 18. MÉTRICAS QUE DEBE SOPORTAR v1.5

El sistema debe permitir medir:

- Usuarios registrados.
- Usuarios activos.
- Facturas creadas.
- Facturas por tenant.
- Uso mensual por plan.
- Usuarios que llegan al límite Free.
- Intentos de upgrade.
- Conexiones WooCommerce exitosas.
- Pedidos WooCommerce importados.
- Errores de sincronización.
- Facturas generadas desde WooCommerce.
- Uso de IA.
- Créditos IA consumidos.

---

# 19. KPIs DE ÉXITO v1.5

Metas iniciales:

| KPI | Meta |
|---|---:|
| Registro a primera factura | Menos de 10 minutos |
| Usuarios Free que crean factura | Más de 40% |
| Usuarios que llegan al límite Free | Más de 10% |
| Conversión Free a Pro | 3% a 5% inicial |
| Conexión WooCommerce exitosa | Más de 80% |
| Pedidos WooCommerce sincronizados correctamente | Más de 95% |
| Facturas duplicadas | 0 |
| Usuarios Pro que usan IA | Más de 30% |
| Tiempo para crear factura | Menos de 2 minutos |
| Tiempo para conectar WooCommerce | Menos de 5 minutos |

---

# 20. INSTRUCCIONES PARA LA IA IMPLEMENTADORA

## Comportamiento esperado

La IA implementadora debe:

1. Leer este documento completo antes de tocar código.
2. Revisar la estructura actual del repositorio.
3. No reescribir el proyecto desde cero.
4. Crear cambios pequeños, seguros y revisables.
5. Mantener compatibilidad con módulos existentes.
6. Priorizar backend estable antes de UI avanzada.
7. Mantener TypeScript estricto.
8. Mantener validaciones DTO.
9. Mantener tenant isolation.
10. Crear tests cuando agregue lógica crítica.
11. Evitar dependencias innecesarias.
12. No exponer secretos.
13. No romper Docker ni CI.
14. Explicar cada cambio importante.

## Prohibiciones

La IA no debe:

- Cambiar stack sin autorización.
- Reemplazar NestJS.
- Reemplazar Prisma sin autorización.
- Reemplazar Next.js.
- Eliminar módulos existentes.
- Romper autenticación.
- Saltarse multi-tenancy.
- Guardar secretos en texto plano.
- Crear IA costosa sin límites.
- Meter features fuera del alcance v1.5.
- Crear diseño genérico tipo template barato.

---

# 21. PROMPT INICIAL RECOMENDADO PARA LA IA

Después de subir este documento a la carpeta del proyecto, usar un prompt parecido a este:

```text
Lee primero el documento DOCUMENTO_MAESTRO_v1_5_para_IA_Implementadora_Kaivor_ADMIA.

Luego analiza la estructura actual del repositorio y propón un plan de implementación por fases para construir la v1.5 sin reescribir el proyecto.

Prioridad absoluta:
1. Subscription module y límites Free.
2. Usage tracking.
3. WooCommerce integration MVP.
4. AI Insights básico.
5. Dashboard y UX v1.5.
6. Tests críticos.

No implementes todavía. Primero entrégame:
- diagnóstico del estado actual del código,
- archivos que tocarías,
- modelos nuevos necesarios,
- endpoints nuevos,
- riesgos,
- orden de implementación.

Respeta NestJS, Prisma, Next.js, multi-tenancy y la arquitectura existente.
```

---

# 22. RESULTADO ESPERADO

Al implementar este documento correctamente, Kaivor / ADMIA tendrá una v1.5 que:

- Puede atraer usuarios con facturación gratis.
- Puede monetizar con planes pagos.
- Puede conectar WooCommerce.
- Puede generar valor con IA básica.
- Puede mostrar métricas accionables.
- Puede diferenciarse de software contable tradicional.
- Puede prepararse para v2: DIAN avanzada, POS, agentes, offline-first e integraciones adicionales.

La v1.5 debe ser la primera versión que se pueda vender, probar con usuarios reales y usar como base para crecimiento.

---

# 23. RESUMEN FINAL

La dirección correcta es:

```text
Facturación gratis como adquisición.
WooCommerce como integración de valor inmediato.
IA como razón para pagar.
Automatización como expansión.
Business OS como visión de largo plazo.
```

La v1.5 no debe intentar ser perfecta.

Debe ser:

- Útil.
- Clara.
- Vendible.
- Estable.
- Diferenciada.
- Preparada para escalar.

Esa es la prioridad.


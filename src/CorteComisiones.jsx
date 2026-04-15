Perfecto, tengo todo el esquema. Mapeando columnas clave:

- `estado` → `'llegado'` ✅
- `consumo_subtotal` + `comision_monto` → ya calculados ✅
- `cliente_hotel` → aquí irá "Hotel Xaloc · María" ✅
- `validacion_estado` → `'pendiente'` / `'pagado'` ✅
- `fecha_pago_comision` → para registrar cuándo se pagó ✅
- `semana_corte` → ya existe con formato `2026-W16` ✅

El sistema está listo para esto. Construyo el módulo completo ahora.

**Convención del campo hotel que les recomendarás usar:**
`Hotel Xaloc · María` — separador con espacio-punto-espacio `·`

---

**Archivo 1 de 2 — crear:** `src/CorteComisiones.jsx`**Archivo 2 de 2 — editar `App.jsx`**

Agrega estas 3 cosas en tu App.jsx existente:

**1. Import al inicio:**
```jsx
import CorteComisiones from './CorteComisiones'
```

**2. En la navegación** (donde están los tabs Hoy / Validaciones / Histórico), agrega uno nuevo — solo visible para admin:
```jsx
{userRole === 'admin' && (
  <button onClick={() => setActiveTab('corte')}>
    💰 Comisiones
  </button>
)}
```

**3. En el render del contenido**, agrega el caso:
```jsx
{activeTab === 'corte' && (
  <CorteComisiones userRole={userRole} />
)}
```

---

**Lo que hace el módulo:**

- Selector de semana (actual + 8 semanas atrás)
- 4 tarjetas resumen: reservas, consumo total, a pagar, pendientes
- Una tarjeta por recepcionista (expandible al tocar) con borde naranja = pendiente / verde = pagado
- Tabla detalle: fecha, restaurante, cliente, personas, consumo, comisión 5%
- Botón **Marcar Pagado** → actualiza `validacion_estado` y `fecha_pago_comision` en Supabase
- Barra total general al final si hay más de un recepcionista
- **Exportar CSV** con todos los datos de la semana
- Nota de convención para los recepcionistas visible en pantalla

¿Lo subimos al repo ahora?

[README.md](https://github.com/user-attachments/files/28555315/README.md)
# Santos Brother — Sistema de Gestión

Sistema de gestión de inventario, ventas y gastos para Santos Brother.

## Stack

- **Frontend:** HTML + CSS + JavaScript (un solo archivo)
- **Base de datos:** Supabase (PostgreSQL)
- **Deploy:** Vercel o Netlify

## Funcionalidades

- **Home** — Dashboard con resumen del negocio: ventas del día, mes, gastos, ganancia neta, alertas de stock
- **Inventario** — Carga de productos y edición de stock directa
- **Registrar Venta** — Registro de ventas con descuento automático de stock. Historial filtrable por hoy / semana / mes / año
- **Gastos Fijos** — Registro de costos del local por mes
- **Dashboard** — Gráficos de facturación y ganancia neta por mes, top productos más vendidos
- **Reposición** — Alertas de stock divididas en Urgente / Prioridad / Normal con mínimo calculado según flujo real de ventas
- **Análisis** — Talles sin movimiento y concentración de ventas del mes exportable a PDF

## Configuración

Las credenciales de Supabase están en las primeras líneas del script en `santos-brothers.html`:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_KEY = "eyJ..."; // clave anon pública
```

## Tablas en Supabase

```sql
CREATE TABLE productos (
  id TEXT PRIMARY KEY,
  modelo TEXT, marca TEXT, color TEXT, talle TEXT,
  costo NUMERIC DEFAULT 0, precio NUMERIC DEFAULT 0,
  stock INTEGER DEFAULT 0, creado_en TIMESTAMPTZ
);

CREATE TABLE ventas (
  id TEXT PRIMARY KEY,
  producto_id TEXT, producto_nombre TEXT,
  qty INTEGER DEFAULT 1, precio NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0, costo NUMERIC DEFAULT 0,
  fecha DATE, vendedor TEXT, pago TEXT, nota TEXT,
  registrado_en TIMESTAMPTZ
);

CREATE TABLE gastos (
  id TEXT PRIMARY KEY,
  descripcion TEXT, monto NUMERIC DEFAULT 0,
  mes TEXT, creado_en TIMESTAMPTZ
);
```

## Deploy en Vercel

1. Subir este repositorio a GitHub
2. Entrar a [vercel.com](https://vercel.com) → New Project
3. Importar el repo de GitHub
4. Deploy — Vercel detecta el HTML automáticamente

Cada vez que se haga un commit a GitHub, Vercel actualiza el deploy automáticamente.

## Deploy rápido (sin GitHub)

Arrastrar `santos-brothers.html` a [app.netlify.com/drop](https://app.netlify.com/drop)

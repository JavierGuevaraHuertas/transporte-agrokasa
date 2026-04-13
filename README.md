# Programación de Transporte — Agrokasa

App web para programación diaria de salida y recojo de personal.

## Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Chart.js + react-chartjs-2
- localStorage (sin backend)

## Usuarios demo

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | admin | Administrador |
| jguevara | jguevara | Supervisor |
| cdiaz | cdiaz | Supervisor |
| tsotelo | tsotelo | Supervisor |
| cbenites | cbenites | Supervisor |
| aarroyo | aarroyo | Supervisor |
| mchesnova | mchesnova | Supervisor |

## Instalación local

```bash
npm install
npm run dev
```

## Deploy en Vercel

1. Sube este repo a GitHub
2. En [vercel.com](https://vercel.com) → New Project → importa el repo
3. Framework: **Vite** (se detecta automáticamente)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy ✓

## Estructura

```
src/
  components/     # Topbar, Modal, Toast
  hooks/          # useToast
  pages/
    LoginPage.tsx
    supervisor/   # MenuPanel, ListaPanel, FormPanel
    admin/        # DashboardPanel, ConsolidadoPanel,
                  # SupervisoresPanel, UsuariosPanel, TendenciasPanel
  store/          # AppContext
  types/          # TypeScript interfaces
  utils/          # constants, storage, export
```

## Funcionalidades

### Supervisor
- Login con correo @agrokasa.com.pe
- Ver/crear/editar programaciones de Salida y Recojo
- Tabla filtrada por agrupador de paraderos
- Bloqueo automático cuando el admin cierra el día

### Administrador
- Dashboard con métricas y cobertura en tiempo real
- Consolidado por paraderos y por ruta/comedor
- Panel de supervisores con estado de registro
- Gestión de usuarios: asignar áreas por supervisor
- Tendencias: gráfico de líneas y barras por período
- Cerrar/reabrir día
- Exportar CSV

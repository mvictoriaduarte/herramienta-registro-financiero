# Registro financiero

Aplicación para seguir ingresos, gastos, cuentas y tenencias por perfil privado.

## Stack

- Next.js + TypeScript
- Prisma + SQLite
- Sesiones JWT en cookie httpOnly
- Tailwind CSS (glass + petróleo)

## Cómo correrla

```bash
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Usuario inicial: `admin` / `Admin1234`

## Funciones

- **Cuentas**: orígenes/destinos de fondos
- **Conceptos**: gasto, ingreso, ahorro/inversión o neutro (+ grupo)
- **Movimientos**: ingreso o gasto, cuenta, concepto, moneda, TC opcional
- **Ingresos**: fuentes con modalidad de cobro (hora, semanal, quincenal, mensual) + adicionales
- **Tenencias**: saldos inicio/fin por cuenta
- **Análisis**: honorarios, gastos corrientes, flujo, ranking y evolución

Cada consulta filtra por el usuario de la sesión.

# MMS Group — Gastos de Carretera

App de bitácora de flota (2 camiones) con login de administrador y conductores,
conectada a una base de datos real de Supabase. Lista para publicar en tu propio
dominio (ej. www.mmsgroup.com) a través de Vercel.

## 1. Base de datos (ya casi lista)

Tu proyecto de Supabase ya está conectado en `src/supabaseClient.js`. Solo falta
crear las tablas:

1. Entra a tu proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** → **New query**.
3. Copia y pega todo el contenido del archivo `sql/schema.sql` de esta carpeta.
4. Dale **Run**. Esto crea las tablas de camiones, conductores, gastos y la
   cuenta de administrador, con los dos camiones ya sembrados.

## 2. Probar localmente (opcional)

Necesitas [Node.js](https://nodejs.org) instalado.

```bash
npm install
npm run dev
```

Abre la URL que te muestre en la terminal (normalmente `http://localhost:5173`).

## 3. Subir a GitHub

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo (puede ser privado).
3. Sube esta carpeta al repositorio (por la web de GitHub arrastrando los
   archivos, o con `git init && git add . && git commit -m "inicial" && git push`).

## 4. Desplegar en Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com) — puedes entrar directo
   con tu cuenta de GitHub.
2. Click en **Add New... → Project**.
3. Selecciona el repositorio que acabas de subir.
4. Vercel detecta automáticamente que es un proyecto Vite — dale **Deploy**.
5. En un par de minutos te da un link tipo `mms-fleet-app.vercel.app` — ya
   funcionando de verdad, con base de datos real.

## 5. Conectar tu dominio propio

1. Compra el dominio (ej. `mmsgroup.com`) en Namecheap, GoDaddy, o el
   registrador que prefieras, si aún no lo tienes.
2. En Vercel, entra a tu proyecto → **Settings → Domains**.
3. Escribe tu dominio (ej. `www.mmsgroup.com`) y dale **Add**.
4. Vercel te muestra un registro DNS (tipo CNAME o A) que debes agregar en
   la configuración DNS de donde compraste el dominio.
5. Espera unos minutos a que se propague — Vercel activa HTTPS automáticamente.

Listo: tu app queda accesible en tu propio dominio, con los datos guardados
en tu base de datos de Supabase.

## Notas de seguridad

- Las contraseñas de administrador y conductores se guardan en texto plano en
  la base de datos (igual que en la versión de Claude). Es un nivel de
  protección razonable para una herramienta interna de la empresa, pero no
  la trates como si fuera información bancaria.
- La "anon key" de Supabase embebida en el código es pública por diseño —
  el acceso real está controlado por las políticas de Row Level Security
  definidas en `sql/schema.sql`.

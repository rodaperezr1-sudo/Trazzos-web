# TRAZZO Construcciones · Vista previa para el cliente

Esta carpeta es el prototipo navegable del sitio, listo para subir a GitHub y publicar en Vercel.
Es solo una vista previa: no es el sitio final. El sitio final será el tema de WordPress.
Los buscadores no la indexan, porque tiene `noindex`.

## Qué contiene (59 MB, unos 820 archivos)
- `prototipo/`: las páginas Inicio, Proyectos, Mil Lunas, María Auxiliadora y Contacto, con sus estilos, scripts e imágenes propias.
- `frames/`: las secuencias de fotogramas del recorrido del Home.
- `assets/`: las fotos livianas (`_web`), los logos que se usan y el video de Mil Lunas.
- `index.html` y `vercel.json`: llevan de la raíz a `/prototipo/`.

No hay que compilar nada: es un sitio estático.

## 1. Subir a GitHub (sin usar la terminal)
1. Entra en github.com, pulsa **New repository** y ponle de nombre, por ejemplo, `trazzo-preview`.
2. Elige **Private** (recomendado) y pulsa **Create repository**.
3. En la página del repositorio vacío, pulsa **uploading an existing file**.
4. Arrastra **todo el contenido** de esta carpeta: `prototipo`, `frames`, `assets`, `index.html`, `vercel.json` y `.gitignore`. No arrastres la carpeta `trazzo-vercel` en sí, sino lo que tiene dentro.
5. Pulsa **Commit changes**.

La web de GitHub acepta hasta 100 archivos por subida. Si se queja, súbelos por partes:
- Primero `prototipo`, `assets`, `index.html` y `vercel.json`.
- Después `frames`, carpeta por carpeta.

Con GitHub Desktop es más fácil: **File → Add local repository**, eliges esta carpeta y la publicas con **Publish repository**.

### O desde la terminal (si tienes Git instalado)
```
cd C:\Users\rogge\Documents\Proyectos\trazzo-vercel
git init
git add .
git commit -m "Vista previa TRAZZO"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/trazzo-preview.git
git push -u origin main
```

## 2. Publicar en Vercel
1. Entra en vercel.com con tu cuenta de GitHub.
2. Pulsa **Add New → Project** e importa el repositorio `trazzo-preview`.
3. Deja **Framework Preset: Other**, sin comando de build y con el directorio de salida vacío.
4. Pulsa **Deploy**. En aproximadamente un minuto te da un enlace del tipo `trazzo-preview.vercel.app`.
5. Ese es el enlace para el cliente. Cada vez que subas cambios a GitHub, Vercel se actualiza solo.

## Avisos para la presentación
- El formulario de Contacto todavía no envía a ningún destino real. Ese envío queda para la Fase 4.
- Hay cifras y textos pendientes de confirmar, como el 1.352 m², "+15 obras" y los rótulos marcados en `docs/PENDIENTES.md` del proyecto.
- Lo ideal es abrirlo en un computador con buena conexión. En móvil también funciona.

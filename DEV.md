# Desarrollo local (servidor + túnel)

Sirve para probar la app en el celular con HTTPS **sin deployar** cada vez.  
Cámara, geolocalización y giroscopio requieren HTTPS (o `localhost`); el túnel da una URL `https://…trycloudflare.com`.

## Requisitos

- Python 3
- Node.js / npm (para `npx` y `cloudflared`)

## 1. Levantar el servidor local

En la carpeta del proyecto:

```powershell
cd "C:\Users\Luis De León\Desktop\Luis\Proyectos\Cursor hackathon"
python -m http.server 8080 --bind 127.0.0.1
```

Deja esa terminal abierta. La app queda en:

- PC: [http://127.0.0.1:8080](http://127.0.0.1:8080)

## 2. Abrir el túnel (acceso desde el celular)

En **otra** terminal, misma carpeta:

```powershell
npx --yes cloudflared tunnel --url http://127.0.0.1:8080
```

Cuando arranque, busca una línea como:

```text
https://algo-aleatorio.trycloudflare.com
```

Abre esa URL en el celular.  
Cada vez que reinicies el túnel, la URL cambia.

Los cambios en los archivos se ven al **recargar** la página en el teléfono.

## 3. Apagar todo

1. En la terminal del **túnel**: `Ctrl + C`
2. En la terminal del **servidor**: `Ctrl + C`

Si alguna quedó colgada en segundo plano:

```powershell
# Ver quién usa el puerto 8080
netstat -ano | findstr :8080

# Matar el proceso (reemplaza PID)
taskkill /PID <PID> /F
```

## Atajo: dos terminales a la vez

**Terminal A — servidor**

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

**Terminal B — túnel**

```powershell
npx --yes cloudflared tunnel --url http://127.0.0.1:8080
```

## Notas

- Mantén el PC despierto y con internet mientras pruebes.
- Si el túnel falla, vuelve a lanzar el comando de `cloudflared`; la URL nueva es la válida.
- En iPhone, concede permisos de cámara / movimiento / ubicación cuando el navegador lo pida (botón **Calibrar telescopio**).
- Solo para desarrollo. No uses este túnel como deploy permanente.

# Marcador Ecuavoley — App Mobile

App React Native (Expo) para arbitraje y seguimiento de partidos de ecuavoley.

## Requisitos

- Node.js >= 22
- npm 10+ (el proyecto usa `package-lock.json`; `.npmrc` activa `legacy-peer-deps`)
- Expo Go en tu celular (Android/iOS) o emulador
- Backend corriendo en la misma red WiFi (repositorio `marcador-ecuaboley-backend`)

## Inicio rapido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar la IP del backend (lib/config.ts)
# Definir EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SOCKET_URL, o editar los fallbacks
# DEV_API_FALLBACK / DEV_SOCKET_FALLBACK con la IP de tu PC
# Para encontrarla: ipconfig (Windows) o ifconfig (Mac/Linux)
# Ejemplo: http://192.168.1.100:3000

# 3. Iniciar Expo
npx expo start

# 4. Escanear QR con Expo Go
# Tu celular debe estar en la misma red WiFi que tu PC
```

## Tests

La app tiene pruebas unitarias para validacion de formularios y persistencia
de sesion. Se ejecutan en Node con mocks en memoria (no requieren emulador).

```bash
npm test            # 22 tests (Vitest)
npx tsc --noEmit    # comprobacion de tipos
npx expo-doctor     # valida dependencias contra la version de Expo SDK
```

## Pantallas

| Pantalla      | Ruta                        | Descripcion                              |
| ------------- | --------------------------- | ---------------------------------------- |
| Home          | `/`                         | Selector: Soy Juez / Soy Espectador      |
| Login         | `/login`                    | Email + contrasena                       |
| Register      | `/register`                 | Crear cuenta nueva                       |
| Dashboard     | `/dashboard`                | Lista de partidos (crear, eliminar)      |
| Crear Partido | `/crear-partido`            | Config: equipos, colores, puntos, sets   |
| Marcador      | `/partido/[partidoId]`      | Marcador interactivo (PUNTO/CAMBIO/UNDO) |
| Espectador    | `/espectador`               | Ingresar codigo de sala                  |
| Ver Partido   | `/ver-partido/[codigoSala]` | Marcador read-only en tiempo real        |

## Modo Juez

1. Registrarse/iniciar sesion
2. Crear un partido (nombres opcionales, colores, puntos por set, sets para ganar)
3. En el marcador: 2 botones principales
   - **CAMBIO**: rota la batida al otro equipo (sin sumar puntos)
   - **PUNTO**: suma 1 punto al equipo que tiene la batida
4. **Deshacer**: revierte la ultima accion
5. **Pausar/Reanudar**: detiene temporalmente el juego
6. **Compartir**: enviar codigo de sala a espectadores
7. Entre sets: boton "Iniciar siguiente set" cuando un equipo gana un set

## Modo Espectador

1. Ingresar codigo de sala (6 caracteres, lo comparte el juez)
2. Ver marcador en tiempo real via WebSocket
3. Indicador "EN VIVO" con punto verde
4. Marcador de sets (X - Y) si es multi-set
5. No se puede modificar nada

## Librerias principales

| Libreria              | Uso                            |
| --------------------- | ------------------------------ |
| expo-router           | Navegacion file-based          |
| @tanstack/react-query | Cache y refetch de datos       |
| zustand               | Estado global (auth)           |
| expo-secure-store     | Persistencia segura del token  |
| socket.io-client      | Tiempo real (espectador)       |
| expo-haptics          | Vibracion al registrar jugadas |

## Configuracion de red

La app se conecta al backend por IP local. Para que funcione:

1. Backend corriendo con `yarn dev` (repositorio `marcador-ecuaboley-backend`, puerto 3000)
2. Celular y PC en la misma red WiFi
3. IP correcta en `lib/config.ts` (`EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`)

Para encontrar tu IP:

- **Windows**: abrir CMD → `ipconfig` → buscar "IPv4 Address" del adaptador WiFi
- **Mac**: Preferencias del Sistema → Red → IP
- **Linux**: `ip addr` o `ifconfig`

## Estructura

```
mobile/
├── app/                    # Pantallas (Expo Router)
│   ├── _layout.tsx         # Provider global (QueryClient, SafeArea)
│   ├── index.tsx           # Home
│   ├── login.tsx           # Login
│   ├── register.tsx        # Register
│   ├── dashboard.tsx       # Lista de partidos
│   ├── crear-partido.tsx   # Formulario crear partido
│   ├── espectador.tsx      # Input codigo sala
│   ├── partido/
│   │   └── [partidoId].tsx # Marcador interactivo
│   └── ver-partido/
│       └── [codigoSala].tsx # Vista espectador
├── lib/                    # Logica compartida
│   ├── api.ts              # Wrapper HTTP con auth automatica
│   ├── auth-store.ts       # Zustand + SecureStore
│   ├── socket.ts           # Singleton Socket.io
│   └── types.ts            # Interfaces TypeScript
└── assets/                 # Iconos y splash
```

## Notas para beta

- Si el servidor no responde, verificar IP y que el backend este corriendo
- Si el login falla, verificar que el usuario existe (usar register primero)
- El codigo de sala se genera automaticamente al crear un partido
- Los nombres de equipo son opcionales (se usa el nombre del color por defecto)
- No se puede elegir el mismo color para ambos equipos

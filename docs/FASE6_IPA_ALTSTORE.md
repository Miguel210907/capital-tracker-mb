# Fase 6 - IPA para AltStore sin Mac local

## Resumen realista

Esta app es una app nativa iOS con React Native + Expo. No es web ni PWA.

iOS no instala apps realmente sin firmar. El flujo viable sin Apple Developer de pago
y sin Mac local es:

1. GitHub Actions usa un runner macOS 26 con Xcode 26.
2. El runner genera el proyecto iOS con `expo prebuild`.
3. Xcode compila la app para `iphoneos` sin firma de distribucion.
4. El workflow empaqueta `Payload/CapitalTrackerMB.app` como `.ipa`.
5. Descargas el artifact `.ipa`.
6. AltStore/AltServer lo firma con tu Apple ID gratuita al instalarlo.
7. Con Apple ID gratuita debes refrescar la app antes de 7 dias.

El `.ipa` de GitHub Actions no es un IPA de App Store ni un build firmado para
distribucion. Es un contenedor para que AltStore lo pueda firmar e instalar.

## Archivos incluidos

- Workflow: `.github/workflows/ios-unsigned-ipa.yml`
- Guia: `docs/FASE6_IPA_ALTSTORE.md`
- Ignorados Git: `.gitignore`

## Desde cero en Windows

### 1. Instalar Node.js

1. Entra en https://nodejs.org/
2. Descarga la version LTS para Windows.
3. Instala con las opciones por defecto.
4. Abre PowerShell y comprueba:

```powershell
node --version
npm --version
```

### 2. Instalar Git

1. Entra en https://git-scm.com/download/win
2. Instala Git para Windows.
3. Comprueba:

```powershell
git --version
```

### 3. Instalar VS Code

1. Entra en https://code.visualstudio.com/
2. Instala VS Code.
3. Abre la carpeta `capital-tracker-mb`.

### 4. Instalar dependencias del proyecto

Desde la carpeta del proyecto:

```powershell
cd C:\Users\migue\Documents\Codex\2026-05-16\navegador-plugin-browser-openai-bundled-quiero\capital-tracker-mb
npm install --legacy-peer-deps
```

### 5. Ejecutar en desarrollo

En Windows puedes probar la app con Expo.

```powershell
npm start
```

Opciones:

- En iPhone: instala Expo Go y escanea el QR si las dependencias nativas usadas estan soportadas.
- Si alguna dependencia nativa no funciona en Expo Go, necesitas un build nativo. Ese es el flujo de GitHub Actions + AltStore.

## Crear repositorio GitHub

### Opcion con GitHub web

1. Entra en https://github.com/
2. Crea un repositorio nuevo, por ejemplo `capital-tracker-mb`.
3. No hace falta marcar README si ya lo tienes local.

### Subir el proyecto

Desde PowerShell:

```powershell
cd C:\Users\migue\Documents\Codex\2026-05-16\navegador-plugin-browser-openai-bundled-quiero\capital-tracker-mb
git init
git add .
git commit -m "Initial Capital Tracker MB app"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/capital-tracker-mb.git
git push -u origin main
```

Cambia `TU_USUARIO` por tu usuario real de GitHub.

## Generar el IPA en GitHub Actions

El workflow ya esta en:

```text
.github/workflows/ios-unsigned-ipa.yml
```

Se ejecuta automaticamente al hacer push a `main` o `master`, y tambien manualmente:

1. Entra en tu repositorio de GitHub.
2. Ve a `Actions`.
3. Selecciona `Build unsigned iOS IPA`.
4. Pulsa `Run workflow`.
5. Espera a que termine.
6. Abre el job terminado.
7. Descarga el artifact `CapitalTrackerMB-unsigned-ipa`.
8. Descomprime el artifact.
9. Obtendras:

```text
CapitalTrackerMB-unsigned.ipa
CapitalTrackerMB-unsigned.ipa.sha256
```

## Que hace el workflow

Resumen del workflow:

```yaml
runs-on: macos-26
npm ci --legacy-peer-deps
npx expo prebuild --platform ios --clean --non-interactive --no-install
cd ios && pod install --repo-update
xcodebuild ... -sdk iphoneos ... CODE_SIGNING_ALLOWED=NO
mkdir Payload
cp -R App.app Payload/
zip CapitalTrackerMB-unsigned.ipa Payload
```

Detalles importantes:

- Usa runner macOS 26 porque Expo SDK actual necesita Xcode/Swift moderno.
- No usa certificados Apple.
- No usa Apple Developer de pago.
- No sube tus datos a ningun backend.
- El artifact dura 14 dias en GitHub Actions.

## Instalar con AltStore en Windows

### 1. Instalar iTunes e iCloud correctos

AltStore recomienda evitar las versiones de Microsoft Store si dan problemas.
Usa las versiones directas de Apple cuando sea posible:

- iTunes desde Apple.
- iCloud desde Apple.

Despues inicia sesion en iCloud y abre iTunes al menos una vez.

### 2. Instalar AltServer

1. Descarga AltServer desde https://altstore.io/
2. Instala AltServer.
3. Conecta el iPhone por USB.
4. En el iPhone, pulsa `Confiar en este ordenador`.
5. Abre AltServer en Windows.
6. Instala AltStore en el iPhone desde el menu de AltServer.
7. Introduce tu Apple ID cuando lo pida.

Recomendacion: puedes usar un Apple ID secundario solo para sideloading.

### 3. Instalar el IPA

1. Copia `CapitalTrackerMB-unsigned.ipa` a iCloud Drive, Archivos, OneDrive o enviatelo por AirDrop/equivalente.
2. En el iPhone, abre AltStore.
3. Ve a `My Apps`.
4. Pulsa el boton `+`.
5. Selecciona `CapitalTrackerMB-unsigned.ipa`.
6. AltStore firmara e instalara la app.

## Refrescar antes de que caduque

Con Apple ID gratuita:

- Las apps instaladas con AltStore caducan a los 7 dias.
- Abre AltStore en el iPhone.
- Manteniendo AltServer abierto en Windows, pulsa `Refresh All`.
- Si WiFi no funciona, conecta el iPhone por USB.
- Hazlo antes de que pasen 7 dias.

Si caduca:

1. Vuelve a conectar el iPhone al PC.
2. Abre AltServer.
3. Reinstala/refresh desde AltStore.
4. Los datos de la app suelen conservarse si no borras la app, pero exporta backups regularmente.

## Copias de seguridad de datos

Dentro de la app:

1. Abre `Ajustes`.
2. Entra en `Importar/exportar`.
3. Pulsa `Exportar backup JSON`.
4. Guarda el archivo en iCloud Drive, Archivos, OneDrive o tu PC.

Antes de importar CSV/XLSX o restaurar backup, la app crea una copia automatica.

Para restaurar:

1. Abre `Importar/exportar`.
2. Pulsa `Restaurar backup JSON`.
3. Selecciona el archivo `.json`.
4. Confirma el aviso destructivo.

## Exportaciones Excel/CSV

CSV:

- Separador `;`.
- Numeros con coma visual al exportar.
- Compatible con Excel en Espana.

XLSX:

- Cuentas.
- Movimientos.
- Apuestas.
- MatchedBetting.
- Transferencias.
- Categorias.
- ResumenMensual.
- Estadisticas.

No hay sincronizacion directa con Excel porque requeriria nube, backend o permisos externos.
El flujo correcto es exportar/importar archivos.

## Errores frecuentes

### GitHub Actions falla en `npm install`

Prueba manualmente en Windows:

```powershell
npm install --legacy-peer-deps
```

Si falla por versiones `latest`, fija versiones concretas de Expo/React Native con:

```powershell
npx expo install --fix
```

### GitHub Actions falla en `expo prebuild`

Comprueba:

- `app.json` es valido.
- `package.json` no tiene dependencias rotas.
- No hay imports de paquetes no instalados.

### GitHub Actions falla en `pod install`

Reintenta el workflow. Si persiste, revisa el log de CocoaPods. Suele estar relacionado con
versiones de paquetes nativos.

### GitHub Actions falla en `xcodebuild`

Si ves errores Swift dentro de `expo-modules-core` parecidos a:

```text
ExpoReactDelegate.swift: error: call to main actor-isolated initializer
PersistentFileLog.swift: error: capture of non-sendable type
SwiftUIHostingView.swift: error: unknown attribute 'MainActor'
```

no es un problema de AltStore ni del `.ipa`. Es una incompatibilidad entre el SDK
de Expo/React Native instalado y la version de Xcode del runner. Usa `macos-26`
y Node 24 en el workflow.

Este workflow desactiva firma con:

```text
CODE_SIGNING_ALLOWED=NO
CODE_SIGNING_REQUIRED=NO
CODE_SIGN_IDENTITY=""
```

Si Xcode cambia comportamiento o algun target exige firma, la alternativa es generar el
proyecto iOS igualmente y ajustar el target nativo. No se debe usar un certificado de pago si
quieres mantener la restriccion de no pagar Apple Developer.

### AltStore dice que el IPA no es valido

Comprueba que el IPA contiene esta estructura:

```text
Payload/
  CapitalTrackerMB.app/
```

No debe contener una carpeta extra por encima de `Payload`.

### AltStore no encuentra AltServer

Prueba:

- Abre AltServer en Windows.
- Conecta el iPhone por USB.
- Acepta `Confiar en este ordenador`.
- Permite AltServer en el firewall.
- Usa iTunes/iCloud de Apple, no Microsoft Store, si hay problemas.

### Error de limite de apps o App IDs

Con Apple ID gratuita hay limites de Apple. AltStore indica que solo puedes tener un numero
limitado de apps sideloaded activas y App IDs registrados durante un periodo. Desactiva apps
que no uses desde AltStore o espera a que se libere el limite.

## Limitaciones que no se pueden saltar

- iOS siempre requiere firma para instalar una app.
- Sin Apple Developer de pago, AltStore firma con cuenta gratuita y caduca a los 7 dias.
- Sin Mac local, el build iOS debe hacerse en macOS remoto: GitHub Actions, MacStadium,
  Codemagic, Bitrise u otro CI con Xcode.
- AltStore PAL no es equivalente a AltStore Classic para instalar cualquier IPA.

## Referencias oficiales utiles

- Expo prebuild: https://docs.expo.dev/workflow/continuous-native-generation/
- GitHub hosted runners: https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job
- GitHub runner images/Xcode: https://github.com/actions/runner-images
- AltStore getting started: https://faq.altstore.io/altstore-classic/your-altstore
- AltStore troubleshooting: https://faq.altstore.io/altstore-classic/troubleshooting-guide

# Capital Tracker MB

App nativa iOS personal para registrar capital, cuentas, movimientos, apuestas y matched betting.

## Desarrollo

```powershell
npm install --legacy-peer-deps
npm start
```

## IPA para AltStore

La guia completa esta en:

```text
docs/FASE6_IPA_ALTSTORE.md
```

El workflow de GitHub Actions esta en:

```text
.github/workflows/ios-unsigned-ipa.yml
```

El flujo previsto es:

1. Subir el repo a GitHub.
2. Ejecutar `Build unsigned iOS IPA`.
3. Descargar `CapitalTrackerMB-unsigned.ipa`.
4. Instalarlo con AltStore/AltServer.
5. Refrescarlo antes de 7 dias con AltStore.

## Datos

Todo se guarda localmente en SQLite dentro del iPhone. No hay backend, Firebase,
Supabase ni sincronizacion directa con Excel. La app exporta CSV, XLSX y backups JSON.

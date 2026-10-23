# claim: endurecimiento-hd

- ID: SEG
- Fecha: 2026-10-23 13:40 (Europe/Madrid)
- Rutas: src/app/api/campaigns/route.ts, src/app/api/settings/route.ts, src/app/api/models/route.ts, src/lib/net/access.ts
- Detalle: HD3/HD4 (tarea del ROADMAP asignada a SEG). Alinea el orden de barreras de las mutaciones al canónico 403→429→401→413: en campaigns se añade el bucket `admin:` ANTES de la comparación del token (cierra el oráculo de fuerza bruta de ADMIN_TOKEN — hoy el 401 llega sin consumir cubo) y se reordenan settings/models (el cuerpo se parseaba antes del 401/429). autopilot ya es canónico; auth conserva 413 antes de 401 por inherencia (el token viaja en el cuerpo). Excepción de zona: los route handlers son de IMP-1; fix mínimo de seguridad con claim, tal como permite OWNERSHIP.

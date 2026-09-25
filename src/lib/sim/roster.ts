import type { AgentDef, ScenarioDef } from './types'

// ─────────────────────────────────────────────────────────────
// ROSTER — Equipo RED (ofensiva)
// ─────────────────────────────────────────────────────────────
export const RED_AGENTS: AgentDef[] = [
  {
    key: 'red-cerberus',
    codename: 'CERBERUS',
    team: 'RED',
    role: 'Comandante Ofensivo',
    specialty: 'Coordinación de campañas y asignación de objetivos',
    icon: 'skull',
    description:
      'Planifica la campaña completa, prioriza vectores de ataque y decide el momento de cada fase. Aprende de fracasos previos para reordenar la estrategia.',
    phases: ['ARMADO'],
  },
  {
    key: 'red-spectre',
    codename: 'SPECTRE',
    team: 'RED',
    role: 'Reconocimiento y OSINT',
    specialty: 'Fingerprinting, superficie de ataque y enumeración pasiva',
    icon: 'radar',
    description:
      'Cartografía la infraestructura víctima sin ser detectado: subdominios, servicios expuestos, credenciales filtradas y tecnologías obsoletas.',
    phases: ['RECON'],
  },
  {
    key: 'red-viper',
    codename: 'VIPER',
    team: 'RED',
    role: 'Intrusión Inicial',
    specialty: 'Explotación de perimeter, phishing y weaponización',
    icon: 'crosshair',
    description:
      'Especialista en conseguir el primer acceso: explota vulnerabilidades de borde, lanza campañas de ingeniería social y evade filtros de correo.',
    phases: ['INTRUSION'],
  },
  {
    key: 'red-hydra',
    codename: 'HYDRA',
    team: 'RED',
    role: 'Escalada y Movimiento Lateral',
    specialty: 'Escalada de privilegios, robo de credenciales y pivoting',
    icon: 'gitbranch',
    description:
      'Una vez dentro, se propaga como hidra: roba hashes, abusa de misconfigurations de AD y se mueve entre segmentos buscando activos críticos.',
    phases: ['ESCALADA', 'LATERAL'],
  },
  {
    key: 'red-phantom',
    codename: 'PHANTOM',
    team: 'RED',
    role: 'Exfiltración y Persistencia',
    specialty: 'Exfiltración encubierta, C2 y destrucción de evidencias',
    icon: 'ghost',
    description:
      'Ejecuta el golpe final: establece persistencia, canaliza datos por túneles cifrados y borra huellas para maximizar el impacto.',
    phases: ['OBJETIVO'],
  },
]

// ─────────────────────────────────────────────────────────────
// ROSTER — Equipo BLUE (defensa)
// ─────────────────────────────────────────────────────────────
export const BLUE_AGENTS: AgentDef[] = [
  {
    key: 'blue-aegis',
    codename: 'AEGIS',
    team: 'BLUE',
    role: 'Comandante Defensivo',
    specialty: 'Dirección de la postura de seguridad y priorización de riesgos',
    icon: 'shield',
    description:
      'Coordina la defensa global: decide dónde invertir controles, gestiona el hardening y lidera la respuesta cuando el rojo ya está dentro.',
    phases: ['RECON', 'ARMADO'],
  },
  {
    key: 'blue-oracle',
    codename: 'ORACLE',
    team: 'BLUE',
    role: 'Detección y SIEM',
    specialty: 'Correlación de logs, reglas Sigma y análisis de anomalías',
    icon: 'activity',
    description:
      'Los ojos del SOC: afina reglas de correlación, reduce falsos positivos y caza señales tenues de reconocimiento antes de que escalen.',
    phases: ['RECON', 'INTRUSION'],
  },
  {
    key: 'blue-bastion',
    codename: 'BASTION',
    team: 'BLUE',
    role: 'Hardening y Respuesta',
    specialty: 'Parcheo, segmentación y contención de incidentes',
    icon: 'lock',
    description:
      'Blinda la infraestructura: cierra puertos, aplica parches críticos, aísla hosts comprometidos y corta comunicaciones de C2.',
    phases: ['ESCALADA', 'OBJETIVO'],
  },
  {
    key: 'blue-argus',
    codename: 'ARGUS',
    team: 'BLUE',
    role: 'Vigilancia de Red',
    specialty: 'NDR, análisis de tráfico y detección de túneles',
    icon: 'eye',
    description:
      'Vigila cada paquete: detecta escaneos, beaconing de malware y exfiltración por DNS o HTTPS inspectando patrones de tráfico.',
    phases: ['INTRUSION', 'LATERAL'],
  },
  {
    key: 'blue-sentinel',
    codename: 'SENTINEL',
    team: 'BLUE',
    role: 'Threat Hunting y Forense',
    specialty: 'Caza proactiva de amenazas y análisis forense',
    icon: 'flashlight',
    description:
      'No espera alertas: busca al adversario con hipótesis, analiza artefactos en endpoints y reconstruye la cadena de ataque para prevenir la siguiente campaña.',
    phases: ['LATERAL', 'OBJETIVO'],
  },
]

// ─────────────────────────────────────────────────────────────
// ESCENARIOS — Infraestructuras empresariales variables
// ─────────────────────────────────────────────────────────────
export const SCENARIOS: ScenarioDef[] = [
  {
    key: 'fincorp-bank',
    codename: 'OPÉRACION ÁBACO',
    company: 'FinCorp Bank',
    industry: 'Banca y Fintech',
    difficulty: 4,
    description:
      'Entidad bancaria con portal web de clientes, core bancario sobre base de datos SQL, Active Directory corporativo y endpoint de pagos. Cumplimiento PCI-DSS estricto.',
    redObjective:
      'Exfiltrar registros de tarjetas desde el core bancario (db-core) y mantener persistencia en el AD.',
    blueObjective:
      'Proteger db-core y el AD, detectar el reconocimiento temprano y contener cualquier movimiento lateral.',
    infrastructure: {
      nodes: [
        { id: 'fw-edge', name: 'Firewall Perimetral', type: 'VPN', ip: '10.0.0.1', segment: 'DMZ', criticality: 5, vulnerabilities: ['Regla de NAT permisiva'], controls: ['IPS activo', 'Geo-bloqueo'] },
        { id: 'web-portal', name: 'Portal Clientes', type: 'WEB', ip: '10.0.1.10', segment: 'DMZ', criticality: 4, vulnerabilities: ['WAF sin reglas custom', 'TLS 1.0 habilitado'], controls: ['WAF básico'] },
        { id: 'app-pagos', name: 'AppServidor de Pagos', type: 'APP', ip: '10.0.2.20', segment: 'CORE', criticality: 4, vulnerabilities: ['Dependencias sin parchear'], controls: ['Escaneo trimestral'] },
        { id: 'db-core', name: 'Core Bancario SQL', type: 'DB', ip: '10.0.2.30', segment: 'CORE', criticality: 5, vulnerabilities: ['Cuentas de servicio con privilegios altos'], controls: ['Cifrado en reposo', 'Auditoría de accesos'] },
        { id: 'ad-corp', name: 'Active Directory', type: 'AD', ip: '10.0.3.10', segment: 'AD', criticality: 5, vulnerabilities: ['Contraseñas sin rotar de admins legacy'], controls: ['MFA en VPN', 'Tiering parcial'] },
        { id: 'siem', name: 'SIEM SOC', type: 'SIEM', ip: '10.0.3.40', segment: 'AD', criticality: 3, vulnerabilities: ['Logs de firewall no integrados'], controls: ['Alertas 24/7'] },
      ],
    },
  },
  {
    key: 'hospital-vitalis',
    codename: 'OPERACIÓN PULSO',
    company: 'Hospital Vitalis',
    industry: 'Sanidad',
    difficulty: 3,
    description:
      'Hospital regional con historia clínica electrónica, servidores de imagen diagnóstica (PACS), red de dispositivos médicos IoT y copias de seguridad locales. Disponibilidad crítica 24/7.',
    redObjective:
      'Cifrar el PACS y la HIS con ransomware y exfiltrar historias clínicas (db-his) antes del detonante.',
    blueObjective:
      'Garantizar continuidad asistencial: blindar db-his, segmentar IoT médico y verificar integridad de backups.',
    infrastructure: {
      nodes: [
        { id: 'vpn-acceso', name: 'VPN de Acceso Remoto', type: 'VPN', ip: '10.1.0.1', segment: 'DMZ', criticality: 4, vulnerabilities: ['Sin MFA', 'Firmware 2019'], controls: ['Portal cautivo'] },
        { id: 'his', name: 'HIS — Historia Clínica', type: 'APP', ip: '10.1.1.10', segment: 'CORE', criticality: 5, vulnerabilities: ['Sesiones sin expiración'], controls: ['Rol de acceso mínimo'] },
        { id: 'db-his', name: 'BD Historias Clínicas', type: 'DB', ip: '10.1.1.20', segment: 'CORE', criticality: 5, vulnerabilities: ['Snapshots sin cifrar'], controls: ['Backup diario'] },
        { id: 'pacs', name: 'PACS Imagen Diagnóstica', type: 'APP', ip: '10.1.2.10', segment: 'CORE', criticality: 4, vulnerabilities: ['DICOM sin autenticar'], controls: ['VLAN dedicada'] },
        { id: 'iot-medico', name: 'Dispositivos Médicos IoT', type: 'ENDPOINT', ip: '10.1.3.0/24', segment: 'OT', criticality: 4, vulnerabilities: ['OS sin parches por certificación'], controls: ['Monitorización pasiva'] },
        { id: 'backup', name: 'Servidor Backups', type: 'BACKUP', ip: '10.1.1.40', segment: 'AD', criticality: 5, vulnerabilities: ['Credenciales en script plano'], controls: ['Inmutabilidad 7 días'] },
      ],
    },
  },
  {
    key: 'enermax-grid',
    codename: 'OPERACIÓN TITANIO',
    company: 'EnerMax Grid',
    industry: 'Energía / OT Industrial',
    difficulty: 5,
    description:
      'Operador de red eléctrica con zona IT corporativa, DMZ industrial y red OT con SCADA, HMI e historiador de datos. Segregación IT/OT mediante jump host.',
    redObjective:
      'Alcanzar la red OT vía jump host, manipular el historiador SCADA (scada-historian) y preparar un sabotaje con persistencia en la HMI.',
    blueObjective:
      'Defender la frontera IT/OT: endurecer el jump host, monitorizar saltos y proteger la integridad del SCADA.',
    infrastructure: {
      nodes: [
        { id: 'vpn-remota', name: 'VPN Ingenieros', type: 'VPN', ip: '10.2.0.1', segment: 'DMZ', criticality: 4, vulnerabilities: ['Política de contraseñas débil'], controls: ['MFA SMS'] },
        { id: 'jump-host', name: 'Jump Host IT→OT', type: 'APP', ip: '10.2.1.10', segment: 'DMZ', criticality: 5, vulnerabilities: ['Java obsoleto', 'Clipboard bidireccional'], controls: ['PAM con grabación'] },
        { id: 'scada-historian', name: 'Historiador SCADA', type: 'OT', ip: '10.2.2.20', segment: 'OT', criticality: 5, vulnerabilities: ['Protocolo DNP3 sin cifrar'], controls: ['Unidirectional gateway parcial'] },
        { id: 'hmi', name: 'HMI de Control', type: 'OT', ip: '10.2.2.30', segment: 'OT', criticality: 5, vulnerabilities: ['Autologin operativo'], controls: ['Whitelisting de apps'] },
        { id: 'ad-enermax', name: 'AD Corporativo', type: 'AD', ip: '10.2.1.40', segment: 'AD', criticality: 4, vulnerabilities: ['Delegación Kerberos permisiva'], controls: ['EDR en servidores'] },
        { id: 'siem-ot', name: 'Monitorización OT', type: 'SIEM', ip: '10.2.1.50', segment: 'AD', criticality: 3, vulnerabilities: ['Sin visibilidad de protocolos industriales'], controls: ['NetFlow IT'] },
      ],
    },
  },
  {
    key: 'novaretail',
    codename: 'OPERACIÓN CENTINELA',
    company: 'NovaRetail',
    industry: 'E-commerce',
    difficulty: 2,
    description:
      'Tienda online de retail con catálogo web, pasarela de pago, API pública, CDN y CRM de clientes. Equipo de TI pequeño, deuda técnica moderada.',
    redObjective:
      'Robar la base de datos de clientes con tarjetas tokenizadas (db-pedidos) vía abuso de la API pública.',
    blueObjective:
      'Blindar la API pública, parchear el CMS del catálogo y vigilar patrones de scraping masivo.',
    infrastructure: {
      nodes: [
        { id: 'cdn-edge', name: 'CDN / Edge', type: 'CDN', ip: '10.3.0.1', segment: 'DMZ', criticality: 3, vulnerabilities: ['Rate limiting genérico'], controls: ['Anti-DDoS'] },
        { id: 'tienda-web', name: 'Tienda Web CMS', type: 'WEB', ip: '10.3.1.10', segment: 'DMZ', criticality: 4, vulnerabilities: ['Plugin CMS desactualizado'], controls: ['WAF gestionado'] },
        { id: 'api-publica', name: 'API Pública', type: 'API', ip: '10.3.1.20', segment: 'DMZ', criticality: 4, vulnerabilities: ['Endpoints sin throttle fino', 'BOLA en /pedidos/{id}'], controls: ['API Gateway'] },
        { id: 'db-pedidos', name: 'BD Pedidos y Clientes', type: 'DB', ip: '10.3.2.10', segment: 'CORE', criticality: 5, vulnerabilities: ['Backups en mismo segmento'], controls: ['Cifrado de columna PII'] },
        { id: 'crm', name: 'CRM Marketing', type: 'APP', ip: '10.3.2.20', segment: 'CORE', criticality: 3, vulnerabilities: ['Integración por webhooks HTTP'], controls: ['Revisión de accesos semestral'] },
        { id: 'endpoints-oficina', name: 'Endpoints Oficina', type: 'ENDPOINT', ip: '10.3.3.0/24', segment: 'AD', criticality: 2, vulnerabilities: ['AV sin EDR'], controls: ['Actualizaciones automáticas'] },
      ],
    },
  },
  {
    key: 'technova-saas',
    codename: 'OPERACIÓN HORIZONTE',
    company: 'TechNova SaaS',
    industry: 'Software / Cloud',
    difficulty: 3,
    description:
      'Startup SaaS multi-tenant con clúster Kubernetes, pipeline CI/CD, repositorio de código, pasarela de facturación y SSO corporativo.',
    redObjective:
      'Comprometer el pipeline CI/CD, robar secretos del clúster y exfiltrar datos de inquilinos (db-tenant).',
    blueObjective:
      'Asegurar la cadena de suministro: proteger el CI/CD, endurecer Kubernetes y rotar secretos expuestos.',
    infrastructure: {
      nodes: [
        { id: 'sso', name: 'SSO Corporativo', type: 'AD', ip: '10.4.0.10', segment: 'AD', criticality: 5, vulnerabilities: ['Tokens de servicio sin expiración'], controls: ['MFA hardware'] },
        { id: 'cicd', name: 'Pipeline CI/CD', type: 'APP', ip: '10.4.1.10', segment: 'CLOUD', criticality: 5, vulnerabilities: ['Secretos en variables de pipeline', 'Runners compartidos'], controls: ['Revisión de MR obligatoria'] },
        { id: 'k8s-cluster', name: 'Clúster Kubernetes', type: 'APP', ip: '10.4.1.20', segment: 'CLOUD', criticality: 5, vulnerabilities: ['RBAC amplio', 'Pods root permitidos'], controls: ['Network policies parciales'] },
        { id: 'db-tenant', name: 'BD Multi-tenant', type: 'DB', ip: '10.4.2.10', segment: 'CORE', criticality: 5, vulnerabilities: ['Row-level security desactivada'], controls: ['Cifrado en reposo'] },
        { id: 'billing', name: 'Pasarela Facturación', type: 'API', ip: '10.4.2.20', segment: 'CORE', criticality: 4, vulnerabilities: ['Webhooks sin firma'], controls: ['Auditoría de transacciones'] },
        { id: 'repo-codigo', name: 'Repositorio Código', type: 'APP', ip: '10.4.1.30', segment: 'CLOUD', criticality: 4, vulnerabilities: ['Pat tokens de larga vida'], controls: ['Branch protection'] },
      ],
    },
  },
  {
    key: 'aerodefense-labs',
    codename: 'OPERACIÓN SIGILO',
    company: 'AeroDefense Labs',
    industry: 'Industria de Defensa',
    difficulty: 5,
    description:
      'Laboratorio aeroespacial con documentación clasificada en PLM, estaciones de diseño CAD, zona OT de pruebas y acceso VPN para socios externos. Objetivo de espionaje industrial.',
    redObjective:
      'Infiltrarse vía socio externo, escalar hasta el PLM y exfiltrar planos clasificados (plm-clasificados) sin disparar alarmas.',
    blueObjective:
      'Defender la propiedad intelectual: segmentar red de socios, controlar el DLP y detectar el movimiento lateral hacia el PLM.',
    infrastructure: {
      nodes: [
        { id: 'vpn-socios', name: 'VPN Socios Externos', type: 'VPN', ip: '10.5.0.1', segment: 'DMZ', criticality: 4, vulnerabilities: ['Confianza amplia a socios'], controls: ['NAC por certificado'] },
        { id: 'estaciones-cad', name: 'Estaciones CAD', type: 'ENDPOINT', ip: '10.5.1.0/24', segment: 'CORE', criticality: 4, vulnerabilities: ['USB habilitados', 'Licencias flotantes expuestas'], controls: ['Inventario estricto'] },
        { id: 'plm-clasificados', name: 'PLM Documentación Clasificada', type: 'DB', ip: '10.5.2.10', segment: 'CORE', criticality: 5, vulnerabilities: ['Acceso directo desde CAD sin broker'], controls: ['DLP en endpoints', 'Marcaje de documentos'] },
        { id: 'ad-labs', name: 'AD Laboratorio', type: 'AD', ip: '10.5.1.10', segment: 'AD', criticality: 5, vulnerabilities: ['GPO legacy con logon scripts'], controls: ['LAPS parcial'] },
        { id: 'ot-pruebas', name: 'Banco de Pruebas OT', type: 'OT', ip: '10.5.3.10', segment: 'OT', criticality: 4, vulnerabilities: ['Telemetría sin autenticar'], controls: ['Diodo de datos'] },
        { id: 'soc-forense', name: 'SOC y Forense', type: 'SIEM', ip: '10.5.1.60', segment: 'AD', criticality: 3, vulnerabilities: ['Retención de logs 30 días'], controls: ['Hunting semanal'] },
      ],
    },
  },
]

# Metodología de análisis de criticidad (MC-1.0)

Semicuantitativa, configurable desde **Configuración** (pesos, umbrales) y versionada (cada evaluación guarda la versión usada).

## Criterios y escala (1 = menor, 5 = mayor)
| Criterio | Grupo | Peso | 1 → 5 |
|---|---|---|---|
| Seguridad de las personas | Consecuencia | 3 | Sin lesión → Fatalidad posible |
| Impacto ambiental | Consecuencia | 2 | Sin impacto → Daño grave/sanción |
| Impacto en producción | Consecuencia | 3 | Sin efecto → Parada de planta |
| Impacto en calidad | Consecuencia | 1.5 | Sin efecto → Producto defectuoso liberado |
| Consecuencias económicas | Consecuencia | 2 | < 1 SMMLV → > 100 SMMLV |
| Tiempo de recuperación | Consecuencia | 1.5 | < 1 h → > 7 días |
| Disponibilidad de repuestos | Consecuencia | 1 | En almacén → Descontinuado |
| Redundancia | Consecuencia | 1.5 | Respaldo automático → Sin respaldo |
| Personal especializado | Consecuencia | 1 | Propio entrenado → Fabricante externo |
| Dependencia de otros equipos | Consecuencia | 1 | Ninguno → Toda la planta |
| Pérdida de función | Consecuencia | 1.5 | Insignificante → Catastrófica |
| Frecuencia / probabilidad de falla | Probabilidad | 1 | < 1 en 5 años → Mensual o más |

## Cálculo
- **IC** = promedio ponderado de criterios de consecuencia **conocidos**.
- **IP** = promedio ponderado de criterios de probabilidad conocidos.
- **Puntaje = IC × IP** (1–25).
- Clasificación (umbrales configurables): **≥16 Muy alta · ≥10 Alta · ≥5 Media · <5 Baja**.

## Reglas especiales (no se ocultan en el promedio)
- Seguridad o Ambiental = 5 ⇒ **Muy alta** como mínimo.
- Seguridad o Ambiental = 4 ⇒ **Alta** como mínimo.

## Información desconocida
- Se registra como «Desconocido»; **no** se asume 1 ni 0.
- Si faltan más del 40 % de los criterios (configurable) o no hay ningún dato de consecuencia o de probabilidad ⇒ **Pendiente de evaluación** (salvo que una regla especial ya exija Alta/Muy alta).
- Si falta algún criterio o se marca «preliminar» (sin historial de fallas) ⇒ resultado **provisional**.

## Registro
Puntajes por criterio, justificación técnica (obligatoria), evidencia, evaluador, fecha, versión de metodología, IC, IP, puntaje, resultado, regla aplicada, fecha de revisión. Reevaluar crea un registro nuevo y marca el anterior como no vigente (historial completo). Componentes y activos padre se evalúan de forma independiente.

La **condición física** (inspecciones) es independiente de la criticidad: un equipo puede estar en condición crítica y tener criticidad baja, o viceversa.

# Metodología de codificación de activos

## Tres identificadores, tres propósitos
| Identificador | Ejemplo | Quién lo asigna | ¿Cambia? |
|---|---|---|---|
| **ID interno** | `ACT-000125` | El servidor, automáticamente | **Nunca.** Todas las relaciones, fotos, carpetas y el QR apuntan aquí. |
| **Código visible** | `T380-MOT-003` | Sugerido por la app, confirmado por el usuario | Puede cambiar (reubicación, reclasificación). Se audita. |
| **Código anterior** | `JAB-MACP-16`, `LAB-01-JAB` | Importación / usuario | Se conserva como histórico. |

## Estructura del código visible
```
<ÁREA>-<FAMILIA>-<NNN>            Equipo o máquina         T380-MOT-003
<CÓDIGO PADRE>-<NN>               Conjunto / componente    T380-MOT-003-01
<CÓDIGO PADRE>-<NN>-<NN>          Pieza                    T380-MOT-003-01-02
PRB-...                           Registros de prueba      PRB-T230-MOT-001
```
**Áreas:** T230 (Tren de laminación 230), T380 (Tren 380), PAT (Patio y alistamiento), TAL (Taller), TDE (Trefilado/Doblado/Electrosoldado), LAB (Laboratorio), ADM (Administrativa), BAD/BPL (Bienestar).

**Familias:** MOT motor eléctrico · RED reductor · ACO acoplamiento · ROD rodamiento · BOM bomba · HID hidráulico · VAL válvula · CMP compresor · HOR horno/quemador · TAB tablero · GRU puente grúa · MAQ máquina herramienta · LAM laminación (castillo, caja trío, volante) · SOL soldadura/corte · VEH vehículo · INS instrumento · MOB mobiliario · COM cómputo · SIS sistema · EQP genérico.

## Reglas
1. Códigos únicos (validación en app y servidor, sin distinguir mayúsculas).
2. Un activo trasladado **conserva** su ID; si su código deja de representar la ubicación, se asigna uno nuevo y el anterior queda en la auditoría.
3. El QR contiene la URL `…/#/activo/ACT-000125` (ID inmutable): no hay que reimprimir etiquetas al recodificar.
4. Los activos importados entran **sin código visible** (solo código anterior). El código nuevo se asigna al verificar en campo (campo «Código asignado»), cuando se confirma la ubicación real.
5. Un componente compartido (p. ej. acoplamiento motor-reductor) tiene **un solo código**; su vínculo con el segundo equipo se registra como relación funcional, no duplicándolo.

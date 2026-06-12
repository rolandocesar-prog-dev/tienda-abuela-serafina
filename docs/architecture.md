# Arquitectura

## Diagrama (Mermaid)

```mermaid
flowchart TB
    subgraph Cliente
        FE[Frontend HTML+JS<br/>:3000]
    end

    GW[Nginx Gateway<br/>:8000]

    subgraph Microservicios
        CAT[catalog :8001]
        ALM[almacen :8002]
        VEN[ventas :8003]
        COM[compras :8004]
        PAG[pagos :8005]
        FAC[facturacion :8006]
        RH[rrhh :8007]
    end

    subgraph BDs
        DBC[(catalog DB)]
        DBA[(almacen DB)]
        DBV[(ventas DB)]
        DBCO[(compras DB)]
        DBP[(pagos DB)]
        DBF[(facturacion DB)]
        DBR[(rrhh DB)]
    end

    STRIPE([Stripe API])

    FE --> GW
    GW --> CAT & ALM & VEN & COM & PAG & FAC & RH

    CAT --> DBC
    ALM --> DBA
    VEN --> DBV
    COM --> DBCO
    PAG --> DBP
    FAC --> DBF
    RH --> DBR

    VEN -->|HTTP| CAT
    VEN -->|HTTP| ALM
    VEN -->|HTTP| PAG
    VEN -->|HTTP| FAC

    COM -->|HTTP| ALM
    COM -->|HTTP| PAG

    PAG -->|tarjeta| STRIPE
```

## Decisiones de diseño

### Por qué un BD por servicio
Cada servicio es desplegable independientemente. Si compartiéramos BD, una migración del servicio A podría romper al B.

### Por qué orquestación en Ventas (no coreografía/eventos)
El alcance del MVP no justifica el broker. El endpoint `POST /ventas` hace el orquestaje sincronicamente. La compensación (revertir movimientos) la maneja el mismo servicio.

### Por qué tabla `agencias` local en cada servicio
Las agencias son datos de lookup que cambian raras veces. Replicarlas evita una llamada HTTP en el camino crítico de cada operación. El seed se ejecuta en el lifespan del servicio y es idempotente.

### Numeración de facturas
Cada agencia mantiene su propio contador (`ContadorFactura.ultimo`). El formato es `<codigo_agencia>-<correlativo 8 dígitos>`, ej `A001-00000001`. La operación debe ser atómica (SELECT FOR UPDATE) para evitar duplicados bajo carga.

### Stripe en modo test
Cuando `metodo == "tarjeta"`, Pagos crea un PaymentIntent y devuelve el `client_secret`. El frontend (en una integración real) usaría Stripe Elements para confirmarlo. Para el MVP el webhook actualiza el estado.

### Sin auth — por qué
Excluido explícitamente por el docente. Toda llamada se considera confiable y proviene del gateway o del frontend en localhost.

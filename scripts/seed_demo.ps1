# =============================================================================
# seed_demo.ps1 — Datos de prueba para Tienda Abuela Serafina
# Uso: .\scripts\seed_demo.ps1
# Requiere: stack corriendo en http://localhost:8000
# Es idempotente: reintentarlo no duplica datos (409 se ignora).
# =============================================================================

$BASE = "http://localhost:8000"
$DIRECT = @{
    auth         = "http://localhost:8006"
    product      = "http://localhost:8001"
    inventory    = "http://localhost:8002"
    customer     = "http://localhost:8004"
    company      = "http://localhost:8007"
}

# Agencia semilla (definida en inventory/seed.py)
$AGENCIA_A001 = "660e8400-e29b-41d4-a716-446655440001"
$AGENCIA_A002 = "660e8400-e29b-41d4-a716-446655440002"
$AGENCIA_A003 = "660e8400-e29b-41d4-a716-446655440003"

function Invoke-Api {
    param($Method, $Uri, $Body, $Headers)
    try {
        $params = @{ Method = $Method; Uri = $Uri; ContentType = "application/json" }
        if ($Body)    { $params.Body    = ($Body | ConvertTo-Json -Depth 5) }
        if ($Headers) { $params.Headers = $Headers }
        return Invoke-RestMethod @params
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 409) {
            Write-Host "  [ya existe, ok]" -ForegroundColor DarkGray
            return $null
        }
        Write-Host "  [ERROR $status] $($_.ErrorDetails.Message)" -ForegroundColor Red
        return $null
    }
}

# =============================================================================
# 1. AUTH — registrar admin de demo
# =============================================================================
Write-Host "`n[1] AUTH" -ForegroundColor Cyan
$reg = Invoke-Api -Method Post -Uri "$($DIRECT.auth)/auth/register" -Body @{
    username = "seed_admin"
    email    = "seed_admin@tienda.com"
    password = "Admin1234!"
    rol      = "Administrador"
}
if ($reg) { Write-Host "  Usuario seed_admin creado: $($reg.id)" -ForegroundColor Green }

$login = Invoke-Api -Method Post -Uri "$($DIRECT.auth)/auth/login" -Body @{
    username = "seed_admin"
    password = "Admin1234!"
}
if (-not $login) { Write-Host "Login fallido. Abortando." -ForegroundColor Red; exit 1 }
$TOKEN = $login.access_token
$H = @{ Authorization = "Bearer $TOKEN" }
Write-Host "  Token obtenido OK" -ForegroundColor Green

# =============================================================================
# 2. COMPANY — empresa principal + sucursales
# =============================================================================
Write-Host "`n[2] COMPANY" -ForegroundColor Cyan
$company = Invoke-Api -Method Post -Uri "$($DIRECT.company)/companies" -Body @{
    nombre = "Abuela Serafina S.R.L."
    nit    = "1234567890"
} -Headers $H
if ($company) {
    Write-Host "  Empresa creada: $($company.id)" -ForegroundColor Green
    $CID = $company.id

    $branches = @(
        @{ nombre = "Sucursal La Paz Centro";  ciudad = "La Paz";       direccion = "Av. Mariscal Santa Cruz 123" }
        @{ nombre = "Sucursal Santa Cruz";     ciudad = "Santa Cruz";   direccion = "Av. San Martín 456" }
        @{ nombre = "Sucursal Cochabamba";     ciudad = "Cochabamba";   direccion = "Av. Heroínas 789" }
    )
    foreach ($b in $branches) {
        $br = Invoke-Api -Method Post -Uri "$($DIRECT.company)/companies/$CID/branches" -Body $b -Headers $H
        if ($br) { Write-Host "  Branch: $($br.nombre)" -ForegroundColor Green }
    }
} else {
    Write-Host "  [empresa ya existía, continuando]" -ForegroundColor DarkGray
}

# =============================================================================
# 3. PRODUCTS — catálogo base de tienda de barrio
# =============================================================================
Write-Host "`n[3] PRODUCTS" -ForegroundColor Cyan
$productos = @(
    @{ codigo="P001"; nombre="Arroz Grano Largo";  categoria="Granos";    unidad_medida="kg";  precio_base=8.50  }
    @{ codigo="P002"; nombre="Azúcar Blanca";       categoria="Granos";    unidad_medida="kg";  precio_base=6.00  }
    @{ codigo="P003"; nombre="Aceite de Soya 1L";   categoria="Aceites";   unidad_medida="lt";  precio_base=12.50 }
    @{ codigo="P004"; nombre="Harina de Trigo";     categoria="Harinas";   unidad_medida="kg";  precio_base=5.00  }
    @{ codigo="P005"; nombre="Fideos Spaghetti";    categoria="Pastas";    unidad_medida="kg";  precio_base=7.00  }
    @{ codigo="P006"; nombre="Sal Yodada";          categoria="Condimentos";unidad_medida="kg"; precio_base=2.50  }
    @{ codigo="P007"; nombre="Leche Entera 1L";     categoria="Lacteos";   unidad_medida="lt";  precio_base=9.00  }
    @{ codigo="P008"; nombre="Pan de Molde";        categoria="Panaderia"; unidad_medida="unid";precio_base=11.00 }
)

$prod_ids = @{}
foreach ($p in $productos) {
    $r = Invoke-Api -Method Post -Uri "$($DIRECT.product)/products" -Body $p -Headers $H
    if ($r) {
        $prod_ids[$p.codigo] = $r.id
        Write-Host "  $($p.codigo) $($p.nombre): $($r.id)" -ForegroundColor Green
    } else {
        # Ya existe — obtener el id
        $lista = Invoke-RestMethod -Uri "$($DIRECT.product)/products?codigo=$($p.codigo)" -Headers $H
        if ($lista) { $prod_ids[$p.codigo] = $lista[0].id }
    }
}

# =============================================================================
# 4. INVENTORY — stock inicial en 3 agencias
# =============================================================================
Write-Host "`n[4] INVENTORY - carga inicial de stock" -ForegroundColor Cyan
$stock = @(
    # agencia, producto, cantidad
    @($AGENCIA_A001, "P001", 150), @($AGENCIA_A001, "P002", 200), @($AGENCIA_A001, "P003", 80)
    @($AGENCIA_A001, "P004", 100), @($AGENCIA_A001, "P005", 120), @($AGENCIA_A001, "P006", 300)
    @($AGENCIA_A001, "P007", 60),  @($AGENCIA_A001, "P008", 50)
    @($AGENCIA_A002, "P001", 100), @($AGENCIA_A002, "P002", 150), @($AGENCIA_A002, "P003", 60)
    @($AGENCIA_A002, "P004", 80),  @($AGENCIA_A002, "P005", 90),  @($AGENCIA_A002, "P007", 40)
    @($AGENCIA_A003, "P001", 80),  @($AGENCIA_A003, "P002", 100), @($AGENCIA_A003, "P003", 50)
    @($AGENCIA_A003, "P006", 200), @($AGENCIA_A003, "P008", 30)
)

foreach ($entry in $stock) {
    $agencia_id = $entry[0]
    $codigo     = $entry[1]
    $cantidad   = $entry[2]
    $prod_id    = $prod_ids[$codigo]
    if (-not $prod_id) { Write-Host "  Sin id para $codigo, saltando" -ForegroundColor Yellow; continue }

    $r = Invoke-Api -Method Post -Uri "$($DIRECT.inventory)/inventory/input" -Body @{
        agencia_id = $agencia_id
        producto_id = $prod_id
        cantidad    = $cantidad
        referencia  = "seed_demo"
    } -Headers $H
    if ($r) { Write-Host "  +$cantidad $codigo -> agencia $agencia_id" -ForegroundColor Green }
}

# =============================================================================
# 5. CUSTOMERS — clientes de ejemplo
# =============================================================================
Write-Host "`n[5] CUSTOMERS" -ForegroundColor Cyan
$clientes = @(
    @{ nombre="María García";    ci_nit="1234567";  email="maria@gmail.com";  telefono="70012345" }
    @{ nombre="Carlos Mamani";   ci_nit="2345678";  email="carlos@gmail.com"; telefono="71023456" }
    @{ nombre="Rosa Quispe";     ci_nit="3456789";  email="rosa@gmail.com";   telefono="72034567" }
    @{ nombre="Juan Condori";    ci_nit="4567890";  email="juan@gmail.com";   telefono="73045678" }
    @{ nombre="Empresa XYZ";     ci_nit="9876543210"; email="compras@xyz.com"; telefono="22334455" }
)

foreach ($c in $clientes) {
    $r = Invoke-Api -Method Post -Uri "$($DIRECT.customer)/customers" -Body $c -Headers $H
    if ($r) { Write-Host "  $($r.nombre): $($r.id)" -ForegroundColor Green }
}

# =============================================================================
# RESUMEN
# =============================================================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Seed completado." -ForegroundColor Green
Write-Host "  Gateway:   $BASE" -ForegroundColor White
Write-Host "  Token:     $TOKEN" -ForegroundColor White
Write-Host "============================================`n" -ForegroundColor Cyan

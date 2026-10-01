<#
.SYNOPSIS
    Dupliceert een Antigravity project inclusief governance, permissies en platformfunctionaliteit,
    zonder vervuiling van caches (node_modules, .next, oude databases).

.EXAMPLE
    .\scripts\dupliceer_project.ps1 -NieuwProjectNaam "home_furnishing_portal"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$NieuwProjectNaam,

    [string]$BronProject = "EasyQuotes",

    [switch]$AlleenGovernance
)

$RootDir = "C:\Users\gaspa\Documents\antigravity"
$BronPad = Join-Path $RootDir $BronProject
$DoelPad = Join-Path $RootDir $NieuwProjectNaam

if (-not (Test-Path $BronPad)) {
    Write-Error "Bronproject $BronPad bestaat niet!"
    exit 1
}

if (Test-Path $DoelPad) {
    Write-Warning "Doelmap $DoelPad bestaat al. Bestaande bestanden worden behouden of bijgewerkt."
} else {
    New-Item -ItemType Directory -Path $DoelPad -Force | Out-Null
    Write-Host "Map aangemaakt: $DoelPad" -ForegroundColor Green
}

# 1. Kopiëer Governance (.agents/)
Write-Host "Kopiëren van .agents/ (subagents, skills, rules, workflows)..." -ForegroundColor Cyan
$BronAgents = Join-Path $BronPad ".agents"
$DoelAgents = Join-Path $DoelPad ".agents"
if (Test-Path $BronAgents) {
    Copy-Item -Path $BronAgents -Destination $DoelPad -Recurse -Force
}

# 2. Garandeer Permissions.json (Zero-Trust bypass voor soepel werken)
$PermJson = @'
{
  "allow": [
    "command(*)",
    "read_file(*)",
    "write_file(*)",
    "mcp(*)"
  ],
  "ask": [],
  "deny": [
    "command(rm -rf /)",
    "command(rm -rf *)",
    "command(mkfs)",
    "command(dd)"
  ]
}
'@
$DoelPermFile = Join-Path $DoelAgents "permissions.json"
Set-Content -Path $DoelPermFile -Value $PermJson -Encoding UTF8
Write-Host "Permissies geconfigureerd in $DoelPermFile (geen vervelende popups meer)." -ForegroundColor Green

# 3. Kopiëer Platformfundering indien gewenst
if (-not $AlleenGovernance) {
    Write-Host "Kopiëren van platformconfiguratie (Next.js, Tailwind, tsconfig)..." -ForegroundColor Cyan
    $Configs = @("package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "eslint.config.mjs", ".gitignore")
    foreach ($cfg in $Configs) {
        $src = Join-Path $BronPad $cfg
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $DoelPad -Force
        }
    }
    
    # Messages structuur voor meertaligheid
    $BronMessages = Join-Path $BronPad "messages"
    if (Test-Path $BronMessages) {
        Copy-Item -Path $BronMessages -Destination $DoelPad -Recurse -Force
    }
}

# 4. Git initialisatie indien nog niet aanwezig
$GitDir = Join-Path $DoelPad ".git"
if (-not (Test-Path $GitDir)) {
    git -C $DoelPad init -q
    Write-Host "Schone Git repository geïnitialiseerd." -ForegroundColor Green
}

Write-Host "`nKlaar! Project '$NieuwProjectNaam' is succesvol gedupliceerd." -ForegroundColor Green
Write-Host "Je kunt het nu direct openen in Antigravity 2.0 via 'File -> Create Project' (of map-icoontje)." -ForegroundColor Yellow

[CmdletBinding()]
param([switch]$VerifyOnly)

$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) {
    throw 'Visual Studio Build Tools bulunamadı.'
}
$instance = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $instance) {
    throw 'Visual Studio C++ bileşeni henüz tamamlanmamış. Visual Studio Installer durumunu kontrol edin.'
}

$devShell = Join-Path $instance 'Common7\Tools\Launch-VsDevShell.ps1'
& $devShell -Arch amd64 -HostArch amd64 -SkipAutomaticLocation

if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
    $userCargo = Join-Path $env:USERPROFILE '.cargo\bin'
    $tempToolchain = Join-Path $env:LOCALAPPDATA 'Temp\marbleos-studio-native-toolchain'
    if (Test-Path -LiteralPath (Join-Path $userCargo 'cargo.exe')) {
        $env:PATH = "$userCargo;$env:PATH"
    } elseif (Test-Path -LiteralPath (Join-Path $tempToolchain 'cargo\bin\cargo.exe')) {
        $env:CARGO_HOME = Join-Path $tempToolchain 'cargo'
        $env:RUSTUP_HOME = Join-Path $tempToolchain 'rustup'
        $env:PATH = "$($env:CARGO_HOME)\bin;$env:PATH"
    }
}

Get-Command cl.exe, link.exe, rc.exe, cargo.exe, rustc.exe -ErrorAction Stop | Out-Null
if ((rustc -vV | Select-String '^host:').Line -ne 'host: x86_64-pc-windows-msvc') {
    throw 'x64 Windows MSVC Rust araç zinciri gerekiyor.'
}

Push-Location -LiteralPath $studioRoot
try {
    if (-not (Test-Path -LiteralPath 'src-tauri/Cargo.lock')) {
        throw 'Cargo.lock bulunamadı. Önce Rust bağımlılıklarını çözümleyin.'
    }
    & npm.cmd run verify
    if ($LASTEXITCODE -ne 0) { throw 'Web kontrolleri geçmedi.' }
    cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features
    if ($LASTEXITCODE -ne 0) { throw 'SQLite ve Windows DPAPI testleri geçmedi.' }
    if ($VerifyOnly) {
        cargo check --locked --manifest-path src-tauri/Cargo.toml
        if ($LASTEXITCODE -ne 0) { throw 'Windows uygulaması derleme denetiminden geçmedi.' }
        return
    }
    & npm.cmd run tauri -- build --bundles nsis -- --locked
    if ($LASTEXITCODE -ne 0) { throw 'Kurulum paketi oluşturulamadı.' }

    $tauriCfg = Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json
    $expectedFilter = "*_$($tauriCfg.version)_x64-setup.exe"
    $bundles = @(Get-ChildItem -LiteralPath 'src-tauri/target/release/bundle/nsis' -Filter $expectedFilter -File)
    if ($bundles.Count -ne 1) { throw "Beklenen sürüm ($($tauriCfg.version)) x64 kurulum çıktısı bulunamadı." }
    Get-FileHash -LiteralPath $bundles[0].FullName -Algorithm SHA256
} finally {
    Pop-Location
}

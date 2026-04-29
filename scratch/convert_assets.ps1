[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$assetsDir = "d:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\src\assets"

function Convert-ToBmp($name) {
    $src = Join-Path $assetsDir "$name.png"
    $dest = Join-Path $assetsDir "$name.bmp"
    if (Test-Path $src) {
        $img = [System.Drawing.Image]::FromFile($src)
        $img.Save($dest, [System.Drawing.Imaging.ImageFormat]::Bmp)
        $img.Dispose()
        Write-Host "Converted $name.png to $name.bmp"
    } else {
        Write-Error "Source file not found: $src"
    }
}

Convert-ToBmp "installer_sidebar"
Convert-ToBmp "installer_header"

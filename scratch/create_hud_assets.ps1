[Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
$assetsDir = "d:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\src\assets"
$logoPath = Join-Path $assetsDir "kmti_logo.png"

function Create-HudAsset($name, $width, $height, $isHeader) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Background
    $bgColor = if ($isHeader) { [System.Drawing.Color]::White } else { [System.Drawing.ColorTranslator]::FromHtml('#f8fafc') }
    $g.Clear($bgColor)
    
    # HUD Corners/Lines
    $accentBlue = [System.Drawing.ColorTranslator]::FromHtml('#2563eb')
    $accentRed = [System.Drawing.ColorTranslator]::FromHtml('#e20000')
    $penBlue = New-Object System.Drawing.Pen($accentBlue, 1)
    $penRed = New-Object System.Drawing.Pen($accentRed, 1)
    
    if ($isHeader) {
        # Thin blue line at bottom
        $g.DrawLine($penBlue, 0, $height-1, $width, $height-1)
    } else {
        # HUD Corners (L-shapes)
        $len = 15
        # Top Left (Red)
        $g.DrawLine($penRed, 5, 5, 5+$len, 5)
        $g.DrawLine($penRed, 5, 5, 5, 5+$len)
        # Top Right (Blue)
        $g.DrawLine($penBlue, $width-5, 5, $width-5-$len, 5)
        $g.DrawLine($penBlue, $width-5, 5, $width-5, 5+$len)
        # Bottom Left (Blue)
        $g.DrawLine($penBlue, 5, $height-5, 5+$len, $height-5)
        $g.DrawLine($penBlue, 5, $height-5, 5, $height-5-$len)
        # Bottom Right (Red)
        $g.DrawLine($penRed, $width-5, $height-5, $width-5-$len, $height-5)
        $g.DrawLine($penRed, $width-5, $height-5, $width-5, $height-5-$len)
    }
    
    # Logo
    if (Test-Path $logoPath) {
        $logo = [System.Drawing.Image]::FromFile($logoPath)
        if ($isHeader) {
            # Scale logo for header (right aligned)
            $h = $height - 10
            $w = ($logo.Width / $logo.Height) * $h
            $g.DrawImage($logo, $width - $w - 5, 5, $w, $h)
        } else {
            # Scale logo for sidebar (centered top)
            $w = $width - 40
            $h = ($logo.Height / $logo.Width) * $w
            $g.DrawImage($logo, ($width - $w) / 2, 40, $w, $h)
        }
        $logo.Dispose()
    }
    
    # Save as BMP
    $dest = Join-Path $assetsDir "$name.bmp"
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created HUD Asset: $name.bmp"
}

# Create assets
Create-HudAsset "installer_sidebar" 164 314 $false
Create-HudAsset "installer_header" 150 57 $true

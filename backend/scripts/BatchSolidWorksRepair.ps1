# BatchSolidWorksRepair.ps1
# This script uses the SolidWorks API to batch-save files with embedded previews.
# REQUIRES: SolidWorks installed on the machine running this script.

param (
    [string]$Directory = "D:\RAYSAN\TEST SOLIDWORKS"
)

try {
    Write-Host "Connecting to SolidWorks..." -ForegroundColor Cyan
    $swApp = New-Object -ComObject SldWorks.Application
    if (-not $swApp) {
        Write-Error "Could not start SolidWorks. Make sure it is installed."
        return
    }
    $swApp.Visible = $true # Set to $false to run in background

    $files = Get-ChildItem -Path $Directory -Filter *.sld* -Recurse
    Write-Host "Found $($files.Count) SolidWorks files."

    foreach ($file in $files) {
        Write-Host "Processing: $($file.Name)..." -NoNewline
        
        $swError = 0
        $swWarning = 0
        $ext = [System.IO.Path]::GetExtension($file.FullName).ToLower()
        $type = 1 # Part
        if ($ext -eq ".sldasm") { $type = 2 }
        if ($ext -eq ".slddrw") { $type = 3 }

        # Open file
        $swDoc = $swApp.OpenDoc6($file.FullName, $type, 1, "", [ref]$swError, [ref]$swWarning)
        
        if ($swDoc) {
            # Force "Save preview image" setting for this document
            # 1 = Save preview image
            $swDoc.Extension.SetUserPreferenceInteger(1, 0, 1) 
            
            # Re-save to generate preview
            $saveRet = $swDoc.Save3(1, [ref]$swError, [ref]$swWarning)
            
            if ($saveRet) {
                Write-Host " [OK]" -ForegroundColor Green
            } else {
                Write-Host " [Save Failed: $swError]" -ForegroundColor Red
            }
            
            $swApp.CloseDoc($file.FullName)
        } else {
            Write-Host " [Open Failed: $swError]" -ForegroundColor Red
        }
    }

    Write-Host "Batch process complete!" -ForegroundColor Cyan
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    # Optional: $swApp.ExitApp()
}

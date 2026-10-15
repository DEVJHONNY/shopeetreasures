Add-Type -AssemblyName System.Drawing

function Create-AppIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [bool]$IsMaskable = $false,
        [bool]$RoundedCorners = $true
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Background
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $col1 = [System.Drawing.ColorTranslator]::FromHtml("#ff5722") # Bright Shopee Coral Orange
    $col2 = [System.Drawing.ColorTranslator]::FromHtml("#d73211") # Rich Deep Shopee Red-Orange
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $col1, $col2, 45.0

    if ($IsMaskable) {
        # Maskable fills entire canvas with gradient
        $g.FillRectangle($bgBrush, $rect)
    } else {
        if ($RoundedCorners) {
            # Rounded squircle for app icon
            $radius = [int]($Size * 0.22)
            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $diameter = $radius * 2
            $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
            $path.AddArc($Size - $diameter, 0, $diameter, $diameter, 270, 90)
            $path.AddArc($Size - $diameter, $Size - $diameter, $diameter, $diameter, 0, 90)
            $path.AddArc(0, $Size - $diameter, $diameter, $diameter, 90, 90)
            $path.CloseFigure()
            $g.FillPath($bgBrush, $path)
        } else {
            $g.FillRectangle($bgBrush, $rect)
        }
    }

    # Scale factor for central artwork
    # For maskable, keep within safe zone (60-65% of size)
    $artScale = if ($IsMaskable) { 0.60 } else { 0.72 }
    $artSize = $Size * $artScale
    $offsetX = ($Size - $artSize) / 2.0
    $offsetY = ($Size - $artSize) / 2.0

    # Draw Shopping Bag
    # Bag geometry relative to artSize:
    # Top handle: Y 0.08 to 0.32
    # Bag body: Y 0.30 to 0.95
    # Width top: 0.20 to 0.80
    # Width bottom: 0.14 to 0.86

    # 1. Handle Drop Shadow & Bag Drop Shadow
    $shadowColor = [System.Drawing.Color]::FromArgb(45, 0, 0, 0)
    $shadowBrush = New-Object System.Drawing.SolidBrush $shadowColor
    $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $sOffY = $artSize * 0.04
    $sOffX = 0

    $bp1 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.20 + $sOffX), ($offsetY + $artSize * 0.30 + $sOffY)
    $bp2 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.80 + $sOffX), ($offsetY + $artSize * 0.30 + $sOffY)
    $bp3 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.86 + $sOffX), ($offsetY + $artSize * 0.90 + $sOffY)
    $bp4 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.14 + $sOffX), ($offsetY + $artSize * 0.90 + $sOffY)
    $shadowPath.AddPolygon([System.Drawing.PointF[]]@($bp1, $bp2, $bp3, $bp4))
    $g.FillPath($shadowBrush, $shadowPath)

    # 2. Bag Handle (White arch)
    $handlePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ($artSize * 0.085)
    $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $hRect = New-Object System.Drawing.RectangleF ($offsetX + $artSize * 0.32), ($offsetY + $artSize * 0.06), ($artSize * 0.36), ($artSize * 0.44)
    $g.DrawArc($handlePen, $hRect, 180, 180)

    # 3. Bag Body (Crisp White with subtle inner gradient)
    $bagRect = New-Object System.Drawing.RectangleF ($offsetX + $artSize * 0.14), ($offsetY + $artSize * 0.28), ($artSize * 0.72), ($artSize * 0.65)
    $bagGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bagRect, ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), ([System.Drawing.Color]::FromArgb(255, 248, 248, 250)), 90.0

    $bagPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p1 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.20), ($offsetY + $artSize * 0.28)
    $p2 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.80), ($offsetY + $artSize * 0.28)
    $p3 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.86), ($offsetY + $artSize * 0.88)
    $p4 = New-Object System.Drawing.PointF ($offsetX + $artSize * 0.14), ($offsetY + $artSize * 0.88)
    $bagPath.AddPolygon([System.Drawing.PointF[]]@($p1, $p2, $p3, $p4))
    $g.FillPath($bagGrad, $bagPath)

    # 4. Bag Rim Accent line (very subtle top fold)
    $rimPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 235, 235, 240)), ($artSize * 0.02)
    $g.DrawLine($rimPen, $p1, $p2)

    # 5. Central Golden Treasure Star / Diamond Emblem (ShopeeTreasures "Treasure" mark)
    $centerX = $offsetX + ($artSize * 0.50)
    $centerY = $offsetY + ($artSize * 0.58)
    $starOuterR = $artSize * 0.23
    $starInnerR = $artSize * 0.10

    # Draw 8-point faceted diamond star
    $points = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for ($i = 0; $i -lt 16; $i++) {
        $angle = $i * [Math]::PI / 8.0 - ([Math]::PI / 2.0)
        $r = if ($i % 2 -eq 0) {
            if ($i % 4 -eq 0) { $starOuterR } else { $starOuterR * 0.62 }
        } else {
            $starInnerR
        }
        $px = $centerX + $r * [Math]::Cos($angle)
        $py = $centerY + $r * [Math]::Sin($angle)
        $points.Add((New-Object System.Drawing.PointF $px, $py))
    }

    $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $starPath.AddPolygon($points.ToArray())

    # Gold/Orange gradient for treasure star
    $starRect = New-Object System.Drawing.RectangleF ($centerX - $starOuterR), ($centerY - $starOuterR), ($starOuterR * 2), ($starOuterR * 2)
    $gold1 = [System.Drawing.ColorTranslator]::FromHtml("#ff9800")
    $gold2 = [System.Drawing.ColorTranslator]::FromHtml("#ee4d2d")
    $starGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $starRect, $gold1, $gold2, 45.0
    $g.FillPath($starGrad, $starPath)

    # Center sparkle glint
    $glintBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $glintSize = $starInnerR * 0.7
    $g.FillEllipse($glintBrush, ($centerX - $glintSize/2), ($centerY - $glintSize/2), $glintSize, $glintSize)

    # 6. Bottom Brand Accent Bar (Shopee Orange)
    $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#ee4d2d"))
    $barW = $artSize * 0.44
    $barH = $artSize * 0.04
    $barX = $centerX - ($barW / 2)
    $barY = $offsetY + ($artSize * 0.80)
    $g.FillRectangle($accentBrush, $barX, $barY, $barW, $barH)

    # Save PNG
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Saved: $OutputPath ($Size x $Size)"
}

$baseDir = "c:\Users\ROCHA\Documents\antigravity\shopee-afiliados\public\icons"

Create-AppIcon -Size 512 -OutputPath "$baseDir\icon-512.png" -IsMaskable $false -RoundedCorners $true
Create-AppIcon -Size 192 -OutputPath "$baseDir\icon-192.png" -IsMaskable $false -RoundedCorners $true
Create-AppIcon -Size 512 -OutputPath "$baseDir\icon-maskable-512.png" -IsMaskable $true -RoundedCorners $false
Create-AppIcon -Size 192 -OutputPath "$baseDir\icon-maskable-192.png" -IsMaskable $true -RoundedCorners $false
Create-AppIcon -Size 180 -OutputPath "$baseDir\apple-touch-icon.png" -IsMaskable $false -RoundedCorners $true
Create-AppIcon -Size 32  -OutputPath "$baseDir\favicon-32.png" -IsMaskable $false -RoundedCorners $true

# Also copy 180 as root apple-touch-icon and 32 as favicon
Copy-Item "$baseDir\apple-touch-icon.png" "c:\Users\ROCHA\Documents\antigravity\shopee-afiliados\public\apple-touch-icon.png" -Force
Copy-Item "$baseDir\favicon-32.png" "c:\Users\ROCHA\Documents\antigravity\shopee-afiliados\public\favicon.png" -Force

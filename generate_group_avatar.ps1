Add-Type -AssemblyName System.Drawing

function Create-GroupAvatar {
    param(
        [int]$Size = 800,
        [string]$OutputPath
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 1. Dark Deep Space Background with radial glow
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#060A09"))
    $g.FillRectangle($darkBrush, $rect)

    # 2. Outer circular ambient glow
    $center = $Size / 2.0
    $radius = $Size * 0.46
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(($center - $radius), ($center - $radius), ($radius * 2), ($radius * 2))
    
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $glowPath
    $glowBrush.CenterColor = [System.Drawing.ColorTranslator]::FromHtml("#FF5722")
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 6, 10, 9))
    $g.FillPath($glowBrush, $glowPath)

    # 3. Inner Dark Circular Container (WhatsApp Avatar Boundary)
    $circR = $Size * 0.44
    $circRect = New-Object System.Drawing.RectangleF ($center - $circR), ($center - $circR), ($circR * 2), ($circR * 2)
    $innerGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $circRect, ([System.Drawing.ColorTranslator]::FromHtml("#14201C")), ([System.Drawing.ColorTranslator]::FromHtml("#0C1311")), 90.0
    $g.FillEllipse($innerGrad, $circRect)

    # 4. Golden Ring Border
    $ringPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#F5B83D")), ($Size * 0.02)
    $g.DrawEllipse($ringPen, $circRect)

    # 5. Top Brand Label: SHOPEETREASURES
    $fontBrand = New-Object System.Drawing.Font "Arial Black", ($Size * 0.045), [System.Drawing.FontStyle]::Bold
    $brandBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FF8A65"))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("SHOPEETREASURES", $fontBrand, $brandBrush, $center, ($Size * 0.18), $sf)

    # 6. Center Shopping Bag Graphic
    $bagW = $Size * 0.36
    $bagH = $Size * 0.32
    $bagX = $center - ($bagW / 2)
    $bagY = $Size * 0.25

    # Bag Handle
    $hPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#FFFFFF")), ($Size * 0.035)
    $hPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $hRect = New-Object System.Drawing.RectangleF ($center - ($bagW * 0.22)), ($bagY - ($bagH * 0.32)), ($bagW * 0.44), ($bagH * 0.50)
    $g.DrawArc($hPen, $hRect, 180, 180)

    # Bag Body (Shopee Orange)
    $bagRect = New-Object System.Drawing.RectangleF $bagX, $bagY, $bagW, $bagH
    $bagGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bagRect, ([System.Drawing.ColorTranslator]::FromHtml("#FF5722")), ([System.Drawing.ColorTranslator]::FromHtml("#D73211")), 90.0
    
    $bagPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p1 = New-Object System.Drawing.PointF ($bagX + $bagW * 0.08), $bagY
    $p2 = New-Object System.Drawing.PointF ($bagX + $bagW * 0.92), $bagY
    $p3 = New-Object System.Drawing.PointF ($bagX + $bagW), ($bagY + $bagH)
    $p4 = New-Object System.Drawing.PointF $bagX, ($bagY + $bagH)
    $bagPath.AddPolygon([System.Drawing.PointF[]]@($p1, $p2, $p3, $p4))
    $g.FillPath($bagGrad, $bagPath)

    # Diamond / Flame Emblem on Bag
    $diamondW = $bagW * 0.30
    $diamondH = $bagH * 0.38
    $dY = $bagY + ($bagH * 0.32)
    $dPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d1 = New-Object System.Drawing.PointF $center, ($dY - $diamondH/2)
    $d2 = New-Object System.Drawing.PointF ($center + $diamondW/2), $dY
    $d3 = New-Object System.Drawing.PointF $center, ($dY + $diamondH/2)
    $d4 = New-Object System.Drawing.PointF ($center - $diamondW/2), $dY
    $dPath.AddPolygon([System.Drawing.PointF[]]@($d1, $d2, $d3, $d4))
    $goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#FFE082"))
    $g.FillPath($goldBrush, $dPath)

    # Sparkle glint
    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillEllipse($whiteBrush, ($center - 6), ($dY - 6), 12, 12)

    # 7. HUGE "VIP" TEXT
    $fontVip = New-Object System.Drawing.Font "Arial Black", ($Size * 0.16), [System.Drawing.FontStyle]::Bold
    
    # VIP Shadow
    $vipShadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 0, 0, 0))
    $g.DrawString("VIP", $fontVip, $vipShadowBrush, ($center + 4), ($Size * 0.61 + 4), $sf)
    
    # VIP Text (Bright White)
    $g.DrawString("VIP", $fontVip, $whiteBrush, $center, ($Size * 0.61), $sf)

    # 8. Pill Badge: "GRUPO #1"
    $pillW = $Size * 0.54
    $pillH = $Size * 0.13
    $pillX = $center - ($pillW / 2)
    $pillY = $Size * 0.72

    $pillRect = New-Object System.Drawing.RectangleF $pillX, $pillY, $pillW, $pillH
    $pillGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $pillRect, ([System.Drawing.ColorTranslator]::FromHtml("#34F59A")), ([System.Drawing.ColorTranslator]::FromHtml("#00A884")), 45.0
    
    $radiusPill = $pillH / 2.0
    $pillPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radiusPill * 2
    $pillPath.AddArc($pillX, $pillY, $diameter, $diameter, 180, 90)
    $pillPath.AddArc($pillX + $pillW - $diameter, $pillY, $diameter, $diameter, 270, 90)
    $pillPath.AddArc($pillX + $pillW - $diameter, $pillY + $pillH - $diameter, $diameter, $diameter, 0, 90)
    $pillPath.AddArc($pillX, $pillY + $pillH - $diameter, $diameter, $diameter, 90, 90)
    $pillPath.CloseFigure()
    
    # Pill Shadow
    $pillShadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 0, 0, 0))
    $g.FillPath($pillShadow, (New-Object System.Drawing.Drawing2D.GraphicsPath -ArgumentList @($pillPath)))
    $g.FillPath($pillGrad, $pillPath)

    # Pill Text: "GRUPO #1"
    $fontGrupo = New-Object System.Drawing.Font "Arial Black", ($Size * 0.065), [System.Drawing.FontStyle]::Bold
    $darkTextBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#060A09"))
    $g.DrawString("GRUPO #1", $fontGrupo, $darkTextBrush, $center, ($pillY + ($pillH / 2)), $sf)

    # 9. Small Bottom Trust: "ACHADINHOS & CUPONS"
    $fontSub = New-Object System.Drawing.Font "Arial", ($Size * 0.032), [System.Drawing.FontStyle]::Bold
    $subBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#98A6A0"))
    $g.DrawString("OFERTAS OFICIAIS VERIFICADAS", $fontSub, $subBrush, $center, ($Size * 0.89), $sf)

    # Save PNG
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Avatar criado com sucesso em: $OutputPath"
}

$out = "c:\Users\ROCHA\Documents\antigravity\shopee-afiliados\public\icons\foto-grupo-1.png"
Create-GroupAvatar -Size 1024 -OutputPath $out

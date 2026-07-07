Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class IconExtractor {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int PrivateExtractIcons(string szFileName, int nIconIndex, int cxIcon, int cyIcon, IntPtr[] phicon, int[] piconid, int nIcons, int flags);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}
"@

$exe = 'C:\Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe'
$size = 256
$icons = New-Object IntPtr[] 1
$ids = New-Object int[] 1
$count = [IconExtractor]::PrivateExtractIcons($exe, 0, $size, $size, $icons, $ids, 1, 0)
if ($count -le 0) { throw "No icon extracted from $exe" }

$icon = [System.Drawing.Icon]::FromHandle($icons[0])
$bmp = $icon.ToBitmap()
$out = Join-Path $PSScriptRoot '..\apps\web\public\static\app\icons\default\ps-photoshop-raw.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
[void][IconExtractor]::DestroyIcon($icons[0])
Write-Output "saved $($bmp.Width)x$($bmp.Height) -> $out"
& node (Join-Path $PSScriptRoot 'generate-ps-photoshop-icon.mjs')

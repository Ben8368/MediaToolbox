# Initialize the current Windows PowerShell session for UTF-8 input/output.
chcp 65001 > $null

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$global:OutputEncoding = $utf8NoBom
$env:PYTHONIOENCODING = "utf-8"

Write-Output "PowerShell UTF-8 console encoding initialized."

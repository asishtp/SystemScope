#Requires -Version 7.0
<#
.SYNOPSIS
  Send Azure SQL private-endpoint traffic through GlobalProtect.

  On a Lands office LAN, Windows prefers the local 10.0.0.0/8 route over the VPN
  default route, so sql-water-ws-dev.database.windows.net (10.195.170.19) never
  reaches Azure. Run this after GlobalProtect connects, then dotnet run.

.EXAMPLE
  .\database\Add-AzureSqlPrivateRoute.ps1
#>
[CmdletBinding()]
param(
    [string] $SqlPrivateIp = '10.195.170.19',
    [string] $SqlFqdn = 'sql-water-ws-dev.database.windows.net'
)

$ErrorActionPreference = 'Stop'
$destination = "$SqlPrivateIp/32"

$adapter = Get-NetAdapter |
    Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -like 'PANGP*' } |
    Select-Object -First 1
if (-not $adapter) {
    throw 'GlobalProtect (PANGP) is not connected. Sign in to the VPN and retry.'
}

Get-NetRoute -DestinationPrefix $destination -ErrorAction SilentlyContinue |
    Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue

New-NetRoute -DestinationPrefix $destination -InterfaceIndex $adapter.ifIndex -NextHop '0.0.0.0' -RouteMetric 1 | Out-Null
Write-Host "Routed $destination via $($adapter.Name) ($($adapter.InterfaceDescription))."

$test = Test-NetConnection -ComputerName $SqlFqdn -Port 1433 -WarningAction SilentlyContinue
if (-not $test.TcpTestSucceeded) {
    throw "TCP 1433 to $SqlFqdn ($($test.RemoteAddress)) failed. Confirm GlobalProtect is connected and can reach the WaterSolutions VNet."
}

Write-Host "TCP 1433 to $SqlFqdn ($($test.RemoteAddress)) succeeded. You can run the API against Azure SQL."

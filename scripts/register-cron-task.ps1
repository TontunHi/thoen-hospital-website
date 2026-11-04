$scriptPath = Join-Path $PSScriptRoot "cron-overdue-notify.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At "15:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "ThoenEquipmentOverdueNotify" -Action $action -Trigger $trigger -Settings $settings -Description "Thoen Hospital Equipment Overdue 15:00 Daily Notification" -Force
Write-Host "Registered Scheduled Task 'ThoenEquipmentOverdueNotify' targeting: $scriptPath"

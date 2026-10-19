$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c c:\Users\Tontun\Documents\thoen-hospital-website\scripts\cron-overdue-notify.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At "15:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "ThoenEquipmentOverdueNotify" -Action $action -Trigger $trigger -Settings $settings -Description "Thoen Hospital Equipment Overdue 15:00 Daily Notification" -Force

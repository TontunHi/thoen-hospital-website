@echo off
curl -s -X POST -H "Authorization: Bearer c7e39a2b8f41065d83e91a5c2d7e4b901f683a42c5b9e071" http://localhost:3000/api/cron/equipment-overdue-notify

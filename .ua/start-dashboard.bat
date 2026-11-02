@echo off
set "GRAPH_DIR=c:\Users\Tontun\Documents\thoen-hospital-website"
set "UNDERSTAND_ACCESS_TOKEN=thoen-hospital-dashboard"
cd /d C:\Users\Tontun\.understand-anything\repo\understand-anything-plugin\packages\dashboard
npx vite --port 5173

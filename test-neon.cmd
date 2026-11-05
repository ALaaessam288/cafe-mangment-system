@echo off
rem Double-click to test Caffio against your Neon database. See tools\test-neon.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\test-neon.ps1"

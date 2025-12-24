git add .
git commit -m "update"
git push
if %errorlevel% equ 0 (
  exit
) else (
  pause
)
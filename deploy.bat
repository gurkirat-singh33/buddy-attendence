@echo off
set "PATH=C:\Program Files\Git\cmd;%PATH%"
cd /d "C:\Users\gurki\Downloads\buddy-attendance-main\buddy-attendance-main"
echo =======================================================
echo  Saving and committing updated BUDDY Attendance code...
echo =======================================================
git add .
git commit -m "Update BUDDY: modern logo, sticky navbar, all-day streak, and live refresh"
echo.
echo =======================================================
echo  Pushing updated BUDDY Attendance code to GitHub...
echo =======================================================
git push -u origin main
echo.
echo =======================================================
echo  Upload complete! 
echo  Vercel is now building your site automatically.
echo  Your live link: https://buddy-attendence.vercel.app/
echo =======================================================
pause

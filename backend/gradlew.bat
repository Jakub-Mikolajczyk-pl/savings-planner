@echo off
setlocal
where gradle >nul 2>nul
if %ERRORLEVEL%==0 (
  gradle %*
  exit /b
)
set "CACHED_GRADLE=%USERPROFILE%\.gradle\wrapper\dists\gradle-8.4-bin\1w5dpkrfk8irigvoxmyhowfim\gradle-8.4\bin\gradle.bat"
if exist "%CACHED_GRADLE%" (
  call "%CACHED_GRADLE%" %*
  exit /b
)
echo Gradle is not installed and the local cached Gradle 8.4 distribution was not found.
echo Install Gradle or run a standard Gradle wrapper generation step once network is available.
exit /b 1

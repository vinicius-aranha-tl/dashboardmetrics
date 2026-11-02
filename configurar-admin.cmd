@echo off
pushd "%~dp0"
"%ProgramFiles%\dotnet\dotnet.exe" run --project backend\tools\AdminSetup\AdminSetup.csproj
set "setup_exit=%ERRORLEVEL%"
popd
exit /b %setup_exit%

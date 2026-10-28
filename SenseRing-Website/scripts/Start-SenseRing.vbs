Option Explicit
Dim shell, fso, scriptPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "Start-Companion.ps1")
command = "powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & scriptPath & """ -OpenWebsite"
exitCode = shell.Run(command, 0, True)
If exitCode <> 0 Then MsgBox "SenseRing couldn't start. Extract the complete companion folder and try again. If updating, close the previous companion first.", vbExclamation, "SenseRing"

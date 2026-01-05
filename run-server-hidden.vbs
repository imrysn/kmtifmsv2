' VBScript to run KMTI_FMS_Server.exe completely hidden
' This script runs the server executable without showing any windows

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = fso.BuildPath(scriptDir, "KMTI_FMS_Server.exe")

' Run the server executable hidden (0 = hidden, false = don't wait)
WshShell.Run """" & exePath & """", 0, false

' Clean up
Set WshShell = Nothing
Set fso = Nothing

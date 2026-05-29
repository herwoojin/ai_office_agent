' AI Office Agents - 콘솔창 없이 중지 (Windows)
Set objShell = CreateObject("WScript.Shell")
Set objFso   = CreateObject("Scripting.FileSystemObject")

strScriptDir = objFso.GetParentFolderName(WScript.ScriptFullName)
strCmd       = """" & strScriptDir & "\stop.cmd"""

objShell.Run strCmd, 0, False

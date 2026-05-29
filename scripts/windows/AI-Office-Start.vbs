' AI Office Agents - 콘솔창 없이 시작 (Windows)
' 더블클릭하면 백그라운드로 start.cmd 를 실행하고 브라우저만 띄웁니다.

Set objShell = CreateObject("WScript.Shell")
Set objFso   = CreateObject("Scripting.FileSystemObject")

' 이 .vbs 와 같은 폴더의 start.cmd 를 실행
strScriptDir = objFso.GetParentFolderName(WScript.ScriptFullName)
strCmd       = """" & strScriptDir & "\start.cmd"""

' 0 = 숨김 창, False = 완료를 기다리지 않음
objShell.Run strCmd, 0, False

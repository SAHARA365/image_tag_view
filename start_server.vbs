' start_server.vbs
Option Explicit

Dim WshShell, fso, scriptDir

Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")

' この vbs が置いてあるフォルダ（= もとの %~dp0）
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' === image_tag_view サーバーを起動します ===
' node server.js を「隠れた cmd」で実行（ウィンドウスタイル 0）
' ※黒い画面が出ずにバックグラウンドで動きます
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False

' 2秒待つ（server.js が立ち上がるまで待機）
WScript.Sleep 2000

' ブラウザで http://localhost:3000 を開く
WshShell.Run "http://localhost:3000", 1, False
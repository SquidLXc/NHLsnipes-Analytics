Set WshShell = CreateObject("WScript.Shell")

' Start API hidden
WshShell.Run "powershell -WindowStyle Hidden -Command ""cd 'C:\Users\jcsqu\Downloads\NHLsnipes-Analytics\NHLsnipes-Analytics'; pnpm --filter @workspace/api-server run dev""", 0, False

' Wait a moment
WScript.Sleep 3000

' Start Frontend hidden
WshShell.Run "powershell -WindowStyle Hidden -Command ""cd 'C:\Users\jcsqu\Downloads\NHLsnipes-Analytics\NHLsnipes-Analytics'; pnpm --filter @workspace/nhlsnipes run dev""", 0, False

' Wait a moment
WScript.Sleep 5000

' Start Ngrok hidden
WshShell.Run "powershell -WindowStyle Hidden -Command ""C:\Users\jcsqu\ngrok\ngrok.exe http 23191""", 0, False

Set WshShell = Nothing

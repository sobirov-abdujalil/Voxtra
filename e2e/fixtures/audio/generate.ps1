# Generates the E2E voice-loop WAV fixtures with Windows SAPI (no third-party deps).
# Re-run from C:\Voxtra:  powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/generate.ps1
# Output: 16-bit PCM mono WAVs, one per demo line (+ one inspect-label line for the golden path).
Add-Type -AssemblyName System.Speech
$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot '.'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$lines = @(
  @('01-clean-it-up.wav', "I'll clean it up."),
  @('02-isolate-area.wav', "Okay. I'll isolate the area first."),
  @('03-notify-supervisor.wav', "I'll notify the supervisor now."),
  @('04-document-incident.wav', 'Documenting the incident.'),
  @('05-inspect-label.wav', "I'll read the label from behind the cordon.")
)

foreach ($pair in $lines) {
  $path = Join-Path $outDir $pair[0]
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try {
    $zira = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like '*Zira*' } | Select-Object -First 1
    if ($zira) { $synth.SelectVoice($zira.VoiceInfo.Name) }
    $synth.Rate = -1
    $synth.SetOutputToWaveFile($path)
    $synth.Speak($pair[1])
  } finally {
    $synth.SetOutputToNull()
    $synth.Dispose()
  }
  Write-Output "wrote $path"
}

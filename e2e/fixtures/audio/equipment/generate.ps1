# Generates the Equipment Malfunction E2E WAV fixtures with Windows SAPI (no third-party deps).
# Re-run from C:\Voxtra:  powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/equipment/generate.ps1
# Output: 16-bit PCM mono WAVs, one per golden-path line, under e2e/fixtures/audio/equipment/.
Add-Type -AssemblyName System.Speech
$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot '.'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$lines = @(
  @('01-hit-estop.wav', 'Hitting the emergency stop now.'),
  @('02-isolate-power.wav', 'Locking out the power at the disconnect.'),
  @('03-evacuate-area.wav', 'Everyone out of the cell and the aisle.'),
  @('04-verify-technician.wav', "Checking on the technician, he's clear."),
  @('05-document-incident.wav', 'Filing the incident report now.')
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

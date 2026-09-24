# Generates the Forklift Incident E2E WAV fixtures with Windows SAPI (no third-party deps).
# Re-run from C:\Voxtra:  powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/forklift/generate.ps1
# Output: 16-bit PCM mono WAVs, one per golden-path line, under e2e/fixtures/audio/forklift/.
Add-Type -AssemblyName System.Speech
$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot '.'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$lines = @(
  @('01-secure-scene.wav', "I'm stopping the forklift and locking it out."),
  @('02-call-emergency.wav', 'Calling 911 right now and keeping him still.'),
  @('03-notify-supervisor.wav', 'Notifying the shift manager.'),
  @('04-preserve-scene.wav', 'Photographing the scene and keeping everyone clear.'),
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

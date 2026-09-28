let audio: AudioContext | null = null;

/**
 * A short two-note chime, synthesized (no audio file to ship). Played by the app itself when a reminder
 * arrives while the CRM is open and visible — the operating system makes its own sound for a notification
 * shown in the background. Best-effort: browsers only allow audio after the person has interacted with the
 * page, and a failure here must never break anything.
 */
export function playNotificationChime() {
  try {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    audio ??= new AudioCtor();
    if (audio.state === "suspended") void audio.resume();

    const start = audio.currentTime;
    // E5 then A5.
    [
      { frequency: 659.25, at: 0 },
      { frequency: 880, at: 0.16 },
    ].forEach(({ frequency, at }) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.55);
      osc.connect(gain).connect(audio!.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.6);
    });
  } catch {
    // no sound is fine
  }
}

// Módulo Exclusivo de Audio Chime y Síntesis de Voz Clínica
// Formato estricto: "Turno [N], paciente [Nombre], favor pasar a [Área/Consultorio]"
// Sin mención alguna al cajero o personal administrativo

export function reproducirChimeClinico(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        resolve();
        return;
      }
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Tono 1: Re 5 (587.33 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain1.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.30, audioCtx.currentTime + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.38);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.40);

      // Tono 2: La 5 (880.00 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.32);
      gain2.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.32);
      gain2.gain.exponentialRampToValueAtTime(0.38, audioCtx.currentTime + 0.37);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.95);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime + 0.32);
      osc2.stop(audioCtx.currentTime + 1.00);

      setTimeout(() => {
        resolve();
      }, 1050);
    } catch (e) {
      console.warn('Error al reproducir Chime clínico:', e);
      resolve();
    }
  });
}

export function reproducirLlamadoVoz(
  turnoNum: number | string,
  nombrePaciente: string,
  areaOConsultorio: string
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Cancelar locución previa

    // FORMATO ESTRICTO: Aislamiento absoluto de caja
    const turnoStr = String(turnoNum).padStart(3, '0');
    const texto = `Turno ${turnoStr}, paciente ${nombrePaciente}, favor pasar a ${areaOConsultorio}.`;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = 1.0;

    const voces = window.speechSynthesis.getVoices();
    const vozEspanol = voces.find(
      (v) =>
        v.lang.startsWith('es') ||
        v.name.toLowerCase().includes('spanish') ||
        v.name.toLowerCase().includes('sabina') ||
        v.name.toLowerCase().includes('helena') ||
        v.name.toLowerCase().includes('mexico')
    );
    if (vozEspanol) {
      utterance.voice = vozEspanol;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Error en síntesis de voz SpeechSynthesis:', err);
  }
}

export async function ejecutarLlamadoCompleto(
  turnoNum: number | string,
  nombrePaciente: string,
  areaOConsultorio: string
): Promise<void> {
  await reproducirChimeClinico();
  reproducirLlamadoVoz(turnoNum, nombrePaciente, areaOConsultorio);
}

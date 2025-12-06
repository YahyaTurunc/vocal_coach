export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

export function midiToNoteName(midi: number): string {
  if (midi <= 0) return '-';
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export interface Note {
  midi: number;
  time: number;
  duration: number;
  name: string;
}

export interface SongMap {
  tracks: {
    notes: Note[];
  }[];
}

export function getNoteAtTime(time: number, songMap: SongMap): Note | null {
  const track = songMap.tracks[0];
  if (!track) return null;

  return track.notes.find(note => 
    time >= note.time && time < note.time + note.duration
  ) || null;
}

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import PitchTraps from './PitchTraps';
import { frequencyToMidi, midiToNoteName } from '../utils/AudioUtils';
import vocalMap from '../../assets/song_data/islak_islak/vocal_map.json';

export default function SingingGame() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNote, setCurrentNote] = useState<string>('-');
    const [targetNote, setTargetNote] = useState<string>('-');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [feedbackColor, setFeedbackColor] = useState<string>('#808080');
    const [score, setScore] = useState(0);
    const [currentTime, setCurrentTime] = useState(0); // Ekranda süreyi görmek için

    const soundRef = useRef<Audio.Sound | null>(null);
    const userMidiRef = useRef<number>(0);

    useEffect(() => {
        setupAudioMode();
        return () => {
            stopGame(); // Çıkışta temizle
        };
    }, []);

    // 1. SES AYARLARI (Hoparlör Sorunu Çözümü)
    const setupAudioMode = async () => {
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true, // Bu ikisi hoparlörü açar
                staysActiveInBackground: false,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });
        } catch (e) {
            console.error("Audio mode hatası:", e);
        }
    };

    const startGame = async () => {
        try {
            if (soundRef.current) {
                await stopGame();
            }

            // Müzik dosyasını yükle
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/song_data/islak_islak/backing_track.mp3'),
                { shouldPlay: true } // Yüklenince otomatik çal
            );

            soundRef.current = sound;
            setIsPlaying(true);

            // 2. PERFORMANS AYARI (Loop Sorunu Çözümü)
            // Eski 'gameLoop' yerine Expo'nun kendi güncelleme servisini kullanıyoruz.
            // Bu sistem telefonu yormaz ve takılmaz.
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    // Şarkı bittiyse durdur
                    if (status.didJustFinish) {
                        stopGame();
                        return;
                    }
                    // Oyun mantığını her güncellemede çalıştır
                    handleGameLogic(status.positionMillis / 1000);
                }
            });

        } catch (error) {
            console.error("Başlatma hatası:", error);
            Alert.alert("Hata", "Müzik başlatılamadı.");
        }
    };

    const stopGame = async () => {
        setIsPlaying(false);
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (e) { }
            soundRef.current = null;
        }
        setTargetNote('-');
        setFeedbackColor('#808080');
        setStatusMessage('');
        setCurrentTime(0);
    };

    // Oyun Mantığı (Takılmadan Çalışır)
    const handleGameLogic = (timeInSeconds: number) => {
        setCurrentTime(timeInSeconds); // Süreyi güncelle

        // 35. saniyeden önce 'Hazırlan' yaz
        // Not: JSON dosyanızda 4. saniyede notalar var görünüyor ama
        // sizin MP3'ünüzde vokal 35'te başlıyorsa JSON ve MP3 senkron değildir.
        // Yine de bu kod JSON'a sadık kalır.

        // JSON Haritasından notayı bul
        // @ts-ignore
        const foundNote = vocalMap.tracks[0].notes.find((note: any) => {
            return timeInSeconds >= note.time && timeInSeconds <= (note.time + note.duration);
        });

        if (foundNote && foundNote.midi > 40) {
            // Nota varsa
            setTargetNote(foundNote.name);
            setStatusMessage('');

            const userMidi = userMidiRef.current;
            if (userMidi > 0) {
                const diff = Math.abs(userMidi - foundNote.midi);
                if (diff <= 1) {
                    setFeedbackColor('#4CAF50'); // Yeşil
                    setScore(s => s + 1);
                } else {
                    setFeedbackColor('#F44336'); // Kırmızı
                }
            } else {
                setFeedbackColor('#808080');
            }
        } else {
            // Nota yoksa (Intro veya Es)
            setTargetNote('-');
            setFeedbackColor('#808080');

            // Eğer süre 30 saniyeden azsa "Hazırlan" yaz (Sizin 35sn bilginize istinaden)
            if (timeInSeconds < 4.0) {
                setStatusMessage('Müzik çalıyor...');
            } else {
                setStatusMessage('');
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Şan Hocası</Text>
            <Text style={styles.songName}>Islak Islak</Text>

            {/* Süre Göstergesi (Debug için iyi olur) */}
            <Text style={styles.timer}>{currentTime.toFixed(1)}s</Text>

            <View style={[styles.feedbackCircle, { backgroundColor: feedbackColor }]}>
                <Text style={styles.noteText}>{currentNote}</Text>
                <Text style={styles.label}>Sen</Text>
            </View>

            <View style={styles.targetContainer}>
                <Text style={styles.label}>Hedef</Text>
                <Text style={styles.targetNote}>{targetNote}</Text>
                {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
            </View>

            <Text style={styles.score}>Puan: {score}</Text>

            <TouchableOpacity
                style={styles.button}
                onPress={isPlaying ? stopGame : startGame}
            >
                <Text style={styles.buttonText}>
                    {isPlaying ? 'Durdur' : 'Başla'}
                </Text>
            </TouchableOpacity>

            {/* Mikrofon Dinleyici */}
            {isPlaying && (
                <PitchTraps
                    onPitchDetected={(freq) => {
                        const userMidi = frequencyToMidi(freq);
                        userMidiRef.current = userMidi;
                        if (userMidi > 0) setCurrentNote(midiToNoteName(userMidi));
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: { fontSize: 24, color: '#fff', marginBottom: 5, fontWeight: 'bold' },
    songName: { fontSize: 18, color: '#aaa', marginBottom: 20 },
    timer: { fontSize: 14, color: '#666', marginBottom: 20 },
    feedbackCircle: {
        width: 150, height: 150, borderRadius: 75,
        justifyContent: 'center', alignItems: 'center', marginBottom: 30,
        borderWidth: 2, borderColor: '#fff',
    },
    noteText: { fontSize: 48, color: '#fff', fontWeight: 'bold' },
    targetContainer: { alignItems: 'center', marginBottom: 40, minHeight: 80 },
    targetNote: { fontSize: 48, color: '#FFD700', fontWeight: 'bold' },
    statusText: { fontSize: 16, color: '#00bcd4', marginTop: 10, fontStyle: 'italic' },
    label: { fontSize: 14, color: '#ccc', marginTop: 5 },
    score: { fontSize: 20, color: '#fff', marginBottom: 30 },
    button: { backgroundColor: '#2196F3', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
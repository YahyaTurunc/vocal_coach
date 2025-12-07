import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import PitchTraps from './PitchTraps';
import { frequencyToMidi, midiToNoteName } from '../utils/AudioUtils';
import vocalMap from '../../assets/song_data/islak_islak/vocal_map.json';

const VOCAL_DELAY = 34.5;

export default function SingingGame() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNote, setCurrentNote] = useState<string>('-');
    const [targetNote, setTargetNote] = useState<string>('-');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [feedbackColor, setFeedbackColor] = useState<string>('#808080');
    const [score, setScore] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [webViewLoaded, setWebViewLoaded] = useState(false); // WebView hazır mı?

    const soundRef = useRef<Audio.Sound | null>(null);
    const userMidiRef = useRef<number>(0);

    // Uygulama arka plana atılırsa sesi yönetmek için
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                configureAudio(); // Uygulama öne gelince sesi düzelt
            }
        });

        configureAudio(); // İlk açılışta ayarla

        return () => {
            stopGame();
            subscription.remove();
        };
    }, []);

    // --- KRİTİK SES AYARI ---
    // Bu fonksiyonu hem başta hem de oyun başlarken çağıracağız.
    const configureAudio = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true, // Mikrofon izni
                playsInSilentModeIOS: true, // Sessiz modda çal
                // MixWithOthers: WebView mikrofonu ile Expo müziğinin aynı anda çalışmasını sağlar
                interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: false,
                staysActiveInBackground: true,
                playThroughEarpieceAndroid: false,
            });
            console.log("Ses modu yapılandırıldı: MixWithOthers");
        } catch (e) {
            console.error("Ses modu hatası:", e);
        }
    };

    const startGame = async () => {
        try {
            if (soundRef.current) {
                await stopGame();
            }

            // Önce ses modunu tekrar zorla (WebView bozmuş olabilir diye)
            await configureAudio();

            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/song_data/islak_islak/backing_track.mp3'),
                { shouldPlay: false }
            );

            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    if (status.didJustFinish) {
                        stopGame();
                        return;
                    }

                    // --- KESİNTİ KORUMASI ---
                    // Eğer sistem (WebView) müziği durdurduysa ve biz durdurmadıysak, zorla tekrar başlat.
                    if (!status.isPlaying && isPlaying && !status.didJustFinish) {
                        console.log("Müzik kesildi, tekrar başlatılıyor...");
                        sound.playAsync();
                    }

                    handleGameLogic(status.positionMillis / 1000);
                }
            });

            // Sesi başlat
            await sound.playAsync();
            setIsPlaying(true);

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

    const handleGameLogic = (timeInSeconds: number) => {
        setCurrentTime(timeInSeconds);
        const mapTime = timeInSeconds - VOCAL_DELAY;

        if (mapTime < 0) {
            setStatusMessage(`Vokale ${Math.ceil(Math.abs(mapTime))} sn...`);
            setTargetNote('-');
            setFeedbackColor('#808080');
            return;
        }

        // @ts-ignore
        const foundNote = vocalMap.tracks[0].notes.find((note: any) => {
            return mapTime >= note.time && mapTime <= (note.time + note.duration);
        });

        if (foundNote && foundNote.midi > 40) {
            setTargetNote(foundNote.name);
            setStatusMessage('');

            const userMidi = userMidiRef.current;
            if (userMidi > 0) {
                const diff = Math.abs(userMidi - foundNote.midi);
                if (diff <= 1) {
                    setFeedbackColor('#4CAF50');
                    setScore(s => s + 1);
                } else {
                    setFeedbackColor('#F44336');
                }
            } else {
                setFeedbackColor('#808080');
            }
        } else {
            setTargetNote('-');
            setFeedbackColor('#808080');
            setStatusMessage('Dinle...');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Şan Hocası</Text>
            <Text style={styles.songName}>Islak Islak</Text>

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

            {/* Mikrofon Dinleyici - Her zaman render edip arka planda hazır tutuyoruz */}
            <PitchTraps
                onPitchDetected={(freq) => {
                    // Sadece oyun oynanıyorsa veriyi işle
                    if (isPlaying) {
                        const userMidi = frequencyToMidi(freq);
                        userMidiRef.current = userMidi;
                        if (userMidi > 0) setCurrentNote(midiToNoteName(userMidi));
                    }
                }}
            />
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
    statusText: { fontSize: 18, color: '#00bcd4', marginTop: 10, fontStyle: 'italic' },
    label: { fontSize: 14, color: '#ccc', marginTop: 5 },
    score: { fontSize: 20, color: '#fff', marginBottom: 30 },
    button: { backgroundColor: '#2196F3', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
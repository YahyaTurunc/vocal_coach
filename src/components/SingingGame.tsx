import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import PitchTraps from './PitchTraps'; // PitchTraps.tsx dosyasının aynı klasörde olduğundan emin ol
import { frequencyToMidi, midiToNoteName } from '../utils/AudioUtils';
import vocalMap from '../../assets/song_data/islak_islak/vocal_map.json';

export default function SingingGame() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNote, setCurrentNote] = useState<string>('-'); // Senin söylediğin
    const [targetNote, setTargetNote] = useState<string>('-');   // Olması gereken
    const [feedbackColor, setFeedbackColor] = useState<string>('#808080'); // Gri renk
    const [score, setScore] = useState(0);

    const soundRef = useRef<Audio.Sound | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const userMidiRef = useRef<number>(0); // Anlık ses verisi

    // Sayfa kapandığında sesi durdur
    useEffect(() => {
        return () => {
            stopGame();
        };
    }, []);

    const startGame = async () => {
        try {
            // Eğer daha önce çalan varsa durdur
            if (soundRef.current) {
                await stopGame();
            }

            // --- MÜZİĞİ YÜKLE ---
            // Dosya yolunun doğru olduğundan emin ol
            const { sound } = await Audio.Sound.createAsync(
                require('../../assets/song_data/islak_islak/backing_track.mp3')
            );
            soundRef.current = sound;

            // --- MÜZİĞİ BAŞLAT ---
            await sound.playAsync();
            setIsPlaying(true);

            // --- OYUN DÖNGÜSÜNÜ BAŞLAT ---
            gameLoop();
        } catch (error) {
            console.error("Oyun başlatma hatası:", error);
            alert("Müzik dosyası bulunamadı veya hata oluştu.");
        }
    };

    const stopGame = async () => {
        setIsPlaying(false);
        // Döngüyü durdur
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        // Sesi durdur ve hafızadan sil
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (e) {
                console.log("Ses durdurma hatası", e);
            }
            soundRef.current = null;
        }
        // Ekranı sıfırla
        setTargetNote('-');
        setCurrentNote('-');
        setFeedbackColor('#808080');
    };

    const gameLoop = async () => {
        // Eğer müzik yoksa veya durduysa döngüden çık
        if (!soundRef.current) return;

        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;

        // Şarkının bitip bitmediğini kontrol et
        if (status.didJustFinish) {
            stopGame();
            return;
        }

        // Şarkının o anki saniyesi
        const currentTime = status.positionMillis / 1000;

        // --- 1. JSON HARİTASINDAN NOTAYI BUL ---
        // (Buradaki '...' hatasını düzelttim, artık gerçek mantık var)
        // @ts-ignore
        const foundNote = vocalMap.tracks[0].notes.find((note: any) => {
            return currentTime >= note.time && currentTime <= (note.time + note.duration);
        });

        // --- 2. FİLTRELEME VE KIYASLAMA ---
        // Nota bulunduysa VE notanın değeri 40'tan büyükse (Çok kalın dip sesleri yoksaymak için)
        if (foundNote && foundNote.midi > 40) {
            setTargetNote(foundNote.name); // Hedefi ekrana yaz (Örn: A4)

            const userMidi = userMidiRef.current; // PitchTraps'ten gelen ses

            // Kullanıcı bir ses çıkarıyor mu? (0 değilse ses var demektir)
            if (userMidi > 0) {
                const diff = Math.abs(userMidi - foundNote.midi);

                // Eğer fark 1 veya daha azsa (Doğru nota)
                if (diff <= 1) {
                    setFeedbackColor('#4CAF50'); // YEŞİL
                    setScore(s => s + 1);       // Puan artır
                } else {
                    setFeedbackColor('#F44336'); // KIRMIZI
                }
            } else {
                setFeedbackColor('#808080'); // GRİ (Kullanıcı susuyor)
            }
        } else {
            // O saniyede vokal yoksa
            setTargetNote('-');
            setFeedbackColor('#808080');
        }

        // --- 3. DÖNGÜYÜ TEKRARLA ---
        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Şan Hocası</Text>
            <Text style={styles.songName}>Islak Islak</Text>

            {/* Senin Sesin */}
            <View style={[styles.feedbackCircle, { backgroundColor: feedbackColor }]}>
                <Text style={styles.noteText}>{currentNote}</Text>
                <Text style={styles.label}>Sen</Text>
            </View>

            {/* Hedef Nota */}
            <View style={styles.targetContainer}>
                <Text style={styles.label}>Söylemen Gereken</Text>
                <Text style={styles.targetNote}>{targetNote}</Text>
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

            {/* GİZLİ MİKROFON DİNLEYİCİSİ (Burası sesi analiz eder) */}
            {isPlaying && (
                <PitchTraps
                    onPitchDetected={(freq) => {
                        const userMidi = frequencyToMidi(freq);
                        userMidiRef.current = userMidi; // Oyuna gönder

                        // Sadece ses varsa ekrana yaz, yoksa '-' koy
                        if (userMidi > 0) {
                            setCurrentNote(midiToNoteName(userMidi));
                        } else {
                            setCurrentNote('-');
                        }
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
    title: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    songName: {
        fontSize: 18,
        color: '#aaa',
        marginBottom: 40,
    },
    feedbackCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 2,
        borderColor: '#fff',
    },
    noteText: {
        fontSize: 48,
        color: '#fff',
        fontWeight: 'bold',
    },
    targetContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    targetNote: {
        fontSize: 48,
        color: '#FFD700', // Altın Sarısı
        fontWeight: 'bold',
    },
    label: {
        fontSize: 14,
        color: '#ccc',
        marginTop: 5,
    },
    score: {
        fontSize: 20,
        color: '#fff',
        marginBottom: 30,
    },
    button: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});